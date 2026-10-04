import { db } from '@/lib/db';

function metricsFor(platform: string, followers: number) {
  const rate = { x: 0.04, instagram: 0.06, tiktok: 0.11, linkedin: 0.03, threads: 0.05, bluesky: 0.05, youtube: 0.08, facebook: 0.02, mastodon: 0.04, pinterest: 0.03, reddit: 0.06 }[platform] ?? 0.04;
  const impressions = Math.max(120, Math.floor(followers * rate * 8 * (0.5 + Math.random())));
  return {
    impressions,
    likes: Math.floor(impressions * rate * (0.7 + Math.random() * 0.6)),
    comments: Math.floor(impressions * rate * (0.04 + Math.random() * 0.1)),
    shares: Math.floor(impressions * rate * (0.05 + Math.random() * 0.15)),
    clicks: Math.floor(impressions * (0.008 + Math.random() * 0.02)),
  };
}

/**
 * Publishes a post: marks targets published with simulated delivery metrics,
 * then fires any enabled automations that match one of the post's platforms.
 */
export async function publishPost(postId: string): Promise<{ ok: boolean; triggered: string[] }> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { targets: { include: { account: true } } },
  });
  if (!post) return { ok: false, triggered: [] };

  const now = new Date();
  await Promise.all(
    post.targets.map((t) =>
      db.postTarget.update({
        where: { id: t.id },
        data: {
          status: 'published',
          publishedAt: now,
          ...metricsFor(t.platform, t.account.followers),
        },
      })
    )
  );
  await db.post.update({
    where: { id: post.id },
    data: { status: 'published', publishedAt: now },
  });

  // Fire automations
  const triggered: string[] = [];
  const automations = await db.automation.findMany({ where: { enabled: true } });
  const sourcePlatforms = [...new Set(post.targets.map((t) => t.platform))];

  for (const auto of automations) {
    if (!sourcePlatforms.includes(auto.sourcePlatform)) continue;
    let targetPlatforms: string[] = [];
    try { targetPlatforms = JSON.parse(auto.targetPlatforms); } catch { continue; }
    // Skip platforms the post already went to
    const newPlatforms = targetPlatforms.filter((p) => !sourcePlatforms.includes(p));
    if (newPlatforms.length === 0) continue;

    const accounts = await db.socialAccount.findMany({
      where: { platform: { in: newPlatforms }, status: 'connected', autoPost: true },
    });
    if (accounts.length === 0) continue;

    const fireAt = new Date(now.getTime() + auto.delayMinutes * 60000);
    const derivedContent = auto.template ? `${post.content}\n\n${auto.template.replace('{source}', auto.sourcePlatform)}` : post.content;

    await db.post.create({
      data: {
        content: derivedContent,
        status: auto.delayMinutes > 0 ? 'queued' : 'published',
        scheduledAt: auto.delayMinutes > 0 ? fireAt : now,
        publishedAt: auto.delayMinutes > 0 ? null : now,
        source: 'automation',
        automationId: auto.id,
        targets: {
          create: accounts.map((acc) => ({
            accountId: acc.id,
            platform: acc.platform,
            status: auto.delayMinutes > 0 ? 'pending' : 'published',
            publishedAt: auto.delayMinutes > 0 ? null : now,
            ...(auto.delayMinutes > 0 ? {} : metricsFor(acc.platform, acc.followers)),
          })),
        },
      },
    });

    await db.automation.update({ where: { id: auto.id }, data: { runs: { increment: 1 } } });
    triggered.push(auto.name);
  }

  return { ok: true, triggered };
}

/** Publishes any queued/scheduled posts that are due. Called by the client worker + on demand. */
export async function processDuePosts(): Promise<number> {
  const due = await db.post.findMany({
    where: {
      status: { in: ['queued', 'scheduled'] },
      scheduledAt: { lte: new Date() },
    },
    select: { id: true },
  });
  for (const p of due) {
    await publishPost(p.id);
  }
  return due.length;
}
