'use client';

import { useMemo, useState } from 'react';
import { useOS } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { PLATFORM_LIST, PLATFORMS, type PlatformId } from '@/lib/platforms';
import { PlatformIcon, PlatformAvatar } from './platform-icon';
import { Plus, Trash2, Zap, ArrowRight, Loader2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AutomationsView() {
  const { automations, loadAll } = useOS();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(id: string, enabled: boolean) {
    setBusyId(id);
    await fetch(`/api/automations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
    loadAll();
    setBusyId(null);
  }

  async function remove(id: string) {
    setBusyId(id);
    await fetch(`/api/automations/${id}`, { method: 'DELETE' });
    toast({ title: 'Automation deleted' });
    loadAll();
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-lg text-[13px] text-muted-foreground">
          When you publish to a source platform, OpenSocial automatically re-posts to the targets after your delay — with text trimmed to fit each limit.
        </p>
        <Button onClick={() => setCreating(true)} className="h-9 gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500">
          <Plus className="h-4 w-4" /> New rule
        </Button>
      </div>

      {automations.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Zap className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-[14px] font-medium">No automations yet</p>
          <p className="text-[12.5px] text-muted-foreground">Create a rule and let cross-posting run on autopilot.</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {automations.map((a) => (
          <Card key={a.id} className={cn('border bg-card/70 transition-opacity', !a.enabled && 'opacity-60')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <Zap className={cn('h-4 w-4', a.enabled ? 'text-amber-400' : 'text-muted-foreground')} />
                  {a.name}
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={a.enabled} onCheckedChange={(v) => toggle(a.id, v)} disabled={busyId === a.id} aria-label={`Toggle ${a.name}`} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(a.id)} aria-label="Delete automation">
                    {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-background/40 p-2.5">
                <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[12px] font-medium">
                  <PlatformIcon platform={a.sourcePlatform} className="h-3 w-3" />
                  {PLATFORMS[a.sourcePlatform as PlatformId]?.name ?? a.sourcePlatform}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                {a.targetPlatforms.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[12px] font-medium">
                    <PlatformIcon platform={t} className="h-3 w-3" />
                    {PLATFORMS[t as PlatformId]?.name ?? t}
                  </span>
                ))}
                <span className="ml-auto flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {a.delayMinutes === 0 ? 'instant' : `+${a.delayMinutes} min`}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11.5px] text-muted-foreground">
                <span>{a.runs} run{a.runs === 1 ? '' : 's'}</span>
                <span className={cn(a.enabled ? 'text-emerald-500' : '')}>{a.enabled ? 'Active' : 'Paused'}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateDialog open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); loadAll(); }} />
    </div>
  );
}

function CreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { accounts } = useOS();
  const activePlatforms = useMemo(() => [...new Set(accounts.map((a) => a.platform))], [accounts]);
  const [name, setName] = useState('');
  const [source, setSource] = useState<PlatformId | ''>('');
  const [targets, setTargets] = useState<PlatformId[]>([]);
  const [delay, setDelay] = useState(5);
  const [busy, setBusy] = useState(false);

  function toggleTarget(p: PlatformId) {
    setTargets((t) => (t.includes(p) ? t.filter((x) => x !== p) : [...t, p]));
  }

  async function create() {
    if (!name.trim() || !source || targets.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), sourcePlatform: source, targetPlatforms: targets, delayMinutes: delay }),
      });
      if (!res.ok) throw new Error('Failed to create');
      toast({ title: 'Automation created', description: 'It fires on your next post.' });
      setName('');
      setSource('');
      setTargets([]);
      setDelay(5);
      onCreated();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  const choices = (activePlatforms.length > 0 ? activePlatforms : PLATFORM_LIST.map((p) => p.id)) as PlatformId[];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New automation</DialogTitle>
          <DialogDescription>Route posts from one platform to others automatically.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Rule name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="X → Threads & Bluesky" className="h-9 text-[13px]" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px]">When I post to</Label>
            <div className="flex flex-wrap gap-1.5">
              {choices.map((p) => (
                <button
                  key={p}
                  onClick={() => { setSource(p); setTargets((t) => t.filter((x) => x !== p)); }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
                    source === p ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:border-foreground/25'
                  )}
                >
                  <PlatformIcon platform={p} className="h-3 w-3" /> {PLATFORMS[p].name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Repost to</Label>
            <div className="flex flex-wrap gap-1.5">
              {choices.filter((p) => p !== source).map((p) => (
                <button
                  key={p}
                  onClick={() => toggleTarget(p)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
                    targets.includes(p) ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:border-foreground/25'
                  )}
                >
                  <PlatformIcon platform={p} className="h-3 w-3" /> {PLATFORMS[p].name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[12.5px]">Delay</Label>
              <span className="text-[12px] text-muted-foreground">{delay === 0 ? 'Instant' : `${delay} min after publish`}</span>
            </div>
            <Slider value={[delay]} min={0} max={60} step={5} onValueChange={([v]) => setDelay(v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={create} disabled={!name.trim() || !source || targets.length === 0 || busy} className="gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
