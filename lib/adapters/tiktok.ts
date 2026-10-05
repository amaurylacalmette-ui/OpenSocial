/**
 * TikTok — profile sync only.
 * Auth: token with user.info.basic.
 * Direct Post requires TikTok's audited API access, which no self-serve key
 * gets — so OpenSocial syncs the real profile + follower count and refuses
 * to fake a publish.
 */
import { apiJson, requireFields, type Credentials, type PlatformAdapter, type VerifiedProfile } from './shared';

export const tiktok: PlatformAdapter = {
  async verify(creds): Promise<VerifiedProfile> {
    requireFields(creds, 'TikTok', ['accessToken']);
    const data = await apiJson<{ data?: { user?: { open_id?: string; display_name?: string; follower_count?: number } } }>(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count',
      { headers: { Authorization: `Bearer ${creds.accessToken.trim()}` } },
    );
    const u = data.data?.user;
    if (!u?.open_id) throw new Error('TikTok did not return a user — check the token and scopes.');
    return {
      username: u.open_id,
      displayName: u.display_name || 'TikTok account',
      followers: typeof u.follower_count === 'number' ? u.follower_count : null,
      remoteId: u.open_id,
      remoteUrl: null,
      credentials: { accessToken: creds.accessToken.trim() },
    };
  },
};
