import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PROVIDERS, type ProviderId } from '@/lib/ai';

function mask(key: string): string {
  if (key.length <= 10) return '•'.repeat(key.length);
  return key.slice(0, 5) + '•'.repeat(Math.min(14, key.length - 9)) + key.slice(-4);
}

export async function GET() {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'ai_key_' } } });
  const keys = rows.map((r) => {
    const provider = r.key.replace('ai_key_', '') as ProviderId;
    return {
      provider,
      name: PROVIDERS[provider]?.name ?? provider,
      masked: mask(r.value),
      configured: true,
    };
  });
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { provider, key } = body as { provider: ProviderId; key: string | null };
  if (!provider || !(provider in PROVIDERS)) {
    return NextResponse.json({ error: 'Valid provider is required' }, { status: 400 });
  }
  const storageKey = `ai_key_${provider}`;
  if (key === null || key.trim() === '') {
    await db.setting.deleteMany({ where: { key: storageKey } });
    return NextResponse.json({ ok: true, removed: true });
  }
  await db.setting.upsert({
    where: { key: storageKey },
    update: { value: key.trim() },
    create: { key: storageKey, value: key.trim() },
  });
  return NextResponse.json({ ok: true, masked: mask(key.trim()) });
}
