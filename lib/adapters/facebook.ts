/**
 * Facebook Pages — real integration through the Graph API.
 * Auth: Page ID + Page access token (pages_manage_posts).
 * Publish: text → POST /{page}/feed · image → POST /{page}/photos.
 */
import { apiJson, requireFields, type Credentials, type DeliveryResult, type PlatformAdapter, type VerifiedProfile } from './shared';

const GRAPH = 'https://graph.facebook.com/v21.0';

function token(creds: Credentials): string {
  requireFields(creds, 'Facebook', ['pageId', 'pageToken']);
  return creds.pageToken.trim();
}

export const facebook: PlatformAdapter = {
  async verify(creds): Promise<VerifiedProfile> {
    const t = token(creds);
    const p = await apiJson<{ id: string; name?: string; fan_count?: number; followers_count?: number; link?: string }>(
      `${GRAPH}/${creds.pageId.trim()}?fields=id,name,fan_count,followers_count,link&access_token=${encodeURIComponent(t)}`,
    );
    const followers = p.followers_count ?? p.fan_count ?? null;
    return {
      username: p.name ? p.name.toLowerCase().replace(/[^a-z0-9.]+/g, '').slice(0, 30) || p.id : p.id,
      displayName: p.name || p.id,
      followers: typeof followers === 'number' ? followers : null,
      remoteId: p.id,
      remoteUrl: p.link ?? `https://facebook.com/${p.id}`,
      credentials: { pageId: creds.pageId.trim(), pageToken: t },
    };
  },

  async deliver(creds, text, mediaUrl): Promise<DeliveryResult> {
    const t = token(creds);
    const page = creds.pageId.trim();

    if (mediaUrl) {
      const photo = await apiJson<{ post_id?: string; id?: string }>(`${GRAPH}/${page}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: mediaUrl, caption: text, access_token: t }),
      });
      const id = photo.post_id ?? photo.id ?? null;
      return { remoteId: id, remoteUrl: id ? `https://facebook.com/${id}` : null };
    }

    const feed = await apiJson<{ id: string }>(`${GRAPH}/${page}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, access_token: t }),
    });
    return { remoteId: feed.id, remoteUrl: `https://facebook.com/${feed.id}` };
  },
};
