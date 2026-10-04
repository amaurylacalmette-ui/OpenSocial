import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  PROVIDERS,
  getApiKey,
  pickFreeOpenRouterModel,
  providerEndpoint,
  providerHeaders,
  SYSTEM_PROMPT,
  type ProviderId,
} from '@/lib/ai';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = body.messages ?? [];
  const provider = (body.provider ?? 'openrouter') as ProviderId;
  let model: string = body.model || PROVIDERS[provider]?.defaultModel || 'gpt-4o-mini';

  if (!PROVIDERS[provider]) {
    return Response.json({ error: 'Unknown provider' }, { status: 400 });
  }
  if (messages.length === 0 || !messages[messages.length - 1]?.content?.trim()) {
    return Response.json({ error: 'Message is required' }, { status: 400 });
  }

  const apiKey = await getApiKey(provider);
  if (!apiKey) {
    return Response.json(
      { error: `No ${PROVIDERS[provider].name} API key configured. Add one in Settings or the AI panel.` },
      { status: 428 }
    );
  }

  let resolvedNote = '';
  if (provider === 'openrouter' && (!model || model === 'auto-free' || model === 'auto')) {
    const pick = await pickFreeOpenRouterModel();
    model = pick.model;
    resolvedNote = pick.reason;
  }

  // Persist conversation
  const last = messages[messages.length - 1];
  await db.chatMessage.create({ data: { role: 'user', content: last.content, provider, model } });

  const payload = {
    model,
    stream: true,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
    max_tokens: 2048,
  };

  let upstream: Response;
  try {
    upstream = await fetch(providerEndpoint(provider), {
      method: 'POST',
      headers: providerHeaders(provider, apiKey),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });
  } catch (e) {
    return Response.json({ error: `Could not reach ${PROVIDERS[provider].name}: ${(e as Error).message}` }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    let msg = `${PROVIDERS[provider].name} error ${upstream.status}`;
    try {
      const j = JSON.parse(text);
      msg = j?.error?.message || j?.error || msg;
    } catch { /* keep plain text */ }
    return Response.json({ error: typeof msg === 'string' ? msg.slice(0, 400) : msg }, { status: upstream.status || 502 });
  }

  // Pipe the SSE stream through while capturing the full response for persistence
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let full = '';
  let buffer = '';

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const j = JSON.parse(data);
              const delta = j.choices?.[0]?.delta?.content;
              if (typeof delta === 'string') full += delta;
            } catch { /* partial json */ }
          }
        }
        if (full.trim()) {
          await db.chatMessage.create({ data: { role: 'assistant', content: full, provider, model } });
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-OS-Model': model,
      ...(resolvedNote ? { 'X-OS-Note': encodeURIComponent(resolvedNote) } : {}),
      'X-Accel-Buffering': 'no',
    },
  });
}
