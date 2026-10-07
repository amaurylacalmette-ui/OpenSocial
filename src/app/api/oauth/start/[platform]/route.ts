import { NextRequest, NextResponse } from 'next/server';
import { isOAuthPlatform, mastodonStart, redditStart, xStart, originOf, callbackUrl } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

function backToApp(req: Request, params: Record<string, string>): NextResponse {
  const url = new URL(originOf(req));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;

  if (!isOAuthPlatform(platform)) {
    return backToApp(req, { oauth: 'error', reason: `OAuth is not available for "${platform}"` });
  }

  try {
    const cb = callbackUrl(req, platform);
    let authorizeUrl: string;
    if (platform === 'mastodon') {
      const instance = new URL(req.url).searchParams.get('instance') ?? '';
      authorizeUrl = await mastodonStart(instance, cb);
    } else if (platform === 'reddit') {
      authorizeUrl = await redditStart(cb);
    } else {
      authorizeUrl = await xStart(cb);
    }
    return NextResponse.redirect(authorizeUrl);
  } catch (e) {
    const reason = (e as Error).message.slice(0, 300);
    return backToApp(req, { oauth: 'error', platform, reason });
  }
}
