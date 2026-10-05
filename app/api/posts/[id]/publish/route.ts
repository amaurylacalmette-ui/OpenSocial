import { NextRequest, NextResponse } from 'next/server';
import { publishPost } from '@/lib/publisher';
import { db } from '@/lib/db';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (post.status === 'published') {
    return NextResponse.json({ error: 'Already published' }, { status: 409 });
  }
  const result = await publishPost(id);
  return NextResponse.json(result);
}
