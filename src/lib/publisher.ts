/**
 * Publish engine — real delivery.
 *
 * Every target goes through its platform adapter and hits the platform's
 * live API. Outcomes are honest: published targets carry the platform's
 * real post id/permalink, failed targets carry the platform's real error
 * message. No engagement number is ever generated here — metrics arrive
 * through /api/metrics/sync, which pulls what platforms actually expose.
 */
import { db } from '@/lib/db';
import { getAdapter, PlatformError, type Credentials } from '@/lib/adapters';

const EXPIRED_HINT = 'Credentials were rejected by the platform — reconnect the account in Accounts.';

interface TargetWithAccount {
  id: string;
  platform: string;
  content: string | null;
  account: {
    id: string;
    platform: string;
    username: string;
    status: string;
    credentials: string | null;
  };
}

async function deliverToTarget(target: TargetWithAccount, text: string, mediaUrl: string | null): Promise<'published' | 'failed'> {
  const account = target.account;
  const adapter = getAdapter(account.platform);

  if (account.status === 'expired') {
    await db.postTarget.update({ where: { id: target.id }, data: { status: 'failed', error: EXPIRED_HINT } });
    return 'failed';
  }
  if (!adapter) {
    await db.postTarget.update({ where: { id: target.id }, data: { status: 'failed', error: `No integration available for ${account.platform}.` } });
    return 'failed';
  }
  if (!adapter.deliver) {
    await db.postTarget.update({
      where: { id: target.id },
      data: { status: 'failed', error: `${account.platform} does not support API publishing — the account stays connected for analytics sync.` },
    });
    return 'failed';
  }

  let creds: Credentials = {};
  try {
    creds = JSON.parse(account.credentials ?? '{}') as Credentials;
  } catch {
    await db.postTarget.update({ where: { id: target.id }, data: { status: 'failed', error: 'Stored credentials are corrupt — reconnect the account.' } });
    return 'failed';
  }

  try {
    const result = await adapter.deliver(creds, text, mediaUrl, account.username);
    await db.postTarget.update({
      where: { id: target.id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        remoteId: result.remoteId,
        remoteUrl: result.remoteUrl,
        error: null,
      },
    });
    return 'published';
  } catch (e) {
    const status = e instanceof PlatformError ? e.status : undefined;
    const message = e instanceof Error ? e.message : 'Unknown delivery error';
    await db.postTarget.update({ where: { id: target.id }, data: { status: 'failed', error: message.slice(0, 500) } });
    if (status === 401 || status === 403) {
      await db.socialAccount.update({ where: { id: account.id }, data: { status: 'expired' } });
    }
    return 'failed';
  }
}

/**
 * Publishes a post for real, then fires any enabled automations that match
 * one of the post's platforms. Automation-derived posts go through the same
 * real delivery path (one hop — automations don't cascade into each other).
 */
export async function publishPost(postId: string): Promise<{ ok: boolean; triggered: string[]; published: number; failed: number; errors: { platform: string; error: string }[] }> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { targets: { include: { account: true } } },
  });
  if (!post) return { ok: false, triggered: [], published: 0, failed: 0, errors: [] };

  const now = new Date();
  const mediaUrl = post.mediaUrl ?? null;
  let publishedCount = 0;
  let failedCount = 0;
  const errors: { platform: string; error: string }[] = [];

  // Sequential — gentler on platform rate limits, and each target reports its own real outcome.
  for (const t of post.targets) {
    if (t.status === 'published') {
      publishedCount++;
      continue;
    }
    const outcome = await deliverToTarget(t as TargetWithAccount, t.content ?? post.content, mediaUrl);
    if (outcome === 'published') {
      publishedCount++;
    } else {
      failedCount++;
      const fresh = await db.postTarget.findUnique({ where: { id: t.id }, select: { error: true } });
      if (fresh?.error) errors.push({ platform: t.platform, error: fresh.error });
    }
  }

  if (publishedCount > 0) {
    await db.post.update({ where: { id: post.id }, data: { status: 'published', publishedAt: now } });
  } else if (post.targets.length > 0) {
    await db.post.update({ where: { id: post.id }, data: { status: 'failed' } });
  }

  // Fire automations (only for composer/ai-originated posts — no cascades)
  const triggered: string[] = [];
  const summary = { ok: publishedCount > 0, triggered, published: publishedCount, failed: failedCount, errors };
  if (post.source === 'automation') return summary;

  const automations = await db.automation.findMany({ where: { enabled: true } });
  const sourcePlatforms = [...new Set(post.targets.map((t) => t.platform))];

  for (const auto of automations) {
    if (!sourcePlatforms.includes(auto.sourcePlatform)) continue;
    let targetPlatforms: string[] = [];
    try { targetPlatforms = JSON.parse(auto.targetPlatforms); } catch { continue; }
    const newPlatforms = targetPlatforms.filter((p) => !sourcePlatforms.includes(p));
    if (newPlatforms.length === 0) continue;

    const accounts = await db.socialAccount.findMany({
      where: { platform: { in: newPlatforms }, status: 'connected', autoPost: true },
    });
    if (accounts.length === 0) continue;

    const fireAt = new Date(now.getTime() + auto.delayMinutes * 60000);
    const derivedContent = auto.template ? `${post.content}\n\n${auto.template.replace('{source}', auto.sourcePlatform)}` : post.content;

    const created = await db.post.create({
      data: {
        content: derivedContent,
        mediaUrl: post.mediaUrl,
        status: 'queued',
        scheduledAt: auto.delayMinutes > 0 ? fireAt : now,
        source: 'automation',
        automationId: auto.id,
        targets: {
          create: accounts.map((acc) => ({
            accountId: acc.id,
            platform: acc.platform,
            content: derivedContent,
            status: 'pending',
          })),
        },
      },
    });
    await db.automation.update({ where: { id: auto.id }, data: { runs: { increment: 1 } } });
    triggered.push(auto.name);

    // Zero-delay automations deliver immediately through the real adapters
    if (auto.delayMinutes === 0) {
      await publishPost(created.id);
    }
  }

  return summary;
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
