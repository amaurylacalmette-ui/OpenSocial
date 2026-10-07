/**
 * Shared account-creation pipeline — used by the manual connect route and the
 * OAuth callback. Every path verifies against the live platform API before
 * anything is stored; nothing is invented.
 */
import { db } from '@/lib/db';
import { getAdapter, PlatformError } from '@/lib/adapters';
import type { Credentials } from '@/lib/adapters';
import { PLATFORMS, type PlatformId } from '@/lib/platforms';

export async function createVerifiedAccount(platform: string, credentials: Record<string, string>) {
  if (!platform || !(platform in PLATFORMS)) {
    throw new PlatformError('Unknown platform', 400);
  }
  const adapter = getAdapter(platform);
  if (!adapter) {
    throw new PlatformError(`No integration available for ${platform}`, 400);
  }
  for (const [k, v] of Object.entries(credentials)) {
    if (typeof v !== 'string') throw new PlatformError('Invalid credential payload', 400);
  }

  // Live verification — the platform's real answer decides whether the account connects.
  let profile;
  try {
    profile = await adapter.verify(credentials as Credentials);
  } catch (e) {
    const msg = e instanceof PlatformError || e instanceof Error ? e.message : 'Verification failed';
    throw new PlatformError(`${PLATFORMS[platform as PlatformId].name}: ${msg}`, 400);
  }

  const username = profile.username.replace(/^@/, '').trim();
  const existing = await db.socialAccount.findUnique({
    where: { platform_username: { platform, username } },
  });
  if (existing) {
    throw new PlatformError('This account is already connected', 409);
  }

  const account = await db.socialAccount.create({
    data: {
      platform,
      username,
      displayName: profile.displayName || username,
      avatarColor: PLATFORMS[platform as PlatformId].color,
      followers: Math.max(0, profile.followers ?? 0),
      status: 'connected',
      credentials: JSON.stringify(profile.credentials),
      remoteId: profile.remoteId,
      remoteUrl: profile.remoteUrl,
      verifiedAt: new Date(),
    },
  });

  // First data point of the growth chart — pulled from the platform, not invented.
  if (account.followers > 0) {
    await db.followerSnapshot.create({
      data: { accountId: account.id, date: new Date(), followers: account.followers },
    });
  }

  const { credentials: _c, ...safe } = account;
  return safe;
}
