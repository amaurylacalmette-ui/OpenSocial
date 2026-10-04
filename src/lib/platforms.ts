export type PlatformId =
  | 'x'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'facebook'
  | 'threads'
  | 'bluesky'
  | 'mastodon'
  | 'youtube'
  | 'pinterest'
  | 'reddit';

export interface PlatformMeta {
  id: PlatformId;
  name: string;
  color: string;
  gradient: string;
  charLimit: number;
  hint: string;
}

export const PLATFORMS: Record<PlatformId, PlatformMeta> = {
  x: {
    id: 'x',
    name: 'X',
    color: '#000000',
    gradient: 'from-neutral-800 to-black',
    charLimit: 280,
    hint: 'Short and punchy. Threads well.',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    color: '#E1306C',
    gradient: 'from-fuchsia-500 via-rose-500 to-amber-400',
    charLimit: 2200,
    hint: 'Visual first. Hashtags help.',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    color: '#00C0C7',
    gradient: 'from-teal-500 via-neutral-900 to-rose-500',
    charLimit: 2200,
    hint: 'Video captions. Trend-aware.',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    color: '#0A66C2',
    gradient: 'from-sky-700 to-sky-900',
    charLimit: 3000,
    hint: 'Professional tone performs best.',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    gradient: 'from-blue-600 to-blue-800',
    charLimit: 63206,
    hint: 'Community and link friendly.',
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    color: '#111111',
    gradient: 'from-neutral-700 to-neutral-950',
    charLimit: 500,
    hint: 'Conversational. Keep it casual.',
  },
  bluesky: {
    id: 'bluesky',
    name: 'Bluesky',
    color: '#0A7AFF',
    gradient: 'from-sky-500 to-blue-600',
    charLimit: 300,
    hint: 'Short posts, 300 char limit.',
  },
  mastodon: {
    id: 'mastodon',
    name: 'Mastodon',
    color: '#6364FF',
    gradient: 'from-violet-600 to-indigo-700',
    charLimit: 500,
    hint: 'Federated. Content warnings common.',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    color: '#FF0000',
    gradient: 'from-red-600 to-rose-700',
    charLimit: 5000,
    hint: 'Titles + descriptions. SEO matters.',
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    color: '#E60023',
    gradient: 'from-rose-600 to-red-700',
    charLimit: 500,
    hint: 'Evergreen how-to content.',
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    color: '#FF4500',
    gradient: 'from-orange-500 to-red-600',
    charLimit: 40000,
    hint: 'Authentic. Reddits hate ads.',
  },
};

export const PLATFORM_LIST: PlatformMeta[] = Object.values(PLATFORMS);

export function platformName(id: string): string {
  return PLATFORMS[id as PlatformId]?.name ?? id;
}

export function platformColor(id: string): string {
  return PLATFORMS[id as PlatformId]?.color ?? '#7c3aed';
}

export function platformCharLimit(id: string): number {
  return PLATFORMS[id as PlatformId]?.charLimit ?? 1000;
}

export function PlatformGlyph({ platform, className }: { platform: string; className?: string }) {
  // resolved dynamically via map in platform-icons consumer
  return null as unknown as JSX.Element;
}
