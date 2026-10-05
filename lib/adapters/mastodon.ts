/**
 * Mastodon — real integration against any instance.
 * Auth: instance URL + access token → GET /api/v1/accounts/verify_credentials (live).
 * Publish: POST /api/v1/statuses, with v2 media upload for image attachments.
 * Metrics: GET /api/v1/statuses/:id (favourites / reblogs / replies).
 */
import { apiJson, fetchImage, pollUntil, PlatformError, requireFields, sleep, type Credentials, type DeliveryResult, type PlatformAdapter, type RealMetrics, type VerifiedProfile } from './shared';

function base(creds: Credentials): string {
  requireFields(creds, 'Mastodon', ['instance', 'accessToken']);
  let s = creds.instance.trim().replace(/^@/, '');
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function auth(creds: Credentials) {
  return { Authorization: `Bearer ${creds.accessToken.trim()}` };
}

export const mastodon: PlatformAdapter = {
  async verify(creds): Promise<VerifiedProfile> {
    const b = base(creds);
    const p = await apiJson<{ id: string; username: string; display_name?: string; followers_count?: number; url?: string }>(
      `${b}/api/v1/accounts/verify_credentials`,
      { headers: auth(creds) },
    );
    return {
      username: p.username || p.id,
      displayName: p.display_name || p.username || p.id,
      followers: typeof p.followers_count === 'number' ? p.followers_count : null,
      remoteId: p.id,
      remoteUrl: p.url ?? null,
      credentials: { instance: base(creds).replace(/^https?:\/\//, ''), accessToken: creds.accessToken.trim() },
    };
  },

  async deliver(creds, text, mediaUrl): Promise<DeliveryResult> {
    const b = base(creds);
    const mediaIds: string[] = [];

    if (mediaUrl) {
      const { bytes, contentType } = await fetchImage(mediaUrl);
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: contentType }), 'image');
      const uploaded = await apiJson<{ id: string }>(`${b}/api/v2/media`, { method: 'POST', headers: auth(creds), body: form });
      let ready = false;
      try {
        await pollUntil(async () => {
          const m = await apiJson<{ url: string | null }>(`${b}/api/v1/media/${uploaded.id}`, { headers: auth(creds) });
          ready = Boolean(m.url);
          return ready ? 'done' : 'pending';
        }, 8, 1_200);
      } catch { /* processing failure — publish attempt will surface the API error */ }
      if (!ready) await sleep(2_000);
      mediaIds.push(uploaded.id);
    }

    const body = new URLSearchParams({ status: text, ...(mediaIds.length ? { media_ids: mediaIds.join(',') } : {}) });
    const status = await apiJson<{ id: string; url: string | null }>(`${b}/api/v1/statuses`, {
      method: 'POST',
      headers: { ...auth(creds), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { remoteId: status.id, remoteUrl: status.url };
  },

  async fetchMetrics(creds, remoteId): Promise<RealMetrics> {
    const b = base(creds);
    const s = await apiJson<{ favourites_count?: number; reblogs_count?: number; replies_count?: number }>(
      `${b}/api/v1/statuses/${remoteId}`,
      { headers: auth(creds) },
    );
    return { likes: s.favourites_count ?? 0, comments: s.replies_count ?? 0, shares: s.reblogs_count ?? 0 };
  },
};
