/**
 * Instagram — real integration through the Graph API content publishing flow.
 * Auth: IG business user ID + token with instagram_content_publish.
 * Publish: image required → /media container → wait FINISHED → /media_publish → permalink.
 * The public API has no text-only posts, so missing media is a hard error.
 */
import { apiJson, pollUntil, requireFields, PlatformError, type Credentials, type DeliveryResult, type PlatformAdapter, type VerifiedProfile } from './shared';

const GRAPH = 'https://graph.facebook.com/v21.0';

function token(creds: Credentials): string {
  requireFields(creds, 'Instagram', ['userId', 'accessToken']);
  return creds.accessToken.trim();
}

export const instagram: PlatformAdapter = {
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
      remoteUrl: `https://www.instagram.com/${username}/`,
      credentials: { userId: creds.userId.trim(), accessToken: t },
    };
  },

  async deliver(creds, text, mediaUrl): Promise<DeliveryResult> {
    const t = token(creds);
    const uid = creds.userId.trim();

    if (!mediaUrl) {
      throw new PlatformError('Instagram requires an image: attach an image (URL) to the post, or remove Instagram from this post\u2019s targets.');
    }

    const container = await apiJson<{ id: string }>(`${GRAPH}/${uid}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: mediaUrl, caption: text, access_token: t }),
    });

    await pollUntil(async () => {
      const st = await apiJson<{ status_code?: string }>(
        `${GRAPH}/${container.id}?fields=status_code&access_token=${encodeURIComponent(t)}`,
      );
      if (st.status_code === 'FINISHED') return 'done';
      if (st.status_code === 'ERROR') return 'error';
      return 'pending';
    }, 12, 2_000);

    const published = await apiJson<{ id: string }>(`${GRAPH}/${uid}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: t }),
    });
    const permalink = await apiJson<{ permalink?: string }>(
      `${GRAPH}/${published.id}?fields=permalink&access_token=${encodeURIComponent(t)}`,
    );
    return { remoteId: published.id, remoteUrl: permalink.permalink ?? null };
  },
};
