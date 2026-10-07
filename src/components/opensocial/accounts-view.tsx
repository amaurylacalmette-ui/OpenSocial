'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOS } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { PLATFORM_LIST, PLATFORMS, PLATFORM_AUTH, type PlatformId, type AuthField } from '@/lib/platforms';
import { PlatformAvatar, PlatformIcon } from './platform-icon';
import { CheckCircle2, ExternalLink, Eye, EyeOff, Loader2, Plus, RefreshCw, ShieldCheck, Users, Zap, Link2, AlertTriangle, Info, Copy, Check, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AccountsView() {
  const { accounts, loadAll } = useOS();
  const [connectPlatform, setConnectPlatform] = useState<PlatformId | null>(null);
  const [oauthPlatform, setOauthPlatform] = useState<PlatformId | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ id: string; username: string } | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

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

  async function syncAccount(id: string) {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/accounts/${id}/sync`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Sync failed');
      toast({ title: 'Account synced', description: `${j.account.displayName}: ${j.account.followers.toLocaleString()} followers, reported by the platform.` });
      loadAll();
    } catch (e) {
      toast({ title: 'Sync failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSyncingId(null);
    }
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
                  p.oauth ? (
                    <div className="space-y-1.5">
                      <Button size="sm" className="h-8 w-full gap-1.5 rounded-lg text-[12.5px] bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500" onClick={() => setOauthPlatform(p.id)}>
                        <Link2 className="h-3.5 w-3.5" /> Connect
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-full gap-1.5 rounded-lg text-[11.5px] text-muted-foreground" onClick={() => setConnectPlatform(p.id)}>
                        Manual credentials
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="h-8 w-full gap-1.5 rounded-lg text-[12.5px]" onClick={() => setConnectPlatform(p.id)}>
                      <Plus className="h-3.5 w-3.5" /> Connect {p.name}
                    </Button>
                  )
                ) : (
                  <div className="space-y-2">
                    {list.map((a) => {
                      const expired = a.status === 'expired';
                      return (
                        <div key={a.id} className={cn('rounded-lg border bg-background/40 p-2.5', expired && 'border-amber-500/40')}>
                          <div className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', expired ? 'bg-amber-500' : 'bg-emerald-500 os-pulse-dot')} aria-hidden />
                            <span className="truncate text-[13px] font-medium">@{a.username.replace(/^@/, '')}</span>
                            {expired ? (
                              <Badge className="ml-auto shrink-0 gap-1 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3" /> expired
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">{a.followers.toLocaleString()} followers</Badge>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground">
                              <Switch checked={a.autoPost} onCheckedChange={(v) => toggleAutoPost(a.id, v)} className="scale-90" aria-label={`Auto cross-post for ${a.username}`} />
                              Cross-post
                            </label>
                            <div className="flex items-center gap-2">
                              {a.remoteUrl && (
                                <a href={a.remoteUrl} target="_blank" rel="noreferrer" title="Open profile" className="text-muted-foreground transition-colors hover:text-foreground">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => syncAccount(a.id)}
                                title="Re-sync profile from the platform"
                                className="text-muted-foreground transition-colors hover:text-foreground"
                                disabled={syncingId === a.id}
                              >
                                {syncingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={() => setConfirmDisconnect({ id: a.id, username: a.username })}
                                className="text-[11.5px] text-muted-foreground transition-colors hover:text-destructive"
                              >
                                Disconnect
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <Button variant="ghost" size="sm" className="h-7 w-full gap-1 text-[11.5px] text-muted-foreground" onClick={() => (p.oauth ? setOauthPlatform(p.id) : setConnectPlatform(p.id))}>
                      <Plus className="h-3 w-3" /> Add another
                    </Button>
                    {p.oauth && (
                      <button className="h-6 w-full text-center text-[11px] text-muted-foreground transition-colors hover:text-foreground" onClick={() => setConnectPlatform(p.id)}>
                        or connect manually
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ConnectDialog platform={connectPlatform} onClose={() => setConnectPlatform(null)} onConnected={() => loadAll()} />

      <OAuthDialog
        platform={oauthPlatform}
        onClose={() => setOauthPlatform(null)}
        onManual={(p) => {
          setOauthPlatform(null);
          setConnectPlatform(p);
        }}
      />

      <Dialog open={confirmDisconnect !== null} onOpenChange={(o) => !o && setConfirmDisconnect(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect account?</DialogTitle>
            <DialogDescription>
              @{confirmDisconnect?.username} will be removed along with its stored credentials. Scheduled posts for this account will stop.
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

function ConnectDialog({ platform, onClose, onConnected }: { platform: PlatformId | null; onClose: () => void; onConnected: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<'form' | 'connecting' | 'done'>('form');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState<{ username: string; followers: number | null; remoteUrl: string | null } | null>(null);

  const meta = platform ? PLATFORMS[platform] : null;
  const auth = platform ? PLATFORM_AUTH[platform] : null;

  useEffect(() => {
    setValues({});
    setRevealed({});
    setStep('form');
    setError('');
    setConnected(null);
  }, [platform]);

  function setField(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function connect() {
    if (!platform || !auth) return;
    const missing = auth.fields.filter((f) => !(values[f.key] ?? '').trim());
    if (missing.length > 0) {
      setError(`Fill in: ${missing.map((m) => m.label).join(' · ')}`);
      return;
    }
    setError('');
    setStep('connecting');
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, credentials: values }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Connection failed');
      setConnected({
        username: j.account.username,
        followers: typeof j.account.followers === 'number' ? j.account.followers : null,
        remoteUrl: j.account.remoteUrl ?? null,
      });
      setStep('done');
      toast({ title: `${meta?.name ?? platform} connected`, description: `Verified by the live ${meta?.name ?? ''} API as @${j.account.username}.` });
      onConnected();
    } catch (e) {
      setError((e as Error).message);
      setStep('form');
    }
  }

  return (
    <Dialog open={platform !== null} onOpenChange={(o) => !o && step !== 'connecting' && onClose()}>
      <DialogContent className="max-w-sm">
        {meta && auth && (
          <>
            <DialogHeader>
              <div className="mb-1 flex items-center gap-2.5">
                <PlatformAvatar platform={meta.id} size="lg" />
                <div>
                  <DialogTitle className="text-left">Connect {meta.name}</DialogTitle>
                  <DialogDescription className="text-left">
                    Credentials are verified against the live {meta.name} API before the account is added.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {step === 'form' && (
              <>
                <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
                  {auth.fields.map((f) => (
                    <FieldRow key={f.key} field={f} value={values[f.key] ?? ''} revealed={!!revealed[f.key]} onChange={(v) => setField(f.key, v)} onToggleReveal={() => setRevealed((p) => ({ ...p, [f.key]: !p[f.key] }))} onEnter={connect} />
                  ))}
                </div>

                {auth.note && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-400">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {auth.note}
                  </div>
                )}
                {error && <p className="text-[12px] leading-relaxed text-destructive">{error}</p>}
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-[11.5px] text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  Secrets are stored server-side in your own database and never sent back to the browser.
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={onClose}>Cancel</Button>
                  <Button onClick={connect} className="gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500">
                    Verify & connect
                  </Button>
                </DialogFooter>
              </>
            )}

            {step === 'connecting' && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <PlatformIcon platform={meta.id} className="h-8 w-8 animate-pulse" />
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Contacting {meta.name}…
                </div>
              </div>
            )}

            {step === 'done' && connected && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-[14px] font-semibold">@{connected.username} verified</p>
                <p className="text-[12.5px] text-muted-foreground">
                  {connected.followers !== null && connected.followers > 0
                    ? `${connected.followers.toLocaleString()} followers, straight from ${meta.name}. Cross-posting is live.`
                    : `Verified by the live ${meta.name} API. Cross-posting is live.`}
                </p>
                {connected.remoteUrl && (
                  <a href={connected.remoteUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                    Open profile <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <DialogFooter className="mt-2 w-full">
                  <Button onClick={onClose} className="w-full">Done</Button>
                </DialogFooter>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ field, value, revealed, onChange, onToggleReveal, onEnter }: {
  field: AuthField;
  value: string;
  revealed: boolean;
  onChange: (v: string) => void;
  onToggleReveal: () => void;
  onEnter: () => void;
}) {
  const isSecret = !!field.secret;
  return (
    <div className="space-y-1">
      <Label htmlFor={`f-${field.key}`} className="text-[12.5px]">{field.label}</Label>
      <div className="relative">
        <Input
          id={`f-${field.key}`}
          type={isSecret && !revealed ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          autoComplete="off"
          autoFocus={!isSecret}
          className={cn('h-9 text-[13px]', isSecret && 'pr-9')}
          onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        />
        {isSecret && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={revealed ? 'Hide value' : 'Show value'}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {(field.help || field.helpUrl) && (
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] leading-relaxed text-muted-foreground">
          {field.help && <span>{field.help}</span>}
          {field.helpUrl && (
            <a href={field.helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-violet-500 hover:text-violet-400">
              Open <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </p>
      )}
    </div>
  );
}

interface OAuthConfigStatus {
  mastodon: { configured: true; kind: 'host' };
  reddit: { configured: boolean; kind: 'app'; preview: string | null; subreddit: string | null };
  x: { configured: boolean; kind: 'app'; preview: string | null };
}

function OAuthDialog({ platform, onClose, onManual }: {
  platform: PlatformId | null;
  onClose: () => void;
  onManual: (p: PlatformId) => void;
}) {
  const [config, setConfig] = useState<OAuthConfigStatus | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [instance, setInstance] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const meta = platform ? PLATFORMS[platform] : null;
  const isApp = platform === 'reddit' || platform === 'x';

  useEffect(() => {
    if (!platform) return;
    setValues({});
    setRevealed({});
    setEditing(false);
    setInstance('');
    setError('');
    setCopied(false);
    setRedirectUri(`${window.location.origin}/api/oauth/callback/${platform}`);
    if (platform === 'reddit' || platform === 'x') {
      fetch('/api/oauth/config')
        .then((r) => r.json())
        .then(setConfig)
        .catch(() => setConfig(null));
    }
  }, [platform]);

  function setField(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function saveAndContinue() {
    if (!platform) return;
    const required = platform === 'reddit' ? ['clientId', 'clientSecret'] : ['consumerKey', 'consumerSecret'];
    const missing = required.filter((k) => !(values[k] ?? '').trim());
    if (missing.length > 0) {
      setError('Fill in every required field first.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/oauth/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, ...values }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not save the app credentials.');
      setConfig(j);
      setEditing(false);
      go();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function go() {
    if (!platform) return;
    if (platform === 'mastodon') {
      if (!instance.trim()) {
        setError('Enter your instance domain, e.g. mastodon.social');
        return;
      }
      window.location.href = `/api/oauth/start/mastodon?instance=${encodeURIComponent(instance.trim())}`;
    } else {
      window.location.href = `/api/oauth/start/${platform}`;
    }
  }

  function copyRedirect() {
    navigator.clipboard.writeText(redirectUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const configured = platform === 'reddit' ? !!config?.reddit.configured : platform === 'x' ? !!config?.x.configured : true;
  const showForm = platform === 'mastodon' || !configured || editing;

  return (
    <Dialog open={platform !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-sm">
        {meta && platform && (
          <>
            <DialogHeader>
              <div className="mb-1 flex items-center gap-2.5">
                <PlatformAvatar platform={meta.id} size="lg" />
                <div>
                  <DialogTitle className="text-left">Connect {meta.name}</DialogTitle>
                  <DialogDescription className="text-left">
                    {platform === 'mastodon'
                      ? 'OpenSocial registers itself on your instance on the fly — you just authorize it and come right back.'
                      : 'One-time app setup, then every future connect is a single authorization click.'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {platform === 'mastodon' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="oauth-instance" className="text-[12.5px]">Your instance</Label>
                  <Input
                    id="oauth-instance"
                    value={instance}
                    onChange={(e) => setInstance(e.target.value)}
                    placeholder="mastodon.social"
                    autoComplete="off"
                    className="h-9 text-[13px]"
                    onKeyDown={(e) => e.key === 'Enter' && go()}
                  />
                  <p className="text-[11px] text-muted-foreground">The server your account lives on — e.g. mastodon.social, mas.to, infosec.exchange.</p>
                </div>
              </div>
            )}

            {isApp && !showForm && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-[12px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    App connected{config ? ` — ${platform === 'reddit' ? `client ${config.reddit.preview}${config.reddit.subreddit ? ` · r/${config.reddit.subreddit}` : ''}` : `key ${config.x.preview}`}` : ''}. Continue to authorize your account.
                  </span>
                </div>
              </div>
            )}

            {isApp && showForm && (
              <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
                {platform === 'reddit' ? (
                  <>
                    <FieldRow field={{ key: 'clientId', label: 'Client ID', placeholder: 'From your reddit web app' }} value={values.clientId ?? ''} revealed={!!revealed.clientId} onChange={(v) => setField('clientId', v)} onToggleReveal={() => setRevealed((p) => ({ ...p, clientId: !p.clientId }))} onEnter={saveAndContinue} />
                    <FieldRow field={{ key: 'clientSecret', label: 'Client secret', placeholder: 'Web app secret', secret: true }} value={values.clientSecret ?? ''} revealed={!!revealed.clientSecret} onChange={(v) => setField('clientSecret', v)} onToggleReveal={() => setRevealed((p) => ({ ...p, clientSecret: !p.clientSecret }))} onEnter={saveAndContinue} />
                    <FieldRow field={{ key: 'subreddit', label: 'Default subreddit (optional)', placeholder: 'e.g. sideproject', help: 'Where text posts get submitted — without r/. You can override per post later.' }} value={values.subreddit ?? ''} revealed onChange={(v) => setField('subreddit', v)} onToggleReveal={() => {}} onEnter={saveAndContinue} />
                  </>
                ) : (
                  <>
                    <FieldRow field={{ key: 'consumerKey', label: 'API key (consumer key)', placeholder: 'From your X developer app' }} value={values.consumerKey ?? ''} revealed={!!revealed.consumerKey} onChange={(v) => setField('consumerKey', v)} onToggleReveal={() => setRevealed((p) => ({ ...p, consumerKey: !p.consumerKey }))} onEnter={saveAndContinue} />
                    <FieldRow field={{ key: 'consumerSecret', label: 'API key secret', placeholder: 'Consumer secret', secret: true }} value={values.consumerSecret ?? ''} revealed={!!revealed.consumerSecret} onChange={(v) => setField('consumerSecret', v)} onToggleReveal={() => setRevealed((p) => ({ ...p, consumerSecret: !p.consumerSecret }))} onEnter={saveAndContinue} />
                  </>
                )}

                <div className="space-y-1">
                  <Label className="text-[12.5px]">Redirect URI</Label>
                  <div className="flex items-center gap-1.5">
                    <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-[11px]">{redirectUri}</code>
                    <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" onClick={copyRedirect} aria-label="Copy redirect URI">
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {platform === 'reddit'
                      ? 'Create a "web app" (not script app) at reddit.com/prefs/apps with this exact redirect URI, then paste its id and secret here.'
                      : 'In the X developer portal, enable OAuth 1.0a for your app and set this exact callback URL, then paste the consumer keys here.'}
                  </p>
                </div>
              </div>
            )}

            {error && <p className="text-[12px] leading-relaxed text-destructive">{error}</p>}

            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-[11.5px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              The authorization happens on {meta.name}'s own site — OpenSocial never sees your password.
            </div>

            <DialogFooter>
              <div className="flex w-full flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  {isApp && configured && (
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-[11.5px] text-muted-foreground" onClick={() => setEditing(true)}>
                      <Pencil className="h-3 w-3" /> Edit app
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="ml-auto h-8 text-[11.5px] text-muted-foreground" onClick={onClose}>Cancel</Button>
                  {platform === 'mastodon' ? (
                    <Button onClick={go} className="h-8 gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500">
                      Continue to {meta.name}
                    </Button>
                  ) : showForm ? (
                    <Button onClick={saveAndContinue} disabled={saving} className="h-8 gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500">
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save & authorize
                    </Button>
                  ) : (
                    <Button onClick={go} className="h-8 gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500">
                      Continue to {meta.name}
                    </Button>
                  )}
                </div>
                <button
                  className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => onManual(platform)}
                >
                  Prefer pasting credentials? Connect manually
                </button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
