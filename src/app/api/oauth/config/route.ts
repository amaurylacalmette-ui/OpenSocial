import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { oauthConfigStatus, saveRedditAppConfig, saveXAppConfig, isOAuthPlatform } from '@/lib/oauth';

export async function GET() {
  return NextResponse.json(await oauthConfigStatus());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { platform, clientId, clientSecret, consumerKey, consumerSecret, subreddit } = (body ?? {}) as Record<string, string | undefined>;

  if (!platform || !isOAuthPlatform(platform)) {
    return NextResponse.json({ error: 'Unknown OAuth platform' }, { status: 400 });
  }
  if (platform === 'mastodon') {
    return NextResponse.json({ error: 'Mastodon needs no app config — only the instance domain.' }, { status: 400 });
  }

  try {
    if (platform === 'reddit') {
      if (!clientId?.trim() || !clientSecret?.trim()) {
        return NextResponse.json({ error: 'Both the client id and the client secret are required.' }, { status: 400 });
      }
      await saveRedditAppConfig({ clientId: clientId.trim(), clientSecret: clientSecret.trim(), subreddit: subreddit?.trim() || undefined });
    } else {
      if (!consumerKey?.trim() || !consumerSecret?.trim()) {
        return NextResponse.json({ error: 'Both the consumer key and the consumer secret are required.' }, { status: 400 });
      }
      await saveXAppConfig({ consumerKey: consumerKey.trim(), consumerSecret: consumerSecret.trim() });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json(await oauthConfigStatus());
}

export async function DELETE(req: NextRequest) {
  const platform = new URL(req.url).searchParams.get('platform');
  if (!platform || !isOAuthPlatform(platform)) {
    return NextResponse.json({ error: 'Unknown OAuth platform' }, { status: 400 });
  }
  const key = platform === 'reddit' ? 'oauth:app:reddit' : platform === 'x' ? 'oauth:app:x' : null;
  if (key) await db.setting.deleteMany({ where: { key } });
  return NextResponse.json(await oauthConfigStatus());
}
