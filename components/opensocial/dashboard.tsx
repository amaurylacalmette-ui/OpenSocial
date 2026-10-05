'use client';

import { useMemo } from 'react';
import { useOS } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Eye, Heart, Send, PenLine, Zap, Sparkles, Link2, TrendingUp, ArrowUpRight, Clock } from 'lucide-react';
import { PlatformAvatar } from './platform-icon';
import { platformName } from '@/lib/platforms';
import { formatDistanceToNow, format } from 'date-fns';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export function Dashboard() {
  const { accounts, posts, loading, setView, setComposerSeed } = useOS();

  const totals = useMemo(() => {
    const followers = accounts.reduce((s, a) => s + a.followers, 0);
    const published = posts.filter((p) => p.status === 'published');
    const scheduled = posts.filter((p) => p.status === 'scheduled' || p.status === 'queued');
    const impressions = published.reduce((s, p) => s + p.targets.reduce((x, t) => x + t.impressions, 0), 0);
    const engagements = published.reduce((s, p) => s + p.targets.reduce((x, t) => x + t.likes + t.comments + t.shares, 0), 0);
    const rate = impressions > 0 ? (engagements / impressions) * 100 : 0;
    return { followers, impressions, engagements, rate, published: published.length, scheduled: scheduled.length };
  }, [accounts, posts]);

  const perPlatform = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of accounts) map.set(a.platform, (map.get(a.platform) ?? 0) + a.followers);
    const arr = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const max = arr[0]?.[1] ?? 1;
    return arr.map(([platform, followers]) => ({ platform, followers, pct: (followers / max) * 100 }));
  }, [accounts]);

  const upcoming = useMemo(
    () =>
      posts
        .filter((p) => p.status === 'scheduled' || p.status === 'queued')
        .sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime())
        .slice(0, 4),
    [posts]
  );

  const recent = useMemo(
    () => posts.filter((p) => p.status === 'published').sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()).slice(0, 4),
    [posts]
  );

  const stats = [
    { label: 'Total audience', value: fmt(totals.followers), icon: Users, tint: 'text-violet-500 bg-violet-500/10', delta: `${accounts.length} platforms` },
    { label: 'Impressions', value: fmt(totals.impressions), icon: Eye, tint: 'text-fuchsia-500 bg-fuchsia-500/10', delta: 'all time' },
    { label: 'Engagements', value: fmt(totals.engagements), icon: Heart, tint: 'text-rose-500 bg-rose-500/10', delta: `${totals.rate.toFixed(1)}% rate` },
    { label: 'Published', value: String(totals.published), icon: Send, tint: 'text-emerald-500 bg-emerald-500/10', delta: `${totals.scheduled} in queue` },
  ];

  if (loading && accounts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
        <Skeleton className="h-[260px] rounded-xl" />
      </div>
    );
  }

  const isEmpty = accounts.length === 0 && posts.length === 0;

  return (
    <div className="space-y-5">
      {isEmpty && (
        <Card className="overflow-hidden border bg-card/70">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <h2 className="text-[20px] font-bold tracking-tight">Welcome to your workspace</h2>
                <p className="mt-1 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
                  Everything here starts empty — no demo accounts, no fake numbers. Connect a profile and publish your first post to bring the dashboard to life.
                </p>
              </div>
              <Button className="h-9 shrink-0 gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500" onClick={() => setView('accounts')}>
                <Link2 className="h-4 w-4" /> Link your first account
              </Button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { n: '1', icon: Link2, title: 'Link accounts', text: 'Connect the profiles you post to. Turn on cross-posting per account.', onClick: () => setView('accounts') },
                { n: '2', icon: PenLine, title: 'Compose & publish', text: 'One composer, every platform. Schedule it or send it now.', onClick: () => { setComposerSeed(null); setView('composer'); } },
                { n: '3', icon: Zap, title: 'Automate', text: 'Rules like “X → Threads & Bluesky” repost automatically after a delay.', onClick: () => setView('automations') },
              ].map((s) => (
                <button key={s.n} onClick={s.onClick} className="group rounded-lg border bg-background/40 p-4 text-left transition-colors hover:border-violet-500/40 hover:bg-accent/40">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 text-[12px] font-bold text-violet-500">{s.n}</span>
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2.5 text-[13px] font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{s.text}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="h-8 gap-1.5 rounded-lg" onClick={() => { setComposerSeed(null); setView('composer'); }}>
          <PenLine className="h-3.5 w-3.5" /> Compose
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg" onClick={() => setView('accounts')}>
          <Link2 className="h-3.5 w-3.5" /> Link account
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg" onClick={() => setView('automations')}>
          <Zap className="h-3.5 w-3.5" /> New automation
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg" onClick={() => setView('ai')}>
          <Sparkles className="h-3.5 w-3.5" /> Ask AI
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border bg-card/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[19px] font-bold leading-tight tracking-tight">{s.value}</div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {s.label} · <span className="text-muted-foreground/80">{s.delta}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Audience chart */}
        <Card className="border bg-card/70 lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[14px] font-semibold">Audience growth</CardTitle>
            <span className="flex items-center gap-1 text-[11.5px] text-emerald-500">
              <TrendingUp className="h-3.5 w-3.5" /> tracked live
            </span>
          </CardHeader>
          <CardContent className="pl-0 pr-4">
            <GrowthChart />
          </CardContent>
        </Card>

        {/* Platform distribution */}
        <Card className="border bg-card/70 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold">Audience by platform</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {perPlatform.length === 0 && <p className="text-[13px] text-muted-foreground">Link an account to see distribution.</p>}
            {perPlatform.map((p) => (
              <div key={p.platform} className="flex items-center gap-2.5">
                <PlatformAvatar platform={p.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between text-[12px]">
                    <span className="font-medium">{platformName(p.platform)}</span>
                    <span className="text-muted-foreground">{fmt(p.followers)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.pct}%`,
                        background: 'linear-gradient(90deg, oklch(0.62 0.24 295), oklch(0.66 0.22 340))',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming */}
        <Card className="border bg-card/70">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-[14px] font-semibold">Upcoming queue</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-[12px] text-muted-foreground" onClick={() => setView('posts')}>
              View all <ArrowUpRight className="ml-0.5 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {upcoming.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-[13px] text-muted-foreground">
                Nothing scheduled. <button className="text-primary hover:underline" onClick={() => setView('composer')}>Write a post</button>
              </div>
            )}
            {upcoming.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-lg border bg-background/40 p-3">
                <div className="flex -space-x-1.5 pt-0.5">
                  {[...new Set(p.targets.map((t) => t.platform))].slice(0, 3).map((pl) => (
                    <PlatformAvatar key={pl} platform={pl} size="sm" className="ring-2 ring-background" />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[13px] font-medium">{p.content}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {p.scheduledAt ? format(new Date(p.scheduledAt), 'MMM d, HH:mm') : 'queued'}
                    {p.source === 'automation' && <span className="ml-1 rounded bg-violet-500/15 px-1.5 py-px text-[10px] font-medium text-violet-400">auto</span>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent published */}
        <Card className="border bg-card/70">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-[14px] font-semibold">Recently published</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-[12px] text-muted-foreground" onClick={() => setView('analytics')}>
              Analytics <ArrowUpRight className="ml-0.5 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recent.length === 0 && <p className="text-[13px] text-muted-foreground">No published posts yet.</p>}
            {recent.map((p) => {
              const likes = p.targets.reduce((s, t) => s + t.likes, 0);
              const impressions = p.targets.reduce((s, t) => s + t.impressions, 0);
              return (
                <div key={p.id} className="flex items-start gap-3 rounded-lg border bg-background/40 p-3">
                  <div className="flex -space-x-1.5 pt-0.5">
                    {[...new Set(p.targets.map((t) => t.platform))].slice(0, 3).map((pl) => (
                      <PlatformAvatar key={pl} platform={pl} size="sm" className="ring-2 ring-background" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-medium">{p.content}</p>
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {format(new Date(p.publishedAt ?? Date.now()), 'MMM d')} · {fmt(impressions)} impressions · {fmt(likes)} likes
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Live growth chart pulled from the analytics API (cached server-side)
import { useEffect, useState } from 'react';

function GrowthChart() {
  const [data, setData] = useState<{ date: string; followers: number }[] | null>(null);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((j) => setData(j.growth ?? []))
      .catch(() => setData([]));
  }, []);

  if (data === null) return <Skeleton className="h-[240px] w-full rounded-lg" />;

  if (data.length < 2) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-center">
        <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
        <p className="text-[13px] font-medium text-muted-foreground">No growth history yet</p>
        <p className="max-w-[260px] text-[12px] text-muted-foreground/80">
          Follower counts are tracked from the moment accounts are linked — check back after your first posts.
        </p>
      </div>
    );
  }

  const step = Math.max(1, Math.floor(data.length / 45));
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sampled} margin={{ top: 12, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="grow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.62 0.24 295)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="oklch(0.62 0.24 295)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(d: string) => format(new Date(d), 'MMM d')}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => fmt(v)} domain={['dataMin - 500', 'dataMax + 500']} />
          <RTooltip
            contentStyle={{ borderRadius: 10, border: '1px solid', fontSize: 12 }}
            labelFormatter={(d) => format(new Date(String(d)), 'MMM d, yyyy')}
            formatter={(v) => [fmt(Number(v)), 'Followers']}
          />
          <Area type="monotone" dataKey="followers" stroke="oklch(0.62 0.24 295)" strokeWidth={2} fill="url(#grow)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
