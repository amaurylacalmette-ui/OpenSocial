'use client';

import { useMemo, useState } from 'react';
import { useOS } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Send, Trash2, Loader2, Clock, PenLine, Zap, Copy } from 'lucide-react';
import { PlatformAvatar } from './platform-icon';
import { platformName } from '@/lib/platforms';
import { format, formatDistanceToNow } from 'date-fns';
import type { Post } from '@/lib/types';
import { cn } from '@/lib/utils';

export function PostsView() {
  const { posts, loading, loadAll, setComposerSeed, setView } = useOS();
  const [busyId, setBusyId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const now = Date.now();
    const scheduled = posts.filter((p) => p.status === 'scheduled' || (p.status === 'queued' && new Date(p.scheduledAt ?? 0).getTime() > now));
    const queued = posts.filter((p) => p.status === 'queued');
    const published = posts.filter((p) => p.status === 'published');
    const drafts = posts.filter((p) => p.status === 'draft');
    return { scheduled, queued, published, drafts };
  }, [posts]);

  async function publishNow(post: Post) {
    setBusyId(post.id);
    try {
      const res = await fetch(`/api/posts/${post.id}/publish`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed');
      toast({ title: 'Published', description: j.triggered?.length ? `Automations fired: ${j.triggered.join(', ')}` : 'Sent to all targets' });
      loadAll();
    } catch (e) {
      toast({ title: 'Publish failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(post: Post) {
    setBusyId(post.id);
    try {
      await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
      toast({ title: 'Deleted' });
      loadAll();
    } finally {
      setBusyId(null);
    }
  }

  function duplicate(post: Post) {
    setComposerSeed(post.content);
    setView('composer');
    toast({ title: 'Loaded into composer' });
  }

  const counts = { scheduled: groups.scheduled.length, queued: groups.queued.length, published: groups.published.length, drafts: groups.drafts.length };

  function PostCard({ p, actions }: { p: Post; actions?: 'scheduled' | 'published' | 'draft' | 'queued' }) {
    const platforms = [...new Set(p.targets.map((t) => t.platform))];
    const likes = p.targets.reduce((s, t) => s + t.likes, 0);
    const impressions = p.targets.reduce((s, t) => s + t.impressions, 0);
    const isQueued = p.status === 'queued';
    return (
      <Card className="border bg-card/70">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <div className="flex -space-x-1.5">
                {platforms.slice(0, 4).map((pl) => (
                  <PlatformAvatar key={pl} platform={pl} size="sm" className="ring-2 ring-background" />
                ))}
              </div>
              <span className="ml-1">
                {platforms.map((pl) => platformName(pl)).join(', ')}
              </span>
              {p.source === 'automation' && (
                <Badge variant="outline" className="gap-0.5 border-violet-500/40 bg-violet-500/10 px-1.5 py-0 text-[10px] text-violet-400">
                  <Zap className="h-2.5 w-2.5" /> auto
                </Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 text-[11.5px] text-muted-foreground">
              {p.status === 'published' ? (
                <span>{p.publishedAt ? format(new Date(p.publishedAt), 'MMM d, HH:mm') : ''}</span>
              ) : p.scheduledAt ? (
                <span className={cn(isQueued && 'text-violet-400')}>
                  {formatDistanceToNow(new Date(p.scheduledAt), { addSuffix: true })}
                </span>
              ) : (
                <span>draft</span>
              )}
            </div>
          </div>

          <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed">{p.content}</p>

          {p.status === 'published' && (
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
              <span><b className="text-foreground">{impressions.toLocaleString()}</b> impressions</span>
              <span><b className="text-foreground">{likes.toLocaleString()}</b> likes</span>
              <span><b className="text-foreground">{p.targets.reduce((s, t) => s + t.comments, 0).toLocaleString()}</b> comments</span>
              <span><b className="text-foreground">{p.targets.reduce((s, t) => s + t.shares, 0).toLocaleString()}</b> shares</span>
            </div>
          )}

          <div className="mt-3 flex gap-1.5 border-t pt-3">
            {(actions === 'scheduled' || actions === 'queued') && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={() => publishNow(p)} disabled={busyId === p.id}>
                {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Publish now
              </Button>
            )}
            {actions === 'draft' && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={() => duplicate(p)}>
                <PenLine className="h-3 w-3" /> Open in composer
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-[12px] text-muted-foreground" onClick={() => duplicate(p)}>
              <Copy className="h-3 w-3" /> Reuse
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1 text-[12px] text-destructive hover:text-destructive" onClick={() => remove(p)} disabled={busyId === p.id}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading && posts.length === 0) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>;
  }

  return (
    <Tabs defaultValue="scheduled">
      <TabsList className="mb-4 h-9 bg-muted/60">
        <TabsTrigger value="scheduled" className="gap-1.5 text-[13px]"><Clock className="h-3.5 w-3.5" /> Scheduled ({counts.scheduled})</TabsTrigger>
        <TabsTrigger value="published" className="text-[13px]">Published ({counts.published})</TabsTrigger>
        <TabsTrigger value="drafts" className="text-[13px]">Drafts ({counts.drafts})</TabsTrigger>
      </TabsList>

      <TabsContent value="scheduled" className="space-y-3">
        {groups.scheduled.length === 0 && groups.queued.length === 0 && <EmptyLine text="Nothing scheduled — write something in the composer." />}
        {groups.queued.map((p) => <PostCard key={p.id} p={p} actions="queued" />)}
        {groups.scheduled.map((p) => <PostCard key={p.id} p={p} actions="scheduled" />)}
      </TabsContent>
      <TabsContent value="published" className="space-y-3">
        {groups.published.length === 0 && <EmptyLine text="No published posts yet." />}
        {[...groups.published].sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()).map((p) => <PostCard key={p.id} p={p} actions="published" />)}
      </TabsContent>
      <TabsContent value="drafts" className="space-y-3">
        {groups.drafts.length === 0 && <EmptyLine text="No drafts saved." />}
        {groups.drafts.map((p) => <PostCard key={p.id} p={p} actions="draft" />)}
      </TabsContent>
    </Tabs>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-[13px] text-muted-foreground">{text}</div>
  );
}
