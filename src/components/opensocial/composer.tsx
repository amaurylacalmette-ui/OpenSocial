'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOS } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Send, CalendarClock, FileText, Image as ImageIcon, X, Sparkles, Loader2, Eye, AlertTriangle } from 'lucide-react';
import { PlatformIcon, PlatformAvatar } from './platform-icon';
import { PLATFORMS, platformCharLimit } from '@/lib/platforms';
import { platformColor } from '@/lib/platforms';
import { streamChat } from '@/lib/sse';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Props {
  seed: string | null;
  onConsumed: () => void;
}

export function Composer({ seed, onConsumed }: Props) {
  const { accounts, loadAll, keys, setView, setComposerSeed } = useOS();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showMedia, setShowMedia] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({}); // accountId -> override content
  const [schedule, setSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const connected = useMemo(() => accounts.filter((a) => a.status === 'connected'), [accounts]);
  const selectedAccounts = useMemo(() => connected.filter((a) => selected[a.id] !== undefined), [connected, selected]);

  useEffect(() => {
    if (seed) {
      setContent(seed);
      onConsumed();
    }
  }, [seed, onConsumed]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = { ...s };
      if (next[id] !== undefined) delete next[id];
      else next[id] = '';
      return next;
    });
  };

  const selectAll = () => {
    if (selectedAccounts.length === connected.length) setSelected({});
    else setSelected(Object.fromEntries(connected.map((a) => [a.id, ''])));
  };

  // Effective char limit = min of selected platforms
  const minLimit = selectedAccounts.length > 0 ? Math.min(...selectedAccounts.map((a) => platformCharLimit(a.platform))) : 500;
  const overLimit = content.length > minLimit;
  const offenders = selectedAccounts.filter((a) => content.length > platformCharLimit(a.platform));

  const canPost = content.trim().length > 0 && selectedAccounts.length > 0 && !overLimit && !busy && !aiBusy;

  async function improveWithAi() {
    if (!content.trim()) {
      toast({ title: 'Write something first', description: 'The AI needs a draft to work with.' });
      return;
    }
    if (!keys['openrouter'] && !keys['publihq'] && !keys['openai']) {
      toast({ title: 'No AI key configured', description: 'Add a key in Settings → AI providers first.' });
      setComposerSeed(content);
      setView('settings');
      return;
    }
    const provider = keys['openrouter'] ? 'openrouter' : keys['publihq'] ? 'publihq' : 'openai';
    setAiBusy(true);
    let acc = '';
    const original = content;
    setContent('');
    try {
      await streamChat(
        {
          provider,
          messages: [
            { role: 'user', content: `Improve this social media post. Keep it authentic, sharpen the hook, add at most 3 relevant hashtags at the end. Return only the improved post, nothing else:\n\n${original}` },
          ],
        },
        {
          onDelta: (d) => {
            acc += d;
            setContent(acc);
          },
          onError: (m) => {
            setContent(original);
            toast({ title: 'AI failed', description: m, variant: 'destructive' });
          },
        }
      );
      if (!acc.trim()) setContent(original);
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(status: 'publish' | 'schedule' | 'draft') {
    if (!canPost) return;
    setBusy(status);
    try {
      const scheduledAt = status === 'schedule' && scheduleAt ? new Date(scheduleAt).toISOString() : null;
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          mediaUrl: mediaUrl.trim() || null,
          scheduledAt,
          status: status === 'draft' ? 'draft' : undefined,
          targets: selectedAccounts.map((a) => ({
            accountId: a.id,
            platform: a.platform,
            content: selected[a.id]?.trim() || null,
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed');
      const triggered: string[] = j.post?.triggered ?? [];
      if (status === 'draft') toast({ title: 'Draft saved' });
      else if (status === 'schedule') toast({ title: 'Scheduled', description: `Goes out ${scheduleAt ? format(new Date(scheduleAt), 'MMM d, HH:mm') : ''}` });
      else toast({ title: 'Published', description: `Sent to ${selectedAccounts.length} account${selectedAccounts.length === 1 ? '' : 's'}` });
      setContent('');
      setSelected({});
      setMediaUrl('');
      setShowMedia(false);
      setSchedule(false);
      setScheduleAt('');
      loadAll();
    } catch (e) {
      toast({ title: 'Could not publish', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Editor */}
      <div className="space-y-4 lg:col-span-3">
        {/* Accounts */}
        <Card className="border bg-card/70">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-[13.5px] font-semibold">Publish to</CardTitle>
            {connected.length > 0 && (
              <button onClick={selectAll} className="text-[12px] text-primary hover:underline">
                {selectedAccounts.length === connected.length ? 'Clear all' : 'Select all'}
              </button>
            )}
          </CardHeader>
          <CardContent>
            {connected.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-[13px] text-muted-foreground">No accounts linked yet.</p>
                <Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => setView('accounts')}>
                  Link your first account
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {connected.map((a) => {
                  const on = selected[a.id] !== undefined;
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(a.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-[12.5px] font-medium transition-all',
                        on ? 'border-primary bg-primary/10 text-foreground shadow-sm' : 'bg-background/50 text-muted-foreground hover:border-foreground/25'
                      )}
                      aria-pressed={on}
                    >
                      <PlatformAvatar platform={a.platform} size="sm" className={cn(!on && 'opacity-70 grayscale-[0.4]')} />
                      {a.username}
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Text */}
        <Card className="border bg-card/70">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13.5px] font-semibold">Post content</CardTitle>
            <Button size="sm" variant="outline" className="h-7 gap-1 rounded-md text-[12px]" onClick={improveWithAi} disabled={aiBusy || !content.trim()}>
              {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-violet-400" />}
              {aiBusy ? 'Writing…' : 'Improve with AI'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening? Write once, tailor per platform below, publish everywhere…"
              className="min-h-[140px] resize-y border-0 bg-transparent p-0 text-[14.5px] focus-visible:ring-0"
              maxLength={10000}
            />
            <div className="flex items-center justify-between">
              <button onClick={() => setShowMedia((s) => !s)} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> {showMedia ? 'Hide media' : 'Attach image URL'}
              </button>
              <span className={cn('text-[12px] tabular-nums', overLimit ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                {content.length}/{minLimit}
              </span>
            </div>
            {showMedia && (
              <div className="flex gap-2">
                <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…/image.jpg" className="h-9 text-[13px]" />
                {mediaUrl && (
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMediaUrl('')} aria-label="Clear media">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            {mediaUrl && mediaUrl.startsWith('http') && (
              <div className="overflow-hidden rounded-lg border">
                { }
                <img src={mediaUrl} alt="Attachment preview" className="max-h-48 w-full object-cover" />
              </div>
            )}
            {offenders.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-[12px] text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Too long for {offenders.map((o) => PLATFORMS[o.platform as keyof typeof PLATFORMS]?.name ?? o.platform).join(', ')} — customize their text below or trim the main copy.
                </span>
              </div>
            )}

            {/* Per-platform overrides */}
            {selectedAccounts.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="overrides" className="border-0">
                  <AccordionTrigger className="rounded-lg px-3 py-2 text-[12.5px] hover:no-underline hover:bg-accent/60">
                    Customize per platform ({selectedAccounts.length})
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2">
                    {selectedAccounts.map((a) => (
                      <div key={a.id} className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[12.5px] font-medium">
                            <PlatformAvatar platform={a.platform} size="sm" />
                            {a.username}
                            <span className="text-muted-foreground">· {platformCharLimit(a.platform)} limit</span>
                          </div>
                        </div>
                        <Textarea
                          value={selected[a.id] ?? ''}
                          onChange={(e) => setSelected((s) => ({ ...s, [a.id]: e.target.value }))}
                          placeholder={`Leave empty to use the main text (${platformCharLimit(a.platform)} chars max)`}
                          className="min-h-[64px] text-[13px]"
                          maxLength={platformCharLimit(a.platform) * 4}
                        />
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </CardContent>
        </Card>

        {/* Schedule + actions */}
        <Card className="border bg-card/70">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="sched" className="text-[13px] font-medium">Schedule for later</Label>
              </div>
              <Switch id="sched" checked={schedule} onCheckedChange={setSchedule} disabled={false} />
            </div>
            {schedule && (
              <Input
                type="datetime-local"
                value={scheduleAt}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="h-9 text-[13px]"
              />
            )}
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => submit('publish')} disabled={schedule || !canPost} className="h-9 flex-1 gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500 sm:flex-none">
                {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Post now
              </Button>
              <Button onClick={() => submit('schedule')} disabled={!schedule || !scheduleAt || !canPost} variant="outline" className="h-9 gap-1.5 rounded-lg">
                {busy === 'schedule' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                Schedule
              </Button>
              <Button onClick={() => submit('draft')} disabled={!content.trim() || busy !== null} variant="ghost" className="h-9 gap-1.5 rounded-lg">
                {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Save draft
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="lg:col-span-2">
        <Card className="sticky top-[72px] border bg-card/70">
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-[13.5px] font-semibold">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedAccounts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-[13px] text-muted-foreground">
                Select accounts to preview how the post appears on each platform.
              </div>
            ) : (
              <Tabs defaultValue={selectedAccounts[0]?.id}>
                <TabsList className="mb-3 h-8 w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
                  {selectedAccounts.map((a) => (
                    <TabsTrigger key={a.id} value={a.id} className="h-6 gap-1.5 rounded-md px-2 text-[11.5px]">
                      <PlatformIcon platform={a.platform} className="h-3 w-3" style={{ color: platformColor(a.platform) }} />
                      {PLATFORMS[a.platform as keyof typeof PLATFORMS]?.name ?? a.platform}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {selectedAccounts.map((a) => (
                  <TabsContent key={a.id} value={a.id}>
                    <PostPreview
                      platform={a.platform}
                      username={a.username}
                      displayName={a.displayName}
                      text={selected[a.id]?.trim() || content}
                      mediaUrl={mediaUrl}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PostPreview({ platform, username, displayName, text, mediaUrl }: { platform: string; username: string; displayName: string; text: string; mediaUrl: string }) {
  const limit = platformCharLimit(platform);
  const shown = text.length > limit ? text.slice(0, limit) + '…' : text;
  const isVideo = ['tiktok', 'youtube', 'instagram'].includes(platform);

  return (
    <div className="rounded-xl border bg-background p-3.5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <PlatformAvatar platform={platform} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight">
            {displayName || username}
            <PlatformIcon platform={platform} className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="text-[11.5px] text-muted-foreground">@{username.replace(/^@/, '')} · now</div>
        </div>
      </div>
      <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed">{shown || <span className="text-muted-foreground">Your post text appears here…</span>}</p>
      {mediaUrl && mediaUrl.startsWith('http') && (
        <div className={cn('mt-2.5 overflow-hidden rounded-lg border', isVideo && 'aspect-[4/5]')}>
          { }
          <img src={mediaUrl} alt="Post media" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="mt-3 flex items-center gap-5 border-t pt-2.5 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1">♡ 0</span>
        <span className="flex items-center gap-1">💬 0</span>
        <span className="flex items-center gap-1">↻ 0</span>
        <span className="ml-auto">{shown.length}/{limit}</span>
      </div>
    </div>
  );
}
