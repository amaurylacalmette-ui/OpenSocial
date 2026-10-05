import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/reset — wipes all workspace data (accounts, posts, snapshots,
 * automations, chat history). AI provider keys are kept unless `keys: true`.
 */
export async function POST(req: Request) {
  let clearKeys = false;
  try {
    const body = await req.json();
    clearKeys = Boolean(body?.keys);
  } catch {
    /* no body — defaults */
  }

  await db.postTarget.deleteMany();
  await db.post.deleteMany();
  await db.followerSnapshot.deleteMany();
  await db.automation.deleteMany();
  await db.chatMessage.deleteMany();
  await db.socialAccount.deleteMany();
  if (clearKeys) {
    await db.setting.deleteMany();
  }

  return NextResponse.json({ ok: true });
}
