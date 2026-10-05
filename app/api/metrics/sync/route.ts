import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter } from '@/lib/adapters';
import type { Credentials } from '@/lib/adapters';

/**
 * Pulls real engagement numbers for published posts from the platforms that
 * expose them (Bluesky, Mastodon, X, Threads, Reddit). Platforms without a
 * public engagement endpoint are skipped — nothing is estimated.
 */
export async function POST() {
  const targets = await db.postTarget.findMany({
    where: { status: 'published', remoteId: { not: null } },
    include: { account: true },
    orderBy: { publishedAt: 'desc' },
    take: 60,
  });

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of targets) {
    if (synced >= 30) { skipped++; continue; }
    const adapter = getAdapter(target.account.platform);
    if (!adapter?.fetchMetrics) { skipped++; continue; }

    let creds: Credentials;
    try {
      creds = JSON.parse(target.account.credentials ?? '{}') as Credentials;
    } catch { skipped++; continue; }

    try {
      const metrics = await adapter.fetchMetrics(creds, target.remoteId!);
      await db.postTarget.update({
        where: { id: target.id },
        data: {
          likes: metrics.likes ?? target.likes,
          comments: metrics.comments ?? target.comments,
          shares: metrics.shares ?? target.shares,
          impressions: metrics.impressions ?? target.impressions,
          clicks: metrics.clicks ?? target.clicks,
        },
      });
      synced++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ synced, skipped, failed });
}
