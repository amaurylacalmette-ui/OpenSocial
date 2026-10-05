import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  if (typeof body.autoPost === 'boolean') allowed.autoPost = body.autoPost;
  if (typeof body.displayName === 'string') allowed.displayName = body.displayName;
  if (typeof body.status === 'string') allowed.status = body.status;
  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }
  const account = await db.socialAccount.update({ where: { id }, data: allowed });
  const { credentials: _c, ...safe } = account;
  return NextResponse.json({ account: safe });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.socialAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
