/**
 * Adapter registry — one real integration per platform.
 * `getAdapter('bluesky')` etc. Returns null for unknown platforms.
 */
import type { PlatformAdapter } from './shared';
import { bluesky } from './bluesky';
import { mastodon } from './mastodon';
import { x } from './x';
import { linkedin } from './linkedin';
import { threads } from './threads';
import { facebook } from './facebook';
import { instagram } from './instagram';
import { reddit } from './reddit';
import { pinterest } from './pinterest';
import { youtube } from './youtube';
import { tiktok } from './tiktok';

const ADAPTERS: Record<string, PlatformAdapter> = {
  bluesky,
  mastodon,
  x,
  linkedin,
  threads,
  facebook,
  instagram,
  reddit,
  pinterest,
  youtube,
  tiktok,
};

export function getAdapter(platform: string): PlatformAdapter | null {
  return ADAPTERS[platform] ?? null;
}

export { PlatformError } from './shared';
export type { Credentials, DeliveryResult, RealMetrics, VerifiedProfile } from './shared';
