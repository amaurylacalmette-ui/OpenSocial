import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter, PlatformError } from '@/lib/adapters';
import { PLATFORMS, type PlatformId } from '@/lib/platforms';
import type { Credentials } from '@/lib/adapters';

export async function GET() {
  const accounts = await db.socialAccount.findMany({
    orderBy: { connectedAt: 'asc' },
    include: { _count: { select: { targets: true } } },
  });
  // Credentials never leave the server.
  return NextResponse.json({ accounts: accounts.map(({ credentials: _c, ...rest }) => rest) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { platform, credentials } = body as { platform?: string; credentials?: Record<string, string> };

  if (!platform || !(platform in PLATFORMS)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
  }
  const adapter = getAdapter(platform);
  if (!adapter) {
    return NextResponse.json({ error: `No integration available for ${platform}` }, { status: 400 });
  }
  if (!credentials || typeof credentials !== 'object') {
    return NextResponse.json({ error: 'Credentials are required — every connection is verified against the live platform API.' }, { status: 400 });
  }
  for (const [k, v] of Object.entries(credentials)) {
    if (typeof v !== 'string') return NextResponse.json({ error: 'Invalid credential payload' }, { status: 400 });
  }

  // Live verification — the platform's real answer decides whether the account connects.
  let profile;
  try {
    profile = await adapter.verify(credentials as Credentials);
  } catch (e) {
    const msg = e instanceof PlatformError || e instanceof Error ? e.message : 'Verification failed';
    return NextResponse.json({ error: `${PLATFORMS[platform as PlatformId].name}: ${msg}` }, { status: 400 });
  }

  const username = profile.username.replace(/^@/, '').trim();
  const existing = await db.socialAccount.findUnique({
    where: { platform_username: { platform, username } },
  });
  if (existing) {
    return NextResponse.json({ error: 'This account is already connected' }, { status: 409 });
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
  return NextResponse.json({ account: safe }, { status: 201 });
}
