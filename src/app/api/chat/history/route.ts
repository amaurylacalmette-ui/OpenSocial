import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const messages = await db.chatMessage.findMany({ orderBy: { createdAt: 'asc' }, take: 200 });
  return NextResponse.json({ messages });
}

export async function DELETE() {
  await db.chatMessage.deleteMany({});
  return NextResponse.json({ ok: true });
}
