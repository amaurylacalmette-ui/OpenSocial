import { create } from 'zustand';
import type { Account, Post, Automation } from '@/lib/types';

export type View = 'dashboard' | 'composer' | 'posts' | 'automations' | 'analytics' | 'ai' | 'accounts' | 'settings';

interface OSState {
  view: View;
  setView: (v: View) => void;
  accounts: Account[];
  posts: Post[];
  automations: Automation[];
  loaded: boolean;
  loading: boolean;
  keys: Record<string, boolean>;
  composerSeed: string | null;
  setComposerSeed: (s: string | null) => void;
  loadAll: () => Promise<void>;
  loadKeys: () => Promise<void>;
}

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const useOS = create<OSState>((set) => ({
  view: 'dashboard',
  setView: (v) => set({ view: v }),
  accounts: [],
  posts: [],
  automations: [],
  loaded: false,
  loading: false,
  keys: {},
  composerSeed: null,
  setComposerSeed: (s) => set({ composerSeed: s }),
  loadAll: async () => {
    set({ loading: true });
    try {
      const [a, p, au] = await Promise.all([
        jget<{ accounts: Account[] }>('/api/accounts'),
        jget<{ posts: Post[] }>('/api/posts'),
        jget<{ automations: Automation[] }>('/api/automations'),
      ]);
      set({ accounts: a.accounts, posts: p.posts, automations: au.automations, loaded: true });
    } finally {
      set({ loading: false });
    }
  },
  loadKeys: async () => {
    try {
      const k = await jget<{ keys: { provider: string; configured: boolean }[] }>('/api/settings');
      set({ keys: Object.fromEntries(k.keys.map((x) => [x.provider, x.configured])) });
    } catch {
      /* offline */
    }
  },
}));
