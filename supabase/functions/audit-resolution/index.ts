import { clamp, clients, groqChat, handle, HttpError, json, parseJson, VISION_MODEL } from '../_shared/groq.ts';

const SYSTEM = `You are the Proof-of-Resolution auditor for Auracity. A city pays a contractor only if you
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

Deno.serve(
  handle(async (req) => {
    const { admin, userId } = await clients(req);
    const { issue_id } = await req.json();
    if (!issue_id) throw new HttpError(400, 'issue_id is required');

    const { data: issue, error } = await admin.from('issues').select('*').eq('id', issue_id).single();
    if (error || !issue) throw new HttpError(404, 'Issue not found');
    if (issue.assigned_to !== userId) throw new HttpError(403, 'Not your job');
    if (issue.status !== 'pending_audit' || !issue.after_photo_url) throw new HttpError(409, 'Nothing to audit');

    const raw = await groqChat(
      [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Reported issue: ${issue.category} - ${issue.summary}\nBEFORE photo:` },
            { type: 'image_url', image_url: { url: issue.before_photo_url } },
            { type: 'text', text: 'AFTER photo:' },
            { type: 'image_url', image_url: { url: issue.after_photo_url } },
          ],
        },
      ],
      { json: true },
    );
    const out = parseJson(raw);
    const legit = out.is_legit === true && out.same_location !== false;

    const { data: audit, error: rpcError } = await admin.rpc('record_audit', {
      p_issue: issue_id,
      p_rating: clamp(Math.round(Number(out.rating) || 1), 1, 5),
      p_confidence: clamp(Number(out.confidence) || 0, 0, 1),
      p_is_legit: legit,
      p_reasoning: String(out.reasoning ?? 'No reasoning given').slice(0, 600),
      p_model: VISION_MODEL,
    });
    if (rpcError) throw new HttpError(500, rpcError.message);
    return json({ audit });
  }),
);
