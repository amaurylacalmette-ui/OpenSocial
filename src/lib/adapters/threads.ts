/**
 * Threads — real integration through the Threads API (graph.threads.net).
 * Auth: Threads user ID + access token with threads_basic / threads_content_publish.
 * Publish: two-step — create a media container, wait for FINISHED, then publish.
 * Metrics: likes / replies / quotes on the published media node.
 */
import { apiJson, pollUntil, requireFields, PlatformError, type Credentials, type DeliveryResult, type PlatformAdapter, type RealMetrics, type VerifiedProfile } from './shared';

const GRAPH = 'https://graph.threads.net/v1.0';

function token(creds: Credentials): string {
  requireFields(creds, 'Threads', ['userId', 'accessToken']);
  return creds.accessToken.trim();
}

export const threads: PlatformAdapter = {
  async verify(creds): Promise<VerifiedProfile> {
    const t = token(creds);
    const p = await apiJson<{ id: string; username?: string; followers_count?: number }>(
      `${GRAPH}/${creds.userId.trim()}?fields=id,username,followers_count&access_token=${encodeURIComponent(t)}`,
    );
    const username = p.username || p.id;
    return {
      username,
      displayName: `@${username}`,
      followers: typeof p.followers_count === 'number' ? p.followers_count : null,
      remoteId: p.id,
      remoteUrl: `https://www.threads.net/@${username}`,
      credentials: { userId: creds.userId.trim(), accessToken: t },
    };
  },

  async deliver(creds, text, mediaUrl, handle): Promise<DeliveryResult> {
    const t = token(creds);
    const uid = creds.userId.trim();

    const container = await apiJson<{ id: string }>(`${GRAPH}/${uid}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: mediaUrl ? 'IMAGE' : 'TEXT',
        ...(mediaUrl ? { image_url: mediaUrl } : {}),
        text,
        access_token: t,
      }),
    });

    await pollUntil(async () => {
      const st = await apiJson<{ status?: string; error_code?: string; error_message?: string }>(
        `${GRAPH}/${container.id}?fields=status,error_code,error_message&access_token=${encodeURIComponent(t)}`,
      );
      if (st.status === 'FINISHED') return 'done';
      if (st.status === 'ERROR') throw new PlatformError(`Threads media container failed: ${st.error_message || st.error_code || 'unknown error'}`);
      return 'pending';
    }, 10, 1_500);

    const published = await apiJson<{ id: string }>(
      `${GRAPH}/${uid}/threads_publish?creation_id=${encodeURIComponent(container.id)}&access_token=${encodeURIComponent(t)}`,
      { method: 'POST' },
    );
    return {
      remoteId: published.id,
      remoteUrl: handle ? `https://www.threads.net/@${handle}/post/${published.id}` : null,
    };
  },

  async fetchMetrics(creds, remoteId): Promise<RealMetrics> {
    const t = token(creds);
    const m = await apiJson<{ likes?: number; replies?: number; quotes?: number }>(
      `${GRAPH}/${remoteId}?fields=likes,replies,quotes&access_token=${encodeURIComponent(t)}`,
    );
    return { likes: m.likes ?? 0, comments: m.replies ?? 0, shares: m.quotes ?? 0 };
  },
};
