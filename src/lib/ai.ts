import { db } from '@/lib/db';

export type ProviderId = 'publihq' | 'openrouter' | 'openai';

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  description: string;
  keyPrefixHint: string;
  defaultModel: string;
  modelsEndpoint?: string;
  keyUrl: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  publihq: {
    id: 'publihq',
    name: 'PubliHQ',
    description: 'Unified LLM gateway. Bring your PubliHQ key.',
    keyPrefixHint: 'phq-…',
    defaultModel: 'publihq-large',
    keyUrl: 'https://publihq.com',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '400+ models, one key. Auto-picks the best free model.',
    keyPrefixHint: 'sk-or-…',
    defaultModel: 'auto-free',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    keyUrl: 'https://openrouter.ai/keys',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'Direct GPT models with your OpenAI key.',
    keyPrefixHint: 'sk-…',
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
};

export const PROVIDER_BASE_URLS: Record<ProviderId, string> = {
  publihq: 'https://api.publihq.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
};

export async function getApiKey(provider: ProviderId): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: `ai_key_${provider}` } });
  return row?.value ?? null;
}

export async function getAllKeys(): Promise<Record<ProviderId, string | null>> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'ai_key_' } } });
  const out = { publihq: null, openrouter: null, openai: null } as Record<ProviderId, string | null>;
  for (const r of rows) {
    const p = r.key.replace('ai_key_', '') as ProviderId;
    if (p in out) out[p] = r.value;
  }
  return out;
}

// Known-good free models on OpenRouter, in preference order.
const FREE_MODEL_PREFERENCE = [
  'deepseek/deepseek-chat-v3-0324:free',
  'deepseek/deepseek-r1:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-nemo:free',
];

interface OpenRouterModel {
  id: string;
  pricing?: { prompt?: string; completion?: string };
  context_length?: number;
}

let freeModelCache: { model: string; at: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

export async function pickFreeOpenRouterModel(): Promise<{ model: string; reason: string }> {
  if (freeModelCache && Date.now() - freeModelCache.at < CACHE_TTL) {
    return { model: freeModelCache.model, reason: 'cached free model' };
  }
  try {
    const res = await fetch(PROVIDER_BASE_URLS.openrouter + '/models', {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`models ${res.status}`);
    const json = (await res.json()) as { data: OpenRouterModel[] };
    const free = (json.data ?? []).filter(
      (m) => m.pricing && Number(m.pricing.prompt ?? 1) === 0 && Number(m.pricing.completion ?? 1) === 0
    );
    if (free.length === 0) throw new Error('no free models');

    let chosen: OpenRouterModel | undefined;
    for (const pref of FREE_MODEL_PREFERENCE) {
      const hit = free.find((m) => m.id === pref);
      if (hit) { chosen = hit; break; }
    }
    if (!chosen) {
      const probed = free.filter((m) => !/vision|image|embedding|whisper|tts|guard/i.test(m.id));
      chosen = (probed.length ? probed : free).sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))[0];
    }
    freeModelCache = { model: chosen.id, at: Date.now() };
    return { model: chosen.id, reason: `auto-selected from ${free.length} free models` };
  } catch {
    const fallback = FREE_MODEL_PREFERENCE[0];
    freeModelCache = { model: fallback, at: Date.now() };
    return { model: fallback, reason: 'fallback preference list' };
  }
}

export function providerEndpoint(provider: ProviderId): string {
  return PROVIDER_BASE_URLS[provider] + '/chat/completions';
}

export function providerHeaders(provider: ProviderId, apiKey: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === 'openrouter') {
    h['HTTP-Referer'] = 'https://opensocial.local';
    h['X-Title'] = 'OpenSocial';
  }
  return h;
}

export const SYSTEM_PROMPT = `You are OpenSocial AI, an assistant inside a social media management tool. You help creators draft posts, adapt copy for specific platforms (X, Instagram, TikTok, LinkedIn, Facebook, Threads, Bluesky, Mastodon, YouTube, Pinterest, Reddit), suggest hashtags, analyze engagement, brainstorm content calendars, and answer questions about social strategy. When asked to write a post, format it ready-to-publish. Be concise, practical, and never add meta commentary about being an AI unless asked. Use markdown sparingly (bold for emphasis, short lists).`;
