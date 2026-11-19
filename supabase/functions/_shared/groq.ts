// Shared helpers for Auracity edge functions (Deno runtime).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const VISION_MODEL = Deno.env.get('GROQ_VISION_MODEL') ?? 'meta-llama/llama-4-scout-17b-16e-instruct';
export const CHAT_MODEL = Deno.env.get('GROQ_CHAT_MODEL') ?? VISION_MODEL;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Service-role client for privileged RPCs, plus the caller's user id from their JWT. */
export async function clients(req: Request): Promise<{ admin: SupabaseClient; userId: string }> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Not signed in');
  return { admin, userId: data.user.id };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Content = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: Content;
}

export async function groqChat(messages: ChatMessage[], opts: { json?: boolean; model?: string; maxTokens?: number } = {}) {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) throw new HttpError(500, 'GROQ_API_KEY is not set');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model ?? VISION_MODEL,
      messages,
      temperature: 0.1,
      max_completion_tokens: opts.maxTokens ?? 600,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new HttpError(502, `Groq error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? '');
}

export function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new HttpError(502, 'AI did not return JSON');
    return JSON.parse(m[0]);
  }
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      return await fn(req);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      return json({ error: e instanceof Error ? e.message : String(e) }, status);
    }
  };
}
