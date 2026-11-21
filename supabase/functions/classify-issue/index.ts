import { clamp, clients, groqChat, handle, HttpError, json, parseJson, VISION_MODEL } from '../_shared/groq.ts';

const DEPARTMENTS = ['roads', 'water', 'electricity', 'sanitation', 'parks', 'general'];

const SYSTEM = `You are the intake classifier for Auracity, a civic issue platform for an Indian city.
Look at the citizen's photo and note. Reply with ONLY a JSON object with exactly these keys:
{
  "is_civic_issue": boolean,      // false for selfies, memes, private property, blank or unrelated photos
  "category": string,             // short label, e.g. "Pothole", "Water leak", "Broken streetlight", "Garbage dump"
  "department": one of ${JSON.stringify(DEPARTMENTS)},
  "summary": string,              // one sentence, max 160 chars, what is wrong and where in the frame
  "severity": integer 1-5,        // 5 = immediate danger to people
  "confidence": number 0-1
}`;

Deno.serve(
  handle(async (req) => {
    const { admin, userId } = await clients(req);
    const { issue_id } = await req.json();
    if (!issue_id) throw new HttpError(400, 'issue_id is required');

    const { data: issue, error } = await admin.from('issues').select('*').eq('id', issue_id).single();
    if (error || !issue) throw new HttpError(404, 'Issue not found');
    if (issue.reporter_id !== userId) throw new HttpError(403, 'Not your report');
    if (issue.status !== 'classifying') return json({ issue });

    const raw = await groqChat(
      [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Citizen note: ${issue.description || '(none)'}` },
            { type: 'image_url', image_url: { url: issue.before_photo_url } },
          ],
        },
      ],
      { json: true },
    );
    const out = parseJson(raw);
    const dept = DEPARTMENTS.includes(String(out.department)) ? String(out.department) : 'general';

    const { data: updated, error: rpcError } = await admin.rpc('apply_classification', {
      p_issue: issue_id,
      p_is_civic_issue: out.is_civic_issue !== false,
      p_category: String(out.category ?? 'Civic issue').slice(0, 60),
      p_department_code: dept,
      p_summary: String(out.summary ?? '').slice(0, 240),
      p_severity: clamp(Math.round(Number(out.severity) || 3), 1, 5),
      p_confidence: clamp(Number(out.confidence) || 0.5, 0, 1),
    });
    if (rpcError) throw new HttpError(500, rpcError.message);
    return json({ issue: updated, model: VISION_MODEL });
  }),
);
