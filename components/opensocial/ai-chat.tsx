'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useOS } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { streamChat } from '@/lib/sse';
import type { ChatMsg } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowUp, Sparkles, Square, Trash2, Loader2, PenLine, KeyRound, CheckCircle2, ExternalLink, Wand2, Hash, Lightbulb, CalendarClock } from 'lucide-react';

const PROVIDER_CHIPS = [
  { id: 'openrouter', label: 'OpenRouter', note: 'free auto-model' },
  { id: 'publihq', label: 'PubliHQ', note: 'gateway key' },
  { id: 'openai', label: 'OpenAI', note: 'GPT models' },
] as const;

const KEY_URLS: Record<string, string> = {
  publihq: 'https://publihq.com',
  openrouter: 'https://openrouter.ai/keys',
  openai: 'https://platform.openai.com/api-keys',
};

const QUICK_PROMPTS = [
  { icon: Lightbulb, text: 'Give me 5 content ideas for this week based on productivity and creator tools' },
  { icon: Wand2, text: 'Draft a launch post for a new social media tool. Punchy, under 240 characters.' },
  { icon: Hash, text: 'Suggest 8 high-performing hashtags for an Instagram post about morning routines' },
  { icon: CalendarClock, text: 'Build me a 7-day content calendar for X, LinkedIn and Threads' },
];

export function AiChat() {
  const { keys, loadKeys, setComposerSeed, setView, composerSeed } = useOS();
  const [provider, setProvider] = useState<string>('openrouter');
  const [model, setModel] = useState<string | null>(null);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [keyDialog, setKeyDialog] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keySaving, setKeySaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/chat/history')
      .then((r) => r.json())
      .then((j) => setMessages(j.messages ?? []))
      .finally(() => setHistoryLoaded(true));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const hasKey = !!keys[provider];

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streaming) return;
      if (!hasKey) {
        setKeyDialog(true);
        return;
      }
      const userMsg: ChatMsg = { role: 'user', content };
      const assistantMsg: ChatMsg = { role: 'assistant', content: '' };
      setMessages((m) => [...m, userMsg, assistantMsg]);
      setInput('');
      setStreaming(true);
      setModel(null);
      setModelNote(null);

      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      await streamChat(
        { messages: history, provider },
        {
          onDelta: (d) => {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + d };
              return copy;
            });
          },
          onModel: (mo) => {
            setModel(mo);
          },
          onError: (err) => {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (!last.content) copy[copy.length - 1] = { ...last, content: `⚠️ ${err}` };
              return copy;
            });
            toast({ title: 'AI request failed', description: err, variant: 'destructive' });
          },
        },
        ctrl.signal
      );
      setStreaming(false);
      abortRef.current = null;
    },
    [messages, streaming, provider, hasKey]
  );

  async function saveKey() {
    setKeySaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: keyInput }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast({ title: 'Key saved', description: `${provider} is ready.` });
      setKeyDialog(false);
      setKeyInput('');
      loadKeys();
    } catch (e) {
      toast({ title: 'Could not save key', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setKeySaving(false);
    }
  }

  async function clearChat() {
    await fetch('/api/chat/history', { method: 'DELETE' });
    setMessages([]);
    toast({ title: 'Chat cleared' });
  }

  function toComposer(text: string) {
    setComposerSeed(text.replace(/[*`_>]/g, '').trim());
    setView('composer');
  }

  // Prefill from composer seed (flow: composer → settings → back to AI keeps context)
  useEffect(() => {
    if (composerSeed) {
      setInput(`Improve this post and return only the final version:\n\n${composerSeed}`);
    }
  }, [composerSeed]);

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {/* Chat column */}
      <Card className="flex h-[calc(100vh-190px)] min-h-[520px] flex-col border bg-card/70 lg:col-span-3">
        <div ref={scrollRef} className="os-scroll flex-1 space-y-4 overflow-y-auto p-4">
          {!historyLoaded ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 shadow-lg shadow-violet-500/25">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-[15px] font-semibold">Your content co-writer</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                  Draft posts, brainstorm hooks, build calendars, sharpen captions. Works with OpenRouter free models, PubliHQ or OpenAI keys.
                </p>
              </div>
              <div className="mt-2 grid w-full max-w-md gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.text}
                    onClick={() => send(q.text)}
                    className="flex items-start gap-2.5 rounded-xl border bg-background/50 p-3 text-left text-[13px] transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <q.icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                    {q.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={cn('flex gap-2.5', m.role === 'user' && 'justify-end')}>
                {m.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div className={cn('group max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'border bg-background/60')}>
                  <p className="whitespace-pre-wrap">{m.content || (streaming && i === messages.length - 1 ? <span className="inline-block h-4 w-2 animate-pulse bg-foreground/60 align-middle" /> : '')}</p>
                  {m.role === 'assistant' && m.content && (
                    <div className="mt-1.5 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => toComposer(m.content)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">
                        <PenLine className="h-3 w-3" /> Send to composer
                      </button>
                      <button onClick={() => navigator.clipboard.writeText(m.content)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">
                        Copy
                      </button>
                      {m.model && <span className="ml-auto truncate text-[10px] text-muted-foreground/70">{m.model}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Composer row */}
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={hasKey ? 'Ask anything — “write a thread about…”' : 'Add an API key first…'}
              className="os-scroll max-h-32 min-h-[44px] flex-1 resize-none text-[13.5px]"
              rows={1}
            />
            {streaming ? (
              <Button size="icon" className="h-10 w-10 shrink-0" variant="destructive" onClick={() => abortRef.current?.abort()} aria-label="Stop generating">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" className="h-10 w-10 shrink-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500" onClick={() => send(input)} disabled={!input.trim()} aria-label="Send message">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Side panel */}
      <div className="space-y-3">
        <Card className="border bg-card/70">
          <CardContent className="p-3.5">
            <p className="mb-2 text-[12px] font-semibold text-muted-foreground">AI provider</p>
            <div className="space-y-1.5">
              {PROVIDER_CHIPS.map((p) => {
                const active = provider === p.id;
                const configured = !!keys[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => { setProvider(p.id); setModel(null); setModelNote(null); }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors',
                      active ? 'border-primary bg-primary/10' : 'hover:bg-accent'
                    )}
                  >
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', configured ? 'bg-emerald-500' : 'bg-zinc-500')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{p.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{p.id === 'openrouter' ? 'auto-picks best free model' : p.note}</span>
                    </span>
                    {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-lg bg-muted/60 p-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {provider === 'openrouter' ? (
                model ? (
                  <>
                    <span className="font-medium text-foreground">Free model in use:</span> <code className="text-[10.5px]">{model}</code>
                    {modelNote && <div className="mt-0.5">{modelNote}</div>}
                  </>
                ) : (
                  'Auto mode: OpenSocial scans OpenRouter, filters $0 models and picks the strongest available for each message.'
                )
              ) : (
                <>Model: <code className="text-[10.5px]">{provider === 'publihq' ? 'publihq default' : 'gpt-4o-mini'}</code> — responses stream live.</>
              )}
            </div>

            <div className="mt-2.5 flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-[11.5px]" onClick={() => setKeyDialog(true)}>
                <KeyRound className="h-3 w-3" /> {hasKey ? 'Replace key' : 'Add key'}
              </Button>
              {hasKey && (
                <Badge variant="secondary" className="h-7 items-center gap-1 text-[10.5px]">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Active
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border bg-card/70">
          <CardContent className="p-3.5">
            <p className="mb-2 text-[12px] font-semibold text-muted-foreground">Quick prompts</p>
            <div className="space-y-1.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.text}
                  onClick={() => send(q.text)}
                  className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-[11.5px] leading-snug text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <q.icon className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                  {q.text.length > 64 ? q.text.slice(0, 64) + '…' : q.text}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button variant="ghost" size="sm" className="h-8 w-full gap-1 text-[12px] text-muted-foreground" onClick={clearChat}>
          <Trash2 className="h-3.5 w-3.5" /> Clear conversation
        </Button>
      </div>

      {/* Key dialog */}
      <Dialog open={keyDialog} onOpenChange={setKeyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add {PROVIDER_CHIPS.find((p) => p.id === provider)?.label} key</DialogTitle>
            <DialogDescription>
              Stored server-side and never exposed to the browser. Get one at {KEY_URLS[provider].replace('https://', '')}.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={provider === 'openrouter' ? 'sk-or-…' : provider === 'openai' ? 'sk-…' : 'your PubliHQ key'}
            autoFocus
          />
          <DialogFooter className="items-center">
            <a href={KEY_URLS[provider]} target="_blank" rel="noreferrer" className="mr-auto flex items-center gap-1 text-[12px] text-primary hover:underline">
              Get a key <ExternalLink className="h-3 w-3" />
            </a>
            <Button variant="ghost" onClick={() => setKeyDialog(false)}>Cancel</Button>
            <Button onClick={saveKey} disabled={!keyInput.trim() || keySaving} className="gap-1.5">
              {keySaving && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
