// AuraBot: in-app guide for citizens, resolvers and admins.
import { CHAT_MODEL, clients, groqChat, handle, HttpError, json, type ChatMessage } from '../_shared/groq.ts';

const SYSTEM = `You are AuraBot, the friendly guide inside the Auracity app. Keep answers short (under 90 words), practical and kind.
How Auracity works:
1. Report: a citizen takes a photo and drops a pin on the map. Valid reports earn 10 points.
2. Classify: Vision AI sets the issue type, department and a short summary, and assigns a department worker (resolver).
3. Resolve: the resolver fixes it and uploads an "after" photo from the same spot.
4. Audit and Pay: the AI compares before and after photos, rates 1-5. If legit (rating >= 3, confidence >= 70%) the bounty moves
   from the city treasury to the resolver's wallet, logged in an append-only ledger. Unsure audits go to an admin. Reporter gets +5 points when fixed.
Pin colours: grey = being classified, red = open/assigned, amber = under audit, green = fixed.
Upvotes raise an issue's priority for admins. City Mood shows the majority mood of citizen votes in the last 2 hours.
The Transparency page shows the treasury and every payout. For emergencies (fire, live wires, accidents) tell users to call 112 first.
If asked something unrelated to Auracity or civic life, steer back politely.`;

Deno.serve(
  handle(async (req) => {
    await clients(req);
    const { messages, role } = await req.json();
    if (!Array.isArray(messages)) throw new HttpError(400, 'messages must be an array');
    const history: ChatMessage[] = messages.slice(-12).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content).slice(0, 1000),
    }));
    const reply = await groqChat([{ role: 'system', content: `${SYSTEM}\nThe user is a ${role ?? 'citizen'}.` }, ...history], {
      model: CHAT_MODEL,
      maxTokens: 300,
    });
    return json({ reply });
  }),
);
