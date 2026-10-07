import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status');
  const posts = await db.post.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    include: { targets: { include: { account: true } } },
    take: 100,
  });
  return NextResponse.json({ posts });
}

interface TargetInput {
  accountId: string;
  platform: string;
  content?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { content, targets, scheduledAt, mediaUrl, status } = body as {
    content: string;
    targets: TargetInput[];
    scheduledAt?: string | null;
    mediaUrl?: string | null;
    status?: string;
  };
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }
  if (!targets?.length) {
    return NextResponse.json({ error: 'Select at least one account' }, { status: 400 });
  }
  const accounts = await db.socialAccount.findMany({
    where: { id: { in: targets.map((t) => t.accountId) } },
  });
  const valid = targets.filter((t) => accounts.some((a) => a.id === t.accountId && a.platform === t.platform));
  if (valid.length === 0) {
    return NextResponse.json({ error: 'No valid targets' }, { status: 400 });
  }
  const post = await db.post.create({
    data: {
      content: content.trim(),
      mediaUrl: mediaUrl || null,
      status: status === 'draft' ? 'draft' : scheduledAt ? 'scheduled' : 'queued',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      targets: {
        create: valid.map((t) => ({
          accountId: t.accountId,
          platform: t.platform,
          content: t.content?.trim() || null,
          status: 'pending',
        })),
      },
    },
    include: { targets: { include: { account: true } } },
  });
  // Publish immediately when no schedule given
  if (!scheduledAt && status !== 'draft') {
    const { publishPost } = await import('@/lib/publisher');
    await publishPost(post.id);
  }
  const fresh = await db.post.findUnique({
    where: { id: post.id },
    include: { targets: { include: { account: true } } },
  });
  return NextResponse.json({ post: fresh }, { status: 201 });
}
