import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const accounts = await db.socialAccount.findMany({
    orderBy: { connectedAt: 'asc' },
    include: { _count: { select: { targets: true } } },
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { platform, username, displayName, avatarColor } = body;
  if (!platform || !username) {
    return NextResponse.json({ error: 'platform and username are required' }, { status: 400 });
  }
  const existing = await db.socialAccount.findUnique({
    where: { platform_username: { platform, username } },
  });
  if (existing) {
    return NextResponse.json({ error: 'This account is already connected' }, { status: 409 });
  }
  // Followers default to 0 until real data is available (OAuth sync or manual entry).
  // If the user provides a current count, it becomes the first snapshot — the
  // baseline growth is tracked from here on, nothing is back-filled.
  const followers = Math.max(0, Math.floor(Number(body.followers) || 0));
  const account = await db.socialAccount.create({
    data: {
      platform,
      username,
      displayName: displayName || username,
      avatarColor: avatarColor || '#7c3aed',
      followers,
      status: 'connected',
    },
  });
  if (followers > 0) {
    await db.followerSnapshot.create({
      data: { accountId: account.id, date: new Date(), followers },
    });
  }
  return NextResponse.json({ account }, { status: 201 });
}
