import { NextRequest, NextResponse } from 'next/server';
import {
  isOAuthPlatform,
  mastodonCallback,
  redditCallback,
  xCallback,
  resolveXState,
  takePending,
  originOf,
} from '@/lib/oauth';
import { createVerifiedAccount } from '@/lib/account-service';

export const dynamic = 'force-dynamic';

function backToApp(req: Request, params: Record<string, string>): NextResponse {
  const url = new URL(originOf(req));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const q = new URL(req.url).searchParams;

  if (!isOAuthPlatform(platform)) {
    return backToApp(req, { oauth: 'error', reason: `Unknown OAuth callback for "${platform}"` });
  }

  // The platform can bounce the user back with its own error (e.g. access_denied).
  const platformError = q.get('error_description') ?? q.get('error');
  if (platformError) {
    const reason = platformError === 'access_denied' ? 'Authorization was cancelled.' : platformError.slice(0, 200);
    return backToApp(req, { oauth: 'error', platform, reason });
  }

  try {
    // Resolve the pending state.
    let state = q.get('state');
    if (platform === 'x') {
      const oauthToken = q.get('oauth_token');
      const verifier = q.get('oauth_verifier');
      if (!oauthToken || !verifier) throw new Error('X did not send the expected token parameters back.');
      state = state ?? (await resolveXState(oauthToken));
      if (!state) throw new Error('Unknown or expired X authorization attempt — start the connection again.');
      const pending = await takePending(state);
      const credentials = await xCallback(oauthToken, verifier, pending);
      return await finish(req, platform, credentials);
    }

    const code = q.get('code');
    if (!state) throw new Error('The platform did not send a state parameter back.');
    if (!code) throw new Error('The platform did not send an authorization code back.');
    const pending = await takePending(state);
    if (pending.platform !== platform) throw new Error('This authorization belongs to a different platform.');

    const credentials =
      platform === 'mastodon'
        ? await mastodonCallback(code, pending)
        : await redditCallback(code, pending);
    return await finish(req, platform, credentials);
  } catch (e) {
    const reason = (e as Error).message.slice(0, 300);
    return backToApp(req, { oauth: 'error', platform, reason });
  }
}

async function finish(req: Request, platform: string, credentials: Record<string, string>) {
  const account = await createVerifiedAccount(platform, credentials);
  return backToApp(req, { oauth: 'success', platform, handle: account.username });
}
