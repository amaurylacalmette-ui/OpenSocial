/**
 * LinkedIn — real integration via the member token flow.
 * Auth: member access token with w_member_social scope (user supplies it from their app).
 * Publish: POST /rest/posts with LinkedIn-Version header. Returns the post URN.
 * Engagement numbers sit behind restricted entitlements, so metrics sync is not offered.
 */
import { apiJson, api, PlatformError, requireFields, type Credentials, type DeliveryResult, type PlatformAdapter, type VerifiedProfile } from './shared';

const VERSION = '202411';

function headers(creds: Credentials): Record<string, string> {
  requireFields(creds, 'LinkedIn', ['accessToken']);
  return {
    Authorization: `Bearer ${creds.accessToken.trim()}`,
    'LinkedIn-Version': VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

export const linkedin: PlatformAdapter = {
  async verify(creds): Promise<VerifiedProfile> {
    const p = await apiJson<{ sub: string; name?: string; email?: string }>('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${requireToken(creds)}` },
    });
    return {
      username: p.sub,
      displayName: p.name || p.sub,
      followers: null, // follower count is not exposed by the member endpoints
      remoteId: p.sub,
      remoteUrl: null,
      credentials: { accessToken: creds.accessToken.trim() },
    };
  },

  async deliver(creds, text): Promise<DeliveryResult> {
    const h = headers(creds);
    const who = await apiJson<{ sub: string }>('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: h.Authorization },
    });
    const res = await api('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: `urn:li:person:${who.sub}`,
        commentary: text,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });
    const urn = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id');
    return { remoteId: urn, remoteUrl: null };
  },
};

function requireToken(creds: Credentials): string {
  requireFields(creds, 'LinkedIn', ['accessToken']);
  if (!creds.accessToken.trim()) throw new PlatformError('LinkedIn access token is empty.', 401);
  return creds.accessToken.trim();
}
