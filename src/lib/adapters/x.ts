/**
 * X (Twitter) — real integration using OAuth 1.0a user context.
 * Auth: consumer key/secret + access token/secret from the user's developer app.
 * Publish: POST /2/tweets (+ v1.1 media/upload for image attachments).
 * Metrics: GET /2/tweets/:id public_metrics (subject to API tier).
 *
 * The HMAC-SHA1 signature is computed with node:crypto — no external deps.
 */
import crypto from 'node:crypto';
import { apiJson, fetchImage, requireFields, type Credentials, type DeliveryResult, type PlatformAdapter, type RealMetrics, type VerifiedProfile } from './shared';

const API = 'https://api.twitter.com';
const UPLOAD = 'https://upload.twitter.com';

function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Build a real OAuth 1.0a Authorization header for a no-query-param request. */
function oauthHeader(method: string, url: string, creds: Credentials): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.appKey.trim(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken.trim(),
    oauth_version: '1.0',
  };
  const pairs = Object.entries(oauth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${pct(k)}=${pct(v)}`)
    .join('&');
  const baseString = [method.toUpperCase(), pct(url), pct(pairs)].join('&');
  const signingKey = `${pct(creds.appSecret.trim())}&${pct(creds.accessSecret.trim())}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  const withSig = { ...oauth, oauth_signature: signature };
  return `OAuth ${Object.entries(withSig).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ')}`;
}

function requireCreds(creds: Credentials): void {
  requireFields(creds, 'X', ['appKey', 'appSecret', 'accessToken', 'accessSecret']);
}

export const x: PlatformAdapter = {
  async verify(creds): Promise<VerifiedProfile> {
    requireCreds(creds);
    const data = await apiJson<{ data: { id: string; username: string; name: string; public_metrics?: { followers_count?: number } } }>(
      `${API}/2/users/me?user.fields=public_metrics`,
      { headers: { Authorization: oauthHeader('GET', `${API}/2/users/me`, creds) } },
    );
    const u = data.data;
    return {
      username: u.username,
      displayName: u.name || u.username,
      followers: typeof u.public_metrics?.followers_count === 'number' ? u.public_metrics.followers_count : null,
      remoteId: u.id,
      remoteUrl: `https://x.com/${u.username}`,
      credentials: {
        appKey: creds.appKey.trim(),
        appSecret: creds.appSecret.trim(),
        accessToken: creds.accessToken.trim(),
        accessSecret: creds.accessSecret.trim(),
      },
    };
  },

  async deliver(creds, text, mediaUrl, handle): Promise<DeliveryResult> {
    requireCreds(creds);

    let mediaId: string | undefined;
    if (mediaUrl) {
      const { bytes, contentType } = await fetchImage(mediaUrl);
      const form = new FormData();
      form.append('media', new Blob([bytes], { type: contentType }), 'image');
      const uploaded = await apiJson<{ media_id_string: string }>(`${UPLOAD}/1.1/media/upload.json`, {
        method: 'POST',
        headers: { Authorization: oauthHeader('POST', `${UPLOAD}/1.1/media/upload.json`, creds) },
        body: form,
      });
      mediaId = uploaded.media_id_string;
    }

    const body: Record<string, unknown> = { text };
    if (mediaId) body.media = { media_ids: [mediaId] };
    const created = await apiJson<{ data: { id: string } }>(`${API}/2/tweets`, {
      method: 'POST',
      headers: { Authorization: oauthHeader('POST', `${API}/2/tweets`, creds), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const id = created.data.id;
    return { remoteId: id, remoteUrl: handle ? `https://x.com/${handle}/status/${id}` : null };
  },

  async fetchMetrics(creds, remoteId): Promise<RealMetrics> {
    requireCreds(creds);
    const url = `${API}/2/tweets/${remoteId}?tweet.fields=public_metrics`;
    const data = await apiJson<{ data: { public_metrics?: Record<string, number> } }>(url, {
      headers: { Authorization: oauthHeader('GET', url, creds) },
    });
    const m = data.data.public_metrics ?? {};
    return {
      likes: m.like_count ?? 0,
      comments: m.reply_count ?? 0,
      shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
      impressions: m.impression_count ?? undefined,
    };
  },
};
