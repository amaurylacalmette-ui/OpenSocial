/**
 * Bluesky — real atproto integration.
 * Auth: handle + app password → com.atproto.server.createSession (live).
 * Publish: com.atproto.repo.createRecord on the user's repo.
 * Metrics: app.bsky.feed.getPosts (likes / replies / reposts + quotes).
 */
import { apiJson, fetchImage, PlatformError, requireFields, type Credentials, type DeliveryResult, type PlatformAdapter, type RealMetrics, type VerifiedProfile } from './shared';

const SERVICE = 'https://bsky.social';

async function session(creds: Credentials): Promise<{ jwt: string; did: string }> {
  requireFields(creds, 'Bluesky', ['identifier', 'appPassword']);
  const res = await apiJson<{ accessJwt: string; did: string }>(`${SERVICE}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: creds.identifier.trim(), appPassword: creds.appPassword.trim() }),
  });
  return { jwt: res.accessJwt, did: res.did };
}

async function getProfile(jwt: string, did: string) {
  return apiJson<{ handle: string; displayName?: string; followersCount?: number }>(
    `${SERVICE}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
    { headers: { Authorization: `Bearer ${jwt}` } },
  );
}

export const bluesky: PlatformAdapter = {
  async verify(creds): Promise<VerifiedProfile> {
    const { jwt, did } = await session(creds);
    const p = await getProfile(jwt, did);
    return {
      username: p.handle,
      displayName: p.displayName || p.handle,
      followers: typeof p.followersCount === 'number' ? p.followersCount : null,
      remoteId: did,
      remoteUrl: `https://bsky.app/profile/${did}`,
      credentials: { identifier: creds.identifier.trim(), appPassword: creds.appPassword.trim() },
    };
  },

  async deliver(creds, text, mediaUrl, _handle): Promise<DeliveryResult> {
    const { jwt, did } = await session(creds);
    const headers = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

    let embed: Record<string, unknown> | undefined;
    if (mediaUrl) {
      const { bytes, contentType } = await fetchImage(mediaUrl);
      const blob = await apiJson<{ blob: Record<string, unknown> }>(`${SERVICE}/xrpc/com.atproto.repo.uploadBlob`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': contentType },
        body: bytes,
      });
      embed = { 'app.bsky.embed.images': { images: [{ image: blob.blob, alt: '' }] } };
    }

    const record: Record<string, unknown> = { text, createdAt: new Date().toISOString() };
    if (embed) record.embed = embed;

    const created = await apiJson<{ uri: string }>(`${SERVICE}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', record }),
    });
    const rkey = created.uri.split('/').pop() ?? null;
    return { remoteId: rkey, remoteUrl: rkey ? `https://bsky.app/profile/${did}/post/${rkey}` : null };
  },

  async fetchMetrics(creds, remoteId): Promise<RealMetrics> {
    const { jwt, did } = await session(creds);
    const uri = `at://${did}/app.bsky.feed.post/${remoteId}`;
    const data = await apiJson<{ posts?: { likeCount?: number; replyCount?: number; repostCount?: number; quoteCount?: number }[] }>(
      `${SERVICE}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`,
      { headers: { Authorization: `Bearer ${jwt}` } },
    );
    const p = data.posts?.[0];
    if (!p) throw new PlatformError('Bluesky could not find the published post.');
    return {
      likes: p.likeCount ?? 0,
      comments: p.replyCount ?? 0,
      shares: (p.repostCount ?? 0) + (p.quoteCount ?? 0),
    };
  },
};

export { getProfile as blueskyProfile };
