import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const accounts = await db.socialAccount.findMany();
  const targets = await db.postTarget.findMany({ where: { status: 'published' } });
  const posts = await db.post.findMany({
    where: { status: 'published' },
    include: { targets: true },
    orderBy: { publishedAt: 'desc' },
  });
  const snapshots = await db.followerSnapshot.findMany({
    orderBy: { date: 'asc' },
  });

  const totalFollowers = accounts.reduce((s, a) => s + a.followers, 0);
  const impressions = targets.reduce((s, t) => s + t.impressions, 0);
  const likes = targets.reduce((s, t) => s + t.likes, 0);
  const comments = targets.reduce((s, t) => s + t.comments, 0);
  const shares = targets.reduce((s, t) => s + t.shares, 0);
  const clicks = targets.reduce((s, t) => s + t.clicks, 0);
  const engagements = likes + comments + shares;

  // Follower growth series (total across platforms, daily)
  const byDate = new Map<string, number>();
  for (const snap of snapshots) {
    const key = snap.date.toISOString().slice(0, 10);
    byDate.set(key, (byDate.get(key) ?? 0) + snap.followers);
  }
  const growth = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, followers]) => ({ date, followers }));

  // Platform breakdown
  const platformMap = new Map<string, { platform: string; followers: number; impressions: number; engagements: number; posts: number }>();
  for (const acc of accounts) {
    const e = platformMap.get(acc.platform) ?? { platform: acc.platform, followers: 0, impressions: 0, engagements: 0, posts: 0 };
    e.followers += acc.followers;
    platformMap.set(acc.platform, e);
  }
  for (const t of targets) {
    const e = platformMap.get(t.platform);
    if (e) {
      e.impressions += t.impressions;
      e.engagements += t.likes + t.comments + t.shares;
      e.posts += 1;
    }
  }
  const platformBreakdown = [...platformMap.values()].sort((a, b) => b.followers - a.followers);

  // Engagement over last 30 days
  const engageByDate = new Map<string, { date: string; engagements: number; impressions: number }>();
  for (const t of targets) {
    if (!t.publishedAt) continue;
    const key = t.publishedAt.toISOString().slice(0, 10);
    const cur = engageByDate.get(key) ?? { date: key, engagements: 0, impressions: 0 };
    cur.engagements += t.likes + t.comments + t.shares;
    cur.impressions += t.impressions;
    engageByDate.set(key, cur);
  }
  const engagementSeries = [...engageByDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);

  // Top posts by engagement
  const topPosts = posts
    .map((p) => {
      const likes_ = p.targets.reduce((s, t) => s + t.likes, 0);
      const comments_ = p.targets.reduce((s, t) => s + t.comments, 0);
      const shares_ = p.targets.reduce((s, t) => s + t.shares, 0);
      const impressions_ = p.targets.reduce((s, t) => s + t.impressions, 0);
      return {
        id: p.id,
        content: p.content.slice(0, 140),
        platforms: [...new Set(p.targets.map((t) => t.platform))],
        publishedAt: p.publishedAt,
        likes: likes_,
        comments: comments_,
        shares: shares_,
        impressions: impressions_,
        engagementRate: impressions_ > 0 ? ((likes_ + comments_ + shares_) / impressions_) * 100 : 0,
      };
    })
    .sort((a, b) => b.likes + b.comments + b.shares - (a.likes + a.comments + a.shares))
    .slice(0, 6);

  return NextResponse.json({
    totals: {
      followers: totalFollowers,
      impressions,
      engagements,
      clicks,
      posts: posts.length,
      engagementRate: impressions > 0 ? (engagements / impressions) * 100 : 0,
      connectedAccounts: accounts.length,
    },
    growth,
    platformBreakdown,
    engagementSeries,
    topPosts,
  });
}
