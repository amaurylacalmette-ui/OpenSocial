'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { Users, Eye, Heart, MousePointerClick, Trophy } from 'lucide-react';
import { PlatformAvatar } from './platform-icon';
import { platformName } from '@/lib/platforms';
import { format } from 'date-fns';
import type { Analytics } from '@/lib/types';
import { useOS } from '@/lib/store';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(Math.round(n));
}

export function AnalyticsView() {
  const { accounts } = useOS();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((j) => setData(j))
      .finally(() => setLoading(false));
  }, [accounts.length]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  const { totals, growth, platformBreakdown, engagementSeries, topPosts } = data;

  const stats = [
    { label: 'Followers', value: fmt(totals.followers), sub: `${totals.connectedAccounts} accounts`, icon: Users, tint: 'text-violet-500 bg-violet-500/10' },
    { label: 'Impressions', value: fmt(totals.impressions), sub: 'all published posts', icon: Eye, tint: 'text-fuchsia-500 bg-fuchsia-500/10' },
    { label: 'Engagements', value: fmt(totals.engagements), sub: `${totals.engagementRate.toFixed(1)}% of impressions`, icon: Heart, tint: 'text-rose-500 bg-rose-500/10' },
    { label: 'Link clicks', value: fmt(totals.clicks), sub: `${totals.posts} posts published`, icon: MousePointerClick, tint: 'text-emerald-500 bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border bg-card/70">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[19px] font-bold leading-tight tracking-tight">{s.value}</div>
                <div className="truncate text-[12px] text-muted-foreground">{s.label} · {s.sub}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold">Engagement — last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {engagementSeries.length === 0 ? (
                <Empty text="Publish posts to see engagement trends." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={engagementSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => format(new Date(d), 'MMM d')} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => fmt(Number(v))} />
                    <RTooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} formatter={(v, k) => [fmt(Number(v)), String(k)]} labelFormatter={(d) => format(new Date(String(d)), 'MMM d, yyyy')} />
                    <Bar dataKey="engagements" fill="oklch(0.62 0.24 295)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold">Impressions trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {engagementSeries.length === 0 ? (
                <Empty text="No impression data yet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engagementSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => format(new Date(d), 'MMM d')} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => fmt(Number(v))} />
                    <RTooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} formatter={(v) => [fmt(Number(v)), 'Impressions']} labelFormatter={(d) => format(new Date(String(d)), 'MMM d, yyyy')} />
                    <Line type="monotone" dataKey="impressions" stroke="oklch(0.66 0.22 340)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold">Platform performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {platformBreakdown.map((p) => {
              const maxImp = Math.max(...platformBreakdown.map((x) => x.impressions), 1);
              const rate = p.impressions > 0 ? (p.engagements / p.impressions) * 100 : 0;
              return (
                <div key={p.platform} className="flex items-center gap-3">
                  <PlatformAvatar platform={p.platform} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between text-[12.5px]">
                      <span className="font-medium">{platformName(p.platform)}</span>
                      <span className="text-muted-foreground">
                        {fmt(p.impressions)} impressions · <span className="font-medium text-foreground">{rate.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${(p.impressions / maxImp) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {platformBreakdown.length === 0 && <Empty text="Link accounts and publish to compare platforms." />}
          </CardContent>
        </Card>

        <Card className="border bg-card/70">
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <CardTitle className="text-[14px] font-semibold">Top performing posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topPosts.length === 0 && <Empty text="No published posts yet." />}
            {topPosts.map((p, i) => (
              <div key={p.id} className="flex items-start gap-3 rounded-lg border bg-background/40 p-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] leading-snug">{p.content}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
                    <span className="flex -space-x-1">{p.platforms.map((pl) => <PlatformAvatar key={pl} platform={pl} size="sm" className="h-4 w-4 ring-1 ring-background" />)}</span>
                    <span>{fmt(p.impressions)} impressions</span>
                    <span>{fmt(p.likes)} likes</span>
                    <span className="font-medium text-emerald-500">{p.engagementRate.toFixed(1)}%</span>
                    {p.publishedAt && <span>{format(new Date(p.publishedAt), 'MMM d')}</span>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-6 text-center text-[13px] text-muted-foreground">
      {text}
    </div>
  );
}
