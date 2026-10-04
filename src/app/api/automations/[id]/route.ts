import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
  if (typeof body.name === 'string') data.name = body.name;
  if (typeof body.delayMinutes === 'number') data.delayMinutes = body.delayMinutes;
  if (Array.isArray(body.targetPlatforms)) data.targetPlatforms = JSON.stringify(body.targetPlatforms);
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }
  const automation = await db.automation.update({ where: { id }, data });
  return NextResponse.json({ automation: { ...automation, targetPlatforms: JSON.parse(automation.targetPlatforms) } });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.automation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
