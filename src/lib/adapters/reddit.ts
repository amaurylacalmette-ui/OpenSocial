/**
 * Reddit — real integration via a script app.
 * Auth: client id/secret + long-lived refresh token (+ target subreddit).
 * The refresh token is exchanged for a fresh access token on every call —
 * no expiry babysitting.
 * Publish: POST /r/{subreddit}/api/submit (self post, title = first line).
 * Metrics: GET /api/info for the created link (score + comments).
 */
import { api, apiJson, PlatformError, requireFields, type Credentials, type DeliveryResult, type PlatformAdapter, type RealMetrics, type VerifiedProfile } from './shared';

function requireCreds(creds: Credentials): void {
  requireFields(creds, 'Reddit', ['clientId', 'clientSecret', 'refreshToken']);
}

async function accessToken(creds: Credentials): Promise<string> {
  requireCreds(creds);
  const res = await api('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.clientId.trim()}:${creds.clientSecret.trim()}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'OpenSocial/1.0 (self-hosted cross-poster)',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: creds.refreshToken.trim() }).toString(),
  });
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new PlatformError('Reddit did not return an access token — check the refresh token.');
  return j.access_token;
}

function authHeader(token: string): string {
  return `Bearer ${token}`;
}

const UA = 'OpenSocial/1.0 (self-hosted cross-poster)';

export const reddit: PlatformAdapter = {
  async verify(creds): Promise<VerifiedProfile> {
    requireCreds(creds);
    const t = await accessToken(creds);
    const me = await apiJson<{ name: string; total_karma?: number }>('https://oauth.reddit.com/api/v1/me', {
      headers: { Authorization: authHeader(t), 'User-Agent': UA },
    });
    return {
      username: me.name,
      displayName: `u/${me.name}`,
      followers: null, // Reddit does not expose follower counts
      remoteId: me.name,
      remoteUrl: `https://www.reddit.com/user/${me.name}/`,
      credentials: {
        clientId: creds.clientId.trim(),
        clientSecret: creds.clientSecret.trim(),
        refreshToken: creds.refreshToken.trim(),
        subreddit: (creds.subreddit ?? '').trim(),
      },
    };
  },

  async deliver(creds, text, _mediaUrl): Promise<DeliveryResult> {
    requireCreds(creds);
    if (!(creds.subreddit ?? '').trim()) {
      throw new PlatformError('No subreddit configured for this Reddit account — reconnect with a subreddit to post into.');
    }
    const t = await accessToken(creds);

    const lines = text.split('\n');
    const title = (lines[0] || text).trim().slice(0, 300);
    const body = lines.slice(1).join('\n').trim();

    const res = await api('https://oauth.reddit.com/r/' + encodeURIComponent(creds.subreddit.trim()) + '/api/submit?api_type=json', {
      method: 'POST',
      headers: {
        Authorization: authHeader(t),
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        sr: creds.subreddit.trim(),
        kind: 'self',
        title,
        ...(body ? { text: body } : {}),
        resubmit: 'true',
        api_type: 'json',
      }).toString(),
    });
    const j = (await res.json()) as { json?: { errors?: unknown[][]; data?: { id?: string; url?: string } } };
    const errors = j.json?.errors ?? [];
    if (errors.length > 0) {
      const first = errors[0] as unknown[];
      throw new PlatformError(`Reddit rejected the post: ${String(first[1] ?? first[0] ?? 'unknown error')}`);
    }
    const id = j.json?.data?.id ?? null;
    const url = j.json?.data?.url ?? null;
    return {
      remoteId: id,
      remoteUrl: url ?? (id ? `https://www.reddit.com/comments/${id}` : null),
    };
  },

  async fetchMetrics(creds, remoteId): Promise<RealMetrics> {
    requireCreds(creds);
    const t = await accessToken(creds);
    const data = await apiJson<{ data?: { children?: { data?: { score?: number; num_comments?: number } }[] } }>(
      `https://oauth.reddit.com/api/info?id=t3_${encodeURIComponent(remoteId)}`,
      { headers: { Authorization: authHeader(t), 'User-Agent': UA } },
    );
    const post = data.data?.children?.[0]?.data;
    if (!post) throw new PlatformError('Reddit could not find the published post.');
    return { likes: post.score ?? 0, comments: post.num_comments ?? 0 };
  },
};
