/**
 * YouTube — profile sync only.
 * Auth: OAuth token with youtube.readonly.
 * The Data API has no text-post endpoint (community posts aren't public),
 * so OpenSocial syncs the real channel identity and subscriber count into
 * analytics instead of pretending to publish.
 */
import { apiJson, requireFields, PlatformError, type Credentials, type DeliveryResult, type PlatformAdapter, type VerifiedProfile } from './shared';

export const youtube: PlatformAdapter = {
  async verify(creds): Promise<VerifiedProfile> {
    requireFields(creds, 'YouTube', ['accessToken']);
    const data = await apiJson<{ items?: { id: string; snippet?: { title?: string; customUrl?: string }; statistics?: { subscriberCount?: string } }[] }>(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { Authorization: `Bearer ${creds.accessToken.trim()}` } },
    );
    const ch = data.items?.[0];
    if (!ch) throw new Error('No YouTube channel is attached to this token.');
    const custom = ch.snippet?.customUrl?.replace(/^@/, '');
    return {
      username: custom || ch.id,
      displayName: ch.snippet?.title || custom || ch.id,
      followers: ch.statistics?.subscriberCount ? Number(ch.statistics.subscriberCount) : null,
      remoteId: ch.id,
      remoteUrl: custom ? `https://www.youtube.com/@${custom}` : `https://www.youtube.com/channel/${ch.id}`,
      credentials: {
        accessToken: creds.accessToken.trim(),
        // Persisted when the connect flow was OAuth (offline access) so the
        // channel data can be re-authenticated later without re-connecting.
        ...(creds.refreshToken ? { refreshToken: creds.refreshToken.trim() } : {}),
      },
    };
  },

  async deliver(): Promise<DeliveryResult> {
    // Guard: the YouTube Data API has no text-post endpoint — sync-only in OpenSocial.
    throw new PlatformError('YouTube has no text-post API — this account syncs channel data only.');
  },
};
