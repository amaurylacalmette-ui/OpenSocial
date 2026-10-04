'use client';

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onModel?: (model: string) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

/** POSTs to /api/ai/chat and consumes the SSE stream. */
export async function streamChat(
  body: { messages: { role: 'user' | 'assistant'; content: string }[]; provider: string; model?: string },
  cb: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    cb.onError?.(`Network error: ${(e as Error).message}`);
    return;
  }

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error ?? msg;
    } catch { /* keep */ }
    cb.onError?.(msg);
    return;
  }

  const model = res.headers.get('X-OS-Model');
  if (model) cb.onModel?.(model);

  const reader = res.body?.getReader();
  if (!reader) {
    cb.onError?.('Streaming not supported');
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
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
        if (delta) cb.onDelta(delta);
      } catch { /* partial */ }
    }
  }
  cb.onDone?.();
}
