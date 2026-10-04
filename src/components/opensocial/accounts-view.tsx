'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOS } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { PLATFORM_LIST, PLATFORMS, type PlatformId } from '@/lib/platforms';
import { PlatformAvatar, PlatformIcon } from './platform-icon';
import { CheckCircle2, Loader2, Plus, ShieldCheck, Users, Zap, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AccountsView() {
  const { accounts, loadAll } = useOS();
  const [connectPlatform, setConnectPlatform] = useState<PlatformId | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ id: string; username: string } | null>(null);

  const connectedByPlatform = useMemo(() => {
    const map = new Map<string, typeof accounts>();
    for (const a of accounts) {
      const arr = map.get(a.platform) ?? [];
      arr.push(a);
      map.set(a.platform, arr);
    }
    return map;
  }, [accounts]);

  async function toggleAutoPost(id: string, value: boolean) {
    await fetch(`/api/accounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoPost: value }) });
    loadAll();
  }

  async function disconnect() {
    if (!confirmDisconnect) return;
    await fetch(`/api/accounts/${confirmDisconnect.id}`, { method: 'DELETE' });
    toast({ title: `Disconnected @${confirmDisconnect.username}` });
    setConfirmDisconnect(null);
    loadAll();
  }

  const totalFollowers = accounts.reduce((s, a) => s + a.followers, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border bg-card/70">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500"><Link2 className="h-5 w-5" /></div>
            <div>
              <div className="text-[19px] font-bold leading-tight">{accounts.length}</div>
              <div className="text-[12px] text-muted-foreground">Linked accounts</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card/70">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuchsia-500/10 text-fuchsia-500"><Users className="h-5 w-5" /></div>
            <div>
              <div className="text-[19px] font-bold leading-tight">{totalFollowers.toLocaleString()}</div>
              <div className="text-[12px] text-muted-foreground">Combined followers</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border bg-card/70">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><Zap className="h-5 w-5" /></div>
            <div>
              <div className="text-[19px] font-bold leading-tight">{accounts.filter((a) => a.autoPost).length}</div>
              <div className="text-[12px] text-muted-foreground">Auto cross-post on</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORM_LIST.map((p) => {
          const list = connectedByPlatform.get(p.id) ?? [];
          return (
            <Card key={p.id} className="border bg-card/70 transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-2">
                <PlatformAvatar platform={p.id} size="md" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-[14px] font-semibold">{p.name}</CardTitle>
                  <p className="truncate text-[11.5px] text-muted-foreground">{p.hint}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {list.length === 0 ? (
                  <Button variant="outline" size="sm" className="h-8 w-full gap-1.5 rounded-lg text-[12.5px]" onClick={() => setConnectPlatform(p.id)}>
                    <Plus className="h-3.5 w-3.5" /> Connect {p.name}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    {list.map((a) => (
                      <div key={a.id} className="rounded-lg border bg-background/40 p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 os-pulse-dot" aria-hidden />
                          <span className="truncate text-[13px] font-medium">@{a.username.replace(/^@/, '')}</span>
                          <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">{a.followers.toLocaleString()} followers</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground">
                            <Switch checked={a.autoPost} onCheckedChange={(v) => toggleAutoPost(a.id, v)} className="scale-90" aria-label={`Auto cross-post for ${a.username}`} />
                            Cross-post
                          </label>
                          <button
                            onClick={() => setConfirmDisconnect({ id: a.id, username: a.username })}
                            className="text-[11.5px] text-muted-foreground transition-colors hover:text-destructive"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="h-7 w-full gap-1 text-[11.5px] text-muted-foreground" onClick={() => setConnectPlatform(p.id)}>
                      <Plus className="h-3 w-3" /> Add another
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ConnectDialog platform={connectPlatform} onClose={() => setConnectPlatform(null)} onConnected={() => { setConnectPlatform(null); loadAll(); }} />

      <Dialog open={confirmDisconnect !== null} onOpenChange={(o) => !o && setConfirmDisconnect(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect account?</DialogTitle>
            <DialogDescription>
              @{confirmDisconnect?.username} will be removed. Scheduled posts for this account will stop.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDisconnect(null)}>Cancel</Button>
            <Button variant="destructive" onClick={disconnect}>Disconnect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Step = 'form' | 'connecting' | 'done';

const CONNECT_STEPS = ['Securely connecting', 'Requesting authorization', 'Syncing profile'];

function ConnectDialog({ platform, onClose, onConnected }: { platform: PlatformId | null; onClose: () => void; onConnected: () => void }) {
  const [username, setUsername] = useState('');
  const [followers, setFollowers] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    setUsername('');
    setFollowers('');
    setStep('form');
    setStepIdx(0);
    setError('');
  }, [platform]);

  useEffect(() => {
    if (step !== 'connecting') return;
    if (stepIdx >= CONNECT_STEPS.length) {
      const t = setTimeout(() => setStep('done'), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIdx((i) => i + 1), 650);
    return () => clearTimeout(t);
  }, [step, stepIdx]);

  async function connect() {
    if (!platform || !username.trim()) return;
    setError('');
    setStep('connecting');
    setStepIdx(0);
  }

  // After animation completes, actually create the account
  useEffect(() => {
    if (step !== 'done' || !platform) return;
    (async () => {
      try {
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform,
            username: username.trim().replace(/^@/, ''),
            displayName: username.trim().replace(/^@/, ''),
            ...(followers.trim() ? { followers: Number(followers.replace(/[^\d]/g, '')) } : {}),
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? 'Failed to connect');
        toast({ title: `${PLATFORMS[platform].name} connected`, description: `@${username.trim().replace(/^@/, '')} is ready for cross-posting.` });
        onConnected();
      } catch (e) {
        setError((e as Error).message);
        setStep('form');
      }
    })();
  }, [step, platform, username, onConnected]);

  const meta = platform ? PLATFORMS[platform] : null;

  return (
    <Dialog open={platform !== null} onOpenChange={(o) => !o && step !== 'connecting' && onClose()}>
      <DialogContent className="max-w-sm">
        {meta && (
          <>
            <DialogHeader>
              <div className="mb-1 flex items-center gap-2.5">
                <PlatformAvatar platform={meta.id} size="lg" />
                <div>
                  <DialogTitle className="text-left">Connect {meta.name}</DialogTitle>
                  <DialogDescription className="text-left">{meta.hint}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {step === 'form' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="uname" className="text-[12.5px]">{meta.name} username</Label>
                  <Input
                    id="uname"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={meta.id === 'tiktok' || meta.id === 'youtube' ? '@yourhandle' : 'yourhandle'}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && username.trim() && connect()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ufollowers" className="text-[12.5px]">
                    Current followers <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="ufollowers"
                    inputMode="numeric"
                    value={followers}
                    onChange={(e) => setFollowers(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="e.g. 1200 — used as the analytics starting point"
                    onKeyDown={(e) => e.key === 'Enter' && username.trim() && connect()}
                  />
                </div>
                {error && <p className="text-[12px] text-destructive">{error}</p>}
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-[11.5px] text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  OpenSocial stores only your handle and preferences — no passwords or tokens. Wire up real OAuth for production use.
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={onClose}>Cancel</Button>
                  <Button onClick={connect} disabled={!username.trim()} className="gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500">
                    Authorize {meta.name}
                  </Button>
                </DialogFooter>
              </>
            )}

            {step === 'connecting' && (
              <div className="space-y-3 py-2">
                {CONNECT_STEPS.map((label, i) => (
                  <div key={label} className="flex items-center gap-2.5 text-[13px]">
                    {i < stepIdx ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : i === stepIdx ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                    )}
                    <span className={cn(i <= stepIdx ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {step === 'done' && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-[14px] font-semibold">@{username.trim().replace(/^@/, '')} linked</p>
                <p className="text-[12.5px] text-muted-foreground">Cross-posting is enabled. Analytics build from here on — nothing is invented.</p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
