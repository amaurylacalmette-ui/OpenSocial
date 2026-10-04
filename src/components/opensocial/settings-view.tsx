'use client';

import { useEffect, useState } from 'react';
import { useOS } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ThemeToggle } from './theme-toggle';
import { KeyRound, CheckCircle2, ExternalLink, Loader2, ShieldCheck, DatabaseZap, Moon, RotateCcw, PackageOpen, Download } from 'lucide-react';

const PROVIDER_CARDS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    desc: 'One key, 400+ models. OpenSocial automatically scans all free ($0) models and routes each message to the strongest one available.',
    url: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-v1-…',
    highlight: true,
  },
  {
    id: 'publihq',
    name: 'PubliHQ',
    desc: 'Unified LLM gateway. Paste your PubliHQ API key and the assistant streams through their endpoint.',
    url: 'https://publihq.com',
    placeholder: 'phq-… or your issued key',
    highlight: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    desc: 'Direct access to GPT models using your own OpenAI billing. gpt-4o-mini is used by default.',
    url: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-…',
    highlight: false,
  },
] as const;

interface KeyRow {
  provider: string;
  name: string;
  masked: string;
  configured: boolean;
}

export function SettingsView() {
  const { loadKeys, loadAll, setView } = useOS();
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => setRows(j.keys ?? []));
  }, []);

  const rowFor = (id: string) => rows.find((r) => r.provider === id);

  async function saveKey(provider: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: keyInput }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast({ title: 'Key saved', description: 'The AI assistant is ready to use it.' });
      setEditing(null);
      setKeyInput('');
      const j = await fetch('/api/settings').then((r) => r.json());
      setRows(j.keys ?? []);
      loadKeys();
    } catch (e) {
      toast({ title: 'Could not save key', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function removeKey(provider: string) {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key: null }) });
    const j = await fetch('/api/settings').then((r) => r.json());
    setRows(j.keys ?? []);
    loadKeys();
    toast({ title: 'Key removed' });
  }

  async function resetWorkspace() {
    setResetting(true);
    try {
      const res = await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error('Reset failed');
      await loadAll();
      setView('dashboard');
      toast({ title: 'Workspace cleared', description: 'Accounts, posts, automations and chat history were removed. AI keys are kept.' });
    } catch (e) {
      toast({ title: 'Could not reset workspace', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-[15px] font-semibold">AI providers</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Keys live on the server, are masked in the UI, and are only used for outbound AI requests.
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDER_CARDS.map((p) => {
          const row = rowFor(p.id);
          return (
            <Card key={p.id} className="border bg-card/70">
              <CardHeader className="flex-row items-start gap-3 space-y-0 pb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-[14px] font-semibold">{p.name}</CardTitle>
                    {p.highlight && <Badge className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-[10px] text-white">recommended</Badge>}
                    {row?.configured && (
                      <Badge variant="secondary" className="gap-1 text-[10.5px]">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {row.masked}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{p.desc}</p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {editing === p.id ? (
                  <>
                    <Input
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder={p.placeholder}
                      className="h-9 max-w-xs text-[13px]"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && keyInput.trim() && saveKey(p.id)}
                    />
                    <Button size="sm" className="h-9" onClick={() => saveKey(p.id)} disabled={!keyInput.trim() || saving}>
                      {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9" onClick={() => { setEditing(null); setKeyInput(''); }}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-[12.5px]" onClick={() => setEditing(p.id)}>
                      <KeyRound className="h-3.5 w-3.5" /> {row?.configured ? 'Replace key' : 'Add key'}
                    </Button>
                    {row?.configured && (
                      <Button size="sm" variant="ghost" className="h-8 text-[12.5px] text-destructive hover:text-destructive" onClick={() => removeKey(p.id)}>
                        Remove
                      </Button>
                    )}
                    <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      Get a key <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="text-[15px] font-semibold">Preferences</h2>
      </div>

      <Card className="border bg-card/70">
        <CardContent className="divide-y p-0">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><Moon className="h-4 w-4 text-muted-foreground" /></div>
              <div>
                <p className="text-[13.5px] font-medium">Appearance</p>
                <p className="text-[12px] text-muted-foreground">Dark mode is default. Light is there too.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Dark</span>
              <ThemeToggle />
            </div>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><ShieldCheck className="h-4 w-4 text-emerald-500" /></div>
              <div>
                <p className="text-[13.5px] font-medium">Key storage</p>
                <p className="text-[12px] text-muted-foreground">Server-side SQLite. Masked everywhere in the UI, never returned in full.</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-[11px]">Secure</Badge>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><PackageOpen className="h-4 w-4 text-muted-foreground" /></div>
              <div>
                <p className="text-[13.5px] font-medium">Download source</p>
                <p className="text-[12px] text-muted-foreground">Full project as a .zip — README, LICENSE and .env.example included.</p>
              </div>
            </div>
            <a href="/opensocial.zip" download="opensocial.zip">
              <Button size="sm" variant="outline" className="h-8 gap-1 text-[12.5px]">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </a>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><DatabaseZap className="h-4 w-4 text-muted-foreground" /></div>
              <div>
                <p className="text-[13.5px] font-medium">Clear workspace</p>
                <p className="text-[12px] text-muted-foreground">Removes all accounts, posts, automations and chat history. AI keys are kept.</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-[12.5px]" disabled={resetting}>
                  {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all workspace data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every account, post, automation and chat message will be permanently deleted. Your AI provider keys stay configured.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetWorkspace}>Clear workspace</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-[15px] font-semibold">About</h2>
      </div>
      <Card className="border bg-card/70">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13.5px] font-semibold">OpenSocial v1.0.0</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Next.js 16 · TypeScript · Prisma · Tailwind CSS 4 · shadcn/ui · Recharts
              </p>
            </div>
            <Label className="hidden text-[11px] text-muted-foreground sm:block">self-hosted</Label>
          </div>
        </CardContent>
      </Card>

      {/* keep Switch import used for future toggles */}
      <Switch className="hidden" aria-hidden />
    </div>
  );
}
