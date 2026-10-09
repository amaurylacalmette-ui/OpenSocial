import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { oauthConfigStatus, saveOAuthAppConfig, deleteOAuthAppConfig, isOAuthAppPlatform, type OAuthAppPlatform } from '@/lib/oauth';
import { oauthAppSetup } from '@/lib/platforms';

export async function GET() {
  return NextResponse.json(await oauthConfigStatus());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { platform, ...rest } = (body ?? {}) as Record<string, string | undefined>;

  if (!platform || !isOAuthAppPlatform(platform)) {
    return NextResponse.json({ error: platform === 'mastodon' ? 'Mastodon needs no app config — only the instance domain.' : 'Unknown OAuth platform' }, { status: 400 });
  }

  const setup = oauthAppSetup(platform);
  if (!setup) {
    return NextResponse.json({ error: 'Unknown OAuth platform' }, { status: 400 });
  }

  // Collect + validate the fields defined for this platform.
  const cfg: Record<string, string> = {};
  const missing: string[] = [];
  for (const field of setup.fields) {
    const v = (rest[field.key] ?? '').toString().trim();
    if (!v && !field.optional) missing.push(field.label);
    if (v) cfg[field.key] = v;
  }
  if (missing.length > 0) {
    return NextResponse.json({ error: `Required: ${missing.join(', ')}.` }, { status: 400 });
  }

  try {
    await saveOAuthAppConfig(platform as OAuthAppPlatform, cfg);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json(await oauthConfigStatus());
}

export async function DELETE(req: NextRequest) {
  const platform = new URL(req.url).searchParams.get('platform');
  if (!platform || !isOAuthAppPlatform(platform)) {
    return NextResponse.json({ error: 'Unknown OAuth platform' }, { status: 400 });
  }
  await deleteOAuthAppConfig(platform as OAuthAppPlatform);
  return NextResponse.json(await oauthConfigStatus());
}
