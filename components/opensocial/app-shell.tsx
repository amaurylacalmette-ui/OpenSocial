'use client';

import { useEffect, useState } from 'react';
import { useOS, type View } from '@/lib/store';
import { LayoutDashboard, PenLine, CalendarClock, Zap, BarChart3, Sparkles, Link2, Settings, Menu, Plus, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ThemeToggle } from './theme-toggle';
import { Dashboard } from './dashboard';
import { Composer } from './composer';
import { PostsView } from './posts-view';
import { AutomationsView } from './automations-view';
import { AnalyticsView } from './analytics-view';
import { AiChat } from './ai-chat';
import { AccountsView } from './accounts-view';
import { SettingsView } from './settings-view';
import { cn } from '@/lib/utils';

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'composer', label: 'Composer', icon: PenLine },
  { id: 'posts', label: 'Posts & Queue', icon: CalendarClock },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'accounts', label: 'Accounts', icon: Link2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const TITLES: Record<View, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Everything happening across your accounts' },
  composer: { title: 'Composer', sub: 'Write once, publish everywhere' },
  posts: { title: 'Posts & Queue', sub: 'Scheduled, queued and published content' },
  automations: { title: 'Automations', sub: 'Cross-posting rules that run themselves' },
  analytics: { title: 'Analytics', sub: 'Growth and engagement across platforms' },
  ai: { title: 'AI Assistant', sub: 'Your content co-writer' },
  accounts: { title: 'Accounts', sub: 'Link and manage your social profiles' },
  settings: { title: 'Settings', sub: 'API keys and workspace preferences' },
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 shadow-lg shadow-violet-500/20">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="6" cy="12" r="2.6" />
          <circle cx="18" cy="6" r="2.6" />
          <circle cx="18" cy="18" r="2.6" />
          <path d="M8.4 10.8l7.2-3.6M8.4 13.2l7.2 3.6" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight">OpenSocial</div>
        <div className="text-[10.5px] text-muted-foreground">Social command center</div>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { view, setView, accounts, posts } = useOS();
  const scheduled = posts.filter((p) => p.status === 'scheduled' || p.status === 'queued').length;

  const go = (v: View) => {
    setView(v);
    onNavigate?.();
  };

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Main navigation">
      {NAV.map((item) => {
        const active = view === item.id;
        return (
          <button
            key={item.id}
            onClick={() => go(item.id)}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
              active ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            aria-current={active ? 'page' : undefined}
          >
            {active && <span className="absolute left-0 top-1/2 h-[18px] w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
            <item.icon className={cn('h-4 w-4', active && 'text-primary')} />
            {item.label}
            {item.id === 'posts' && scheduled > 0 && (
              <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">{scheduled}</span>
            )}
            {item.id === 'accounts' && <span className="ml-auto text-[11px] text-muted-foreground">{accounts.length}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function SidebarBottom() {
  const { accounts, setView } = useOS();
  const connected = accounts.length;
  return (
    <div className="px-3 pb-4">
      <button
        onClick={() => setView('accounts')}
        className="w-full rounded-xl border bg-card/60 p-3 text-left transition-colors hover:bg-accent"
      >
        <div className="flex items-center gap-2 text-[12.5px] font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {connected > 0 ? `${connected} account${connected === 1 ? '' : 's'} linked` : 'No accounts yet'}
        </div>
        <div className="mt-1 text-[11.5px] text-muted-foreground">
          {connected > 0 ? 'Cross-posting is live' : 'Link your socials to get started'}
        </div>
      </button>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r bg-sidebar pt-5 md:flex">
      <div className="mb-6 px-3">
        <Logo />
      </div>
      <NavList />
      <SidebarBottom />
    </aside>
  );
}

export function AppShell() {
  const { view, setView, loadAll, loadKeys, accounts, composerSeed, setComposerSeed } = useOS();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    loadAll();
    loadKeys();
  }, [loadAll, loadKeys]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  // Worker poll: publish due scheduled/queued posts, refresh when something fired
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch('/api/posts/process', { method: 'POST' });
        const j = await res.json();
        if (j.processed > 0) loadAll();
      } catch {
        /* noop */
      }
    }, 45000);
    return () => clearInterval(t);
  }, [loadAll]);

  const meta = TITLES[view];

  return (
    <div className="flex min-h-screen os-backdrop">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <SheetContent side="left" className="w-[264px] p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-full flex-col pt-5">
                <div className="mb-6 px-3">
                  <Logo />
                </div>
                <NavList onNavigate={() => setMobileOpen(false)} />
                <SidebarBottom />
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold leading-tight">{meta.title}</h1>
            <p className="hidden truncate text-[12px] text-muted-foreground sm:block">{meta.sub}</p>
          </div>

          <ThemeToggle />
          <Button
            onClick={() => {
              if (view === 'composer') return;
              setComposerSeed(null);
              setView('composer');
            }}
            className="h-9 gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/20 hover:from-violet-500 hover:to-fuchsia-500"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New post</span>
          </Button>
        </header>

        <div className="flex items-center justify-center border-b bg-sidebar py-3 md:hidden">
          <Logo />
        </div>

        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
          <div key={view} className="os-fade-up mx-auto w-full max-w-[1200px]">
            {view === 'dashboard' && <Dashboard />}
            {view === 'composer' && <Composer seed={composerSeed} onConsumed={() => setComposerSeed(null)} />}
            {view === 'posts' && <PostsView />}
            {view === 'automations' && <AutomationsView />}
            {view === 'analytics' && <AnalyticsView />}
            {view === 'ai' && <AiChat />}
            {view === 'accounts' && <AccountsView />}
            {view === 'settings' && <SettingsView />}
          </div>
        </main>

        <footer className="mt-auto border-t px-4 py-3 md:px-6">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between text-[11.5px] text-muted-foreground">
            <span>OpenSocial v1.0</span>
            <span>{accounts.length} accounts linked</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
