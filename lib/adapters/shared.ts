/**
 * Shared plumbing for platform adapters.
 *
 * Every network call here is real: these functions talk to the platforms'
 * public APIs with credentials the user supplies. There is no simulation
 * anywhere in this directory — failures surface as PlatformError with the
 * API's actual message.
 */

export class PlatformError extends Error {
  /** HTTP status from the platform (401/403 → account should be marked expired). */
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PlatformError';
    this.status = status;
  }
}

export type Credentials = Record<string, string>;

export interface VerifiedProfile {
  username: string;
  displayName: string;
  followers: number | null;
  remoteId: string | null;
  remoteUrl: string | null;
  credentials: Credentials;
}

export interface DeliveryResult {
  remoteId: string | null;
  remoteUrl: string | null;
}

export interface RealMetrics {
  likes?: number;
  comments?: number;
  shares?: number;
  impressions?: number;
  clicks?: number;
}

export interface PlatformAdapter {
  /** Validate credentials against the live API and pull the real profile. */
  verify(creds: Credentials): Promise<VerifiedProfile>;
  /** Publish text (and optional image) for real. Throws PlatformError on failure. */
  deliver(creds: Credentials, text: string, mediaUrl: string | null, handle: string): Promise<DeliveryResult>;
  /** Pull real engagement numbers for a published post, if the API exposes them. */
  fetchMetrics?(creds: Credentials, remoteId: string): Promise<RealMetrics>;
}

const TIMEOUT_MS = 20_000;

/** Fetch wrapper: real network call, real error messages, 20s timeout. */
export async function api(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  } catch (e) {
    const msg = (e as Error).name === 'TimeoutError' ? 'request timed out' : (e as Error).message;
    throw new PlatformError(`Network error talking to the platform: ${msg}`);
  }
  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new PlatformError(`HTTP ${res.status}${detail ? ` — ${detail}` : ''}`, res.status);
  }
  return res;
}

/** Best-effort extraction of the platform's own error message. */
async function errorDetail(res: Response): Promise<string> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    try { return (await res.text()).slice(0, 200); } catch { return ''; }
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const err = b?.error;
  const candidates: unknown[] = [
    typeof err === 'string' ? err : (err as Record<string, unknown>)?.message,
    (err as Record<string, unknown>)?.error_description,
    b?.error_description,
    b?.message,
    b?.detail,
    b?.details && (b.details as Record<string, unknown>).error,
    Array.isArray(b?.errors) ? (b.errors as { message?: string }[])[0]?.message : undefined,
  ];
  const found = candidates.find((c) => typeof c === 'string' && c.length > 0) as string | undefined;
  if (found) return found.slice(0, 300);
  try { return JSON.stringify(body).slice(0, 300); } catch { return ''; }
}

export async function apiJson<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await api(url, init);
  return res.json() as Promise<T>;
}

/** Download an image attachment so it can be uploaded to platforms that accept binary blobs. */
export async function fetchImage(url: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  } catch (e) {
    throw new PlatformError(`Could not download the attached image: ${(e as Error).message}`);
  }
  if (!res.ok) throw new PlatformError(`Could not download the attached image (HTTP ${res.status}). Check that the URL is publicly reachable.`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) throw new PlatformError(`Attachment URL returned "${contentType}", not an image.`);
  return { bytes: await res.arrayBuffer(), contentType };
}

/** Fail fast with a human message when required credential fields are missing. */
export function requireFields(creds: Credentials, platform: string, keys: string[]): void {
  const missing = keys.filter((k) => !(creds[k] ?? '').trim());
  if (missing.length > 0) throw new PlatformError(`Missing ${platform} credential(s): ${missing.join(', ')}. Reconnect the account in Accounts.`, 401);
}

/** Poll a platform for container/processing status up to `tries` times. */
export async function pollUntil(check: () => Promise<'done' | 'pending' | 'error'>, tries: number, delayMs: number): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const state = await check();
    if (state === 'done') return;
    if (state === 'error') throw new PlatformError('The platform rejected the media while processing it.');
    await sleep(delayMs);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
