/**
 * OAuth connect flows — v1.1.0 "Handshake".
 *
 * Dependency-free OAuth for the platforms that allow self-serve connecting:
 *
 *  - Mastodon  → the OpenSocial app is registered dynamically on the user's
 *                own instance, so connecting needs nothing but the domain.
 *  - Reddit    → a one-time paste of the user's web-app client id/secret,
 *                then every connect is a single authorization click and the
 *                refresh token comes back automatically.
 *  - X         → a one-time paste of the consumer key/secret, then the full
 *                OAuth 1.0a request-token → authorize → access-token dance
 *                replaces manual token generation in the dev portal.
 *
 * Authorization state lives in the Setting table (server-side SQLite) with a
 * 10-minute TTL. Secrets never leave the server; the browser only ever sees
 * redirects and masked previews.
 */
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { PlatformError } from '@/lib/adapters';

export type OAuthPlatform = 'mastodon' | 'reddit' | 'x';
export const OAUTH_PLATFORMS: OAuthPlatform[] = ['mastodon', 'reddit', 'x'];

export function isOAuthPlatform(p: string): p is OAuthPlatform {
  return (OAUTH_PLATFORMS as string[]).includes(p);
}

const PENDING_TTL_MS = 10 * 60 * 1000;
const UA = 'OpenSocial/1.0 (self-hosted cross-poster)';

// ---------------------------------------------------------------------------
// Request origin — behind the sandbox gateway the forwarded host is the truth.
// ---------------------------------------------------------------------------

export function originOf(req: Request): string {
  const h = req.headers;
  const proto = h.get('x-forwarded-proto')?.split(',')[0] ?? new URL(req.url).protocol.replace(':', '');
  const host = h.get('x-forwarded-host')?.split(',')[0] ?? h.get('host') ?? new URL(req.url).host;
  return `${proto}://${host}`;
}

export function callbackUrl(req: Request, platform: string): string {
  return `${originOf(req)}/api/oauth/callback/${platform}`;
}

// ---------------------------------------------------------------------------
// Pending-state storage (Setting table, TTL-checked, single-use)
// ---------------------------------------------------------------------------

interface PendingState {
  platform: OAuthPlatform;
  redirectTo: string;
  instance?: string;
  clientId?: string;
  clientSecret?: string;
  requestTokenSecret?: string;
  createdAt: number;
  expiresAt: number;
}

async function putPending(state: string, data: PendingState): Promise<void> {
  await db.setting.upsert({
    where: { key: `oauth:pending:${state}` },
    update: { value: JSON.stringify(data) },
    create: { key: `oauth:pending:${state}`, value: JSON.stringify(data) },
  });
}

async function takePending(state: string): Promise<PendingState> {
  const key = `oauth:pending:${state}`;
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) throw new PlatformError('Unknown or expired authorization attempt — start the connection again.', 400);
  await db.setting.delete({ where: { key } });
  const data = JSON.parse(row.value) as PendingState;
  if (Date.now() > data.expiresAt) {
    throw new PlatformError('The authorization attempt timed out — start the connection again.', 400);
  }
  return data;
}

export { takePending };

// ---------------------------------------------------------------------------
// Developer-app config for reddit / X (stored once, reused for every connect)
// ---------------------------------------------------------------------------

export interface RedditAppConfig { clientId: string; clientSecret: string; subreddit?: string }
export interface XAppConfig { consumerKey: string; consumerSecret: string }

export async function getRedditAppConfig(): Promise<RedditAppConfig | null> {
  const row = await db.setting.findUnique({ where: { key: 'oauth:app:reddit' } });
  return row ? (JSON.parse(row.value) as RedditAppConfig) : null;
}

export async function getXAppConfig(): Promise<XAppConfig | null> {
  const row = await db.setting.findUnique({ where: { key: 'oauth:app:x' } });
  return row ? (JSON.parse(row.value) as XAppConfig) : null;
}

export async function saveRedditAppConfig(cfg: RedditAppConfig): Promise<void> {
  await db.setting.upsert({
    where: { key: 'oauth:app:reddit' },
    update: { value: JSON.stringify(cfg) },
    create: { key: 'oauth:app:reddit', value: JSON.stringify(cfg) },
  });
}

export async function saveXAppConfig(cfg: XAppConfig): Promise<void> {
  await db.setting.upsert({
    where: { key: 'oauth:app:x' },
    update: { value: JSON.stringify(cfg) },
    create: { key: 'oauth:app:x', value: JSON.stringify(cfg) },
  });
}

function mask(s: string): string {
  if (s.length <= 6) return '••••••';
  return `${s.slice(0, 3)}••••${s.slice(-4)}`;
}

export async function oauthConfigStatus() {
  const [reddit, x] = await Promise.all([getRedditAppConfig(), getXAppConfig()]);
  return {
    mastodon: { configured: true as const, kind: 'host' as const },
    reddit: {
      configured: !!reddit,
      kind: 'app' as const,
      preview: reddit ? mask(reddit.clientId) : null,
      subreddit: reddit?.subreddit ?? null,
    },
    x: {
      configured: !!x,
      kind: 'app' as const,
      preview: x ? mask(x.consumerKey) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Mastodon — dynamic app registration on the user's instance
// ---------------------------------------------------------------------------

interface MastodonAppRegistration { clientId: string; clientSecret: string; redirectUri: string }

function normalizeInstance(raw: string): string {
  const trimmed = raw.trim().replace(/^https?:\/\//i, '').replace(/\/+.*$/, '').toLowerCase();
  if (!trimmed || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)) {
    throw new PlatformError(`"${raw.trim()}" doesn't look like an instance domain — try mastodon.social.`, 400);
  }
  return trimmed;
}

async function getMastodonApp(host: string, redirectUri: string): Promise<MastodonAppRegistration> {
  const key = `oauth:app:mastodon:${host}`;
  const row = await db.setting.findUnique({ where: { key } });
  if (row) {
    const app = JSON.parse(row.value) as MastodonAppRegistration;
    // Re-register when the callback host changed (localhost ↔ deployed domain).
    if (app.redirectUri === redirectUri) return app;
  }
  const res = await fetch(`https://${host}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      client_name: 'OpenSocial',
      redirect_uris: redirectUri,
      scopes: 'read write',
      website: 'https://github.com/amaurylacalmette-ui/OpenSocial',
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new PlatformError(`Could not register OpenSocial on ${host} (HTTP ${res.status}). Is the instance up and reachable? ${detail.slice(0, 160)}`, res.status);
  }
  const app = (await res.json()) as { client_id: string; client_secret: string };
  const registration: MastodonAppRegistration = { clientId: app.client_id, clientSecret: app.client_secret, redirectUri };
  await db.setting.upsert({
    where: { key },
    update: { value: JSON.stringify(registration) },
    create: { key, value: JSON.stringify(registration) },
  });
  return registration;
}

export async function mastodonStart(instanceRaw: string, redirectUri: string): Promise<string> {
  const host = normalizeInstance(instanceRaw);
  const app = await getMastodonApp(host, redirectUri);
  const state = crypto.randomBytes(16).toString('hex');
  await putPending(state, {
    platform: 'mastodon',
    instance: host,
    clientId: app.clientId,
    clientSecret: app.clientSecret,
    redirectTo: redirectUri,
    createdAt: Date.now(),
    expiresAt: Date.now() + PENDING_TTL_MS,
  });
  const url = new URL(`https://${host}/oauth/authorize`);
  url.searchParams.set('client_id', app.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'read write');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function mastodonCallback(code: string, pending: PendingState): Promise<Record<string, string>> {
  const res = await fetch(`https://${pending.instance}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: pending.clientId,
      client_secret: pending.clientSecret,
      redirect_uri: pending.redirectTo,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new PlatformError(`Mastodon rejected the token exchange (HTTP ${res.status}). ${detail.slice(0, 160)}`, res.status);
  }
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new PlatformError('Mastodon did not return an access token.');
  return { instance: pending.instance!, accessToken: j.access_token };
}

// ---------------------------------------------------------------------------
// Reddit — OAuth 2.0 authorization-code flow against the user's web app
// ---------------------------------------------------------------------------

export async function redditStart(redirectUri: string): Promise<string> {
  const cfg = await getRedditAppConfig();
  if (!cfg) throw new PlatformError('Reddit is not configured yet — paste your web-app client id and secret first.', 400);
  const state = crypto.randomBytes(16).toString('hex');
  await putPending(state, { platform: 'reddit', redirectTo: redirectUri, createdAt: Date.now(), expiresAt: Date.now() + PENDING_TTL_MS });
  const url = new URL('https://www.reddit.com/api/v1/authorize');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('duration', 'permanent');
  url.searchParams.set('scope', 'identity submit read');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function redditCallback(code: string, pending: PendingState): Promise<Record<string, string>> {
  const cfg = await getRedditAppConfig();
  if (!cfg) throw new PlatformError('Reddit app config was removed mid-flow — save it and try again.', 400);
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: pending.redirectTo,
    }).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new PlatformError(`Reddit rejected the token exchange (HTTP ${res.status}). ${detail.slice(0, 160)}`, res.status);
  }
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; error?: string };
  if (j.error) throw new PlatformError(`Reddit said: ${j.error}`);
  // Reddit only issues a refresh token on the FIRST authorization of an app —
  // re-connects of an already-authorized app return none.
  if (!j.refresh_token) {
    throw new PlatformError('Reddit did not return a refresh token (it only does on first authorization). Revoke OpenSocial under reddit → Settings → Apps, then connect again.');
  }
  const credentials: Record<string, string> = {
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    refreshToken: j.refresh_token,
  };
  if (cfg.subreddit?.trim()) credentials.subreddit = cfg.subreddit.trim();
  return credentials;
}

// ---------------------------------------------------------------------------
// X — OAuth 1.0a 3-legged flow (request token → authorize → access token)
// ---------------------------------------------------------------------------

function enc(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Signed OAuth 1.0a header for the request/access token endpoints (header params only). */
function oauth1Header(method: string, url: string, consumerKey: string, consumerSecret: string, params: Record<string, string>, tokenSecret = ''): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...params,
  };
  const baseParams = Object.keys(oauth).sort().map((k) => `${enc(k)}=${enc(oauth[k])}`).join('&');
  const base = `${method.toUpperCase()}&${enc(url)}&${enc(baseParams)}`;
  const key = `${enc(consumerSecret)}&${enc(tokenSecret)}`;
  const signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  const headerParams = { ...oauth, oauth_signature: signature };
  return `OAuth ${Object.keys(headerParams).sort().map((k) => `${enc(k)}="${enc(headerParams[k])}"`).join(', ')}`;
}

async function oauth1TokenEndpoint(url: string, header: string): Promise<Record<string, string>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: header, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: '',
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new PlatformError(`X rejected the OAuth step (HTTP ${res.status}). ${text.slice(0, 160)}`, res.status);
  const parsed = Object.fromEntries(new URLSearchParams(text));
  if (parsed.oauth_callback_confirmed === 'false') {
    throw new PlatformError('X did not confirm the callback URL — set the callback in your developer app settings.');
  }
  return parsed;
}

export async function xStart(redirectUri: string): Promise<string> {
  const cfg = await getXAppConfig();
  if (!cfg) throw new PlatformError('X is not configured yet — paste your developer-app consumer key and secret first.', 400);
  const oauthToken = await oauth1TokenEndpoint(
    'https://api.twitter.com/oauth/request_token',
    oauth1Header('POST', 'https://api.twitter.com/oauth/request_token', cfg.consumerKey, cfg.consumerSecret, {
      oauth_callback: redirectUri,
    }),
  );
  if (!oauthToken.oauth_token || !oauthToken.oauth_token_secret) throw new PlatformError('X did not return a request token.');
  const state = crypto.randomBytes(16).toString('hex');
  await putPending(state, {
    platform: 'x',
    redirectTo: redirectUri,
    requestTokenSecret: oauthToken.oauth_token_secret,
    createdAt: Date.now(),
    expiresAt: Date.now() + PENDING_TTL_MS,
  });
  // X's authorize endpoint takes the request token, not our state — map it so
  // the callback can find the pending record by state (X echoes oauth_token).
  await db.setting.upsert({
    where: { key: `oauth:x-token:${oauthToken.oauth_token}` },
    update: { value: state },
    create: { key: `oauth:x-token:${oauthToken.oauth_token}`, value: state },
  });
  return `https://api.twitter.com/oauth/authorize?oauth_token=${encodeURIComponent(oauthToken.oauth_token)}`;
}

export async function xCallback(oauthToken: string, verifier: string, pending: PendingState): Promise<Record<string, string>> {
  const cfg = await getXAppConfig();
  if (!cfg) throw new PlatformError('X app config was removed mid-flow — save it and try again.', 400);
  const tokens = await oauth1TokenEndpoint(
    'https://api.twitter.com/oauth/access_token',
    oauth1Header('POST', 'https://api.twitter.com/oauth/access_token', cfg.consumerKey, cfg.consumerSecret, {
      oauth_token: oauthToken,
      oauth_verifier: verifier,
    }, pending.requestTokenSecret ?? ''),
  );
  if (!tokens.oauth_token || !tokens.oauth_token_secret) throw new PlatformError('X did not return access tokens.');
  return {
    appKey: cfg.consumerKey,
    appSecret: cfg.consumerSecret,
    accessToken: tokens.oauth_token,
    accessSecret: tokens.oauth_token_secret,
  };
}

/** X's authorize step echoes the request token, not our state — resolve it. */
export async function resolveXState(oauthToken: string): Promise<string | null> {
  const key = `oauth:x-token:${oauthToken}`;
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return null;
  await db.setting.delete({ where: { key } });
  return row.value;
}
