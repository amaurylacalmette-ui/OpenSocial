import { NextResponse } from 'next/server';
import { PROVIDER_BASE_URLS } from '@/lib/ai';

export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch(PROVIDER_BASE_URLS.openrouter + '/models', {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    const free = (json.data ?? [])
      .filter((m: { pricing?: { prompt?: string; completion?: string } }) =>
        m.pricing && Number(m.pricing.prompt ?? 1) === 0 && Number(m.pricing.completion ?? 1) === 0)
      .map((m: { id: string; name?: string; context_length?: number }) => ({
        id: m.id,
        name: m.name ?? m.id,
        context: m.context_length ?? 0,
      }))
      .sort((a: { context: number }, b: { context: number }) => b.context - a.context)
      .slice(0, 40);
    return NextResponse.json({ free, count: free.length });
  } catch (e) {
    return NextResponse.json({ free: [], count: 0, error: (e as Error).message }, { status: 200 });
  }
}
