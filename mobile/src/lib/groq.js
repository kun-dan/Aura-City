import { DEPARTMENT_CODES } from './rules';

const KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
export const VISION_MODEL = process.env.EXPO_PUBLIC_GROQ_MODEL || 'qwen/qwen3.8-27b';
export const hasGroq = !!KEY;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(messages, { json = false, maxTokens = 600 } = {}, attempt = 0) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages,
      temperature: 0.1,
      max_completion_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (res.status === 429 && attempt < 4) {
    const wait = Number(res.headers.get('retry-after')) || 8 * (attempt + 1);
    await sleep(Math.min(30, wait) * 1000 + 500);
    return chat(messages, { json, maxTokens }, attempt + 1);
  }
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? '');
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI did not return JSON');
    return JSON.parse(m[0]);
  }
}

const img = (b64) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } });

export const CLASSIFY_PROMPT = `You are the intake classifier for Auracity, a civic issue platform for an Indian city.
Look at the citizen's photo and note. Reply with ONLY a JSON object with exactly these keys:
{
  "is_civic_issue": boolean,      // false for selfies, memes, private property, blank or unrelated photos
  "category": string,             // short label, e.g. "Pothole", "Water leak", "Broken streetlight", "Garbage dump"
  "department": one of ${JSON.stringify(DEPARTMENT_CODES)},
  "summary": string,              // one sentence, max 160 chars, what is wrong and where in the frame
  "severity": integer 1-5,        // 5 = immediate danger to people
  "confidence": number 0-1
}`;

export const AUDIT_PROMPT = `You are the Proof-of-Resolution auditor for Auracity. A city pays a contractor only if you
confirm the repair. You get the BEFORE photo (the reported problem) and the AFTER photo (the claimed fix).
Be strict and skeptical:
- The AFTER photo must show the SAME location (matching landmarks, angle, surroundings).
- The specific problem must be visibly fixed, not hidden, cropped out, or photographed elsewhere.
- A reused, nearly identical, or unrelated photo is NOT legit.
Reply with ONLY a JSON object:
{
  "same_location": boolean,
  "is_legit": boolean,      // true only if same location AND the problem is fixed
  "rating": integer 1-5,    // quality of the repair; 1 = not fixed, 5 = excellent
  "confidence": number 0-1, // how sure you are
  "reasoning": string       // 1-3 sentences a city auditor can read
}`;

export const BOT_PROMPT = `You are AuraBot, the friendly guide inside the Auracity app. Keep answers short (under 90 words), practical and kind.
How Auracity works:
1. Report: a citizen takes a photo and drops a pin on the map. Valid reports earn 10 points.
2. Classify: Vision AI sets the issue type, department and a short summary, and assigns a department worker (resolver).
3. Resolve: the resolver fixes it and uploads an "after" photo from the same spot.
4. Audit and Pay: the AI compares before and after photos, rates 1-5. If legit (rating >= 3, confidence >= 70%) the bounty moves
   from the city treasury to the resolver's wallet, logged in an append-only ledger. Unsure audits go to an admin. Reporter gets +5 points when fixed.
Pin colours: grey = being classified, red = open/assigned, amber = under audit, green = fixed.
Upvotes raise an issue's priority for admins. City Mood shows the majority mood of citizen votes in the last 2 hours.
The Spending tab shows the treasury and every payout. For emergencies (fire, live wires, accidents) tell users to call 112 first.
If asked something unrelated to Auracity or civic life, steer back politely.`;

export async function classify(photoB64, note) {
  const out = parseJson(
    await chat(
      [
        { role: 'system', content: CLASSIFY_PROMPT },
        { role: 'user', content: [{ type: 'text', text: `Citizen note: ${note || '(none)'}` }, img(photoB64)] },
      ],
      { json: true },
    ),
  );
  return {
    is_civic_issue: out.is_civic_issue !== false,
    category: String(out.category ?? 'Civic issue').slice(0, 60),
    department: DEPARTMENT_CODES.includes(String(out.department)) ? String(out.department) : 'general',
    summary: String(out.summary ?? '').slice(0, 240),
    severity: clamp(Math.round(Number(out.severity) || 3), 1, 5),
    confidence: clamp(Number(out.confidence) || 0.5, 0, 1),
  };
}

export async function audit(beforeB64, afterB64, context) {
  const out = parseJson(
    await chat(
      [
        { role: 'system', content: AUDIT_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Reported issue: ${context}\nBEFORE photo:` },
            img(beforeB64),
            { type: 'text', text: 'AFTER photo:' },
            img(afterB64),
          ],
        },
      ],
      { json: true },
    ),
  );
  return {
    rating: clamp(Math.round(Number(out.rating) || 1), 1, 5),
    confidence: clamp(Number(out.confidence) || 0, 0, 1),
    is_legit: out.is_legit === true && out.same_location !== false,
    reasoning: String(out.reasoning ?? 'No reasoning given').slice(0, 600),
    model: VISION_MODEL,
  };
}

export async function botReply(messages, role) {
  return chat(
    [
      { role: 'system', content: `${BOT_PROMPT}\nThe user is a ${role}.` },
      ...messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 1000) })),
    ],
    { maxTokens: 300 },
  );
}
