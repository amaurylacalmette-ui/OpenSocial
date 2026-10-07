import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const automations = await db.automation.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({
    automations: automations.map((a) => ({ ...a, targetPlatforms: JSON.parse(a.targetPlatforms) })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, sourcePlatform, targetPlatforms, delayMinutes, template, enabled } = body;
  if (!name || !sourcePlatform || !Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
    return NextResponse.json({ error: 'name, sourcePlatform and targetPlatforms are required' }, { status: 400 });
  }
  const automation = await db.automation.create({
    data: {
      name,
      sourcePlatform,
      targetPlatforms: JSON.stringify(targetPlatforms),
      delayMinutes: Number(delayMinutes) || 0,
      template: template || null,
      enabled: enabled ?? true,
    },
  });
  return NextResponse.json({ automation: { ...automation, targetPlatforms: JSON.parse(automation.targetPlatforms) } }, { status: 201 });
}
