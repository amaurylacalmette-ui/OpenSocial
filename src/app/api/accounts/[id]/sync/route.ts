import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter, PlatformError } from '@/lib/adapters';
import type { Credentials } from '@/lib/adapters';

/**
 * Re-verifies a connected account against the live platform API and syncs
 * whatever it really reports: display name, follower count, status.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await db.socialAccount.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const adapter = getAdapter(account.platform);
  if (!adapter) return NextResponse.json({ error: `No integration for ${account.platform}` }, { status: 400 });

  let creds: Credentials;
  try {
    creds = JSON.parse(account.credentials ?? '{}') as Credentials;
  } catch {
    await db.socialAccount.update({ where: { id }, data: { status: 'expired' } });
    return NextResponse.json({ error: 'Stored credentials are corrupt — reconnect this account.' }, { status: 400 });
  }

  try {
    const profile = await adapter.verify(creds);
    const updated = await db.socialAccount.update({
      where: { id },
      data: {
        displayName: profile.displayName || account.displayName,
        followers: profile.followers ?? account.followers,
        remoteId: profile.remoteId ?? account.remoteId,
        remoteUrl: profile.remoteUrl ?? account.remoteUrl,
        verifiedAt: new Date(),
        status: 'connected',
      },
    });

    // Snapshot only when the platform reported a real change
    if (profile.followers !== null && profile.followers !== account.followers) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const existing = await db.followerSnapshot.findUnique({
        where: { accountId_date: { accountId: id, date: startOfDay } },
      });
      if (existing) {
        await db.followerSnapshot.update({ where: { id: existing.id }, data: { followers: profile.followers } });
      } else {
        await db.followerSnapshot.create({ data: { accountId: id, date: new Date(), followers: profile.followers } });
      }
    }

    const { credentials: _c, ...safe } = updated;
    return NextResponse.json({ account: safe });
  } catch (e) {
    const status = e instanceof PlatformError ? e.status : undefined;
    const message = e instanceof Error ? e.message : 'Sync failed';
    if (status === 401 || status === 403) {
      await db.socialAccount.update({ where: { id }, data: { status: 'expired' } });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
