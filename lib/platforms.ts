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

// ---------------------------------------------------------------------------
// Real platform integrations — what each network needs to connect & publish
// ---------------------------------------------------------------------------

export interface AuthField {
  key: string;
  label: string;
  placeholder: string;
  /** Rendered as a password input client-side; stored server-side only. */
  secret?: boolean;
  help?: string;
  helpUrl?: string;
}

export interface PlatformAuth {
  fields: AuthField[];
  /** native = posts via the platform API · media-required = needs an image attachment · not-supported = API limitation, connect still syncs profile/analytics */
  posting: 'native' | 'media-required' | 'not-supported';
  note?: string;
}

export const PLATFORM_AUTH: Record<PlatformId, PlatformAuth> = {
  bluesky: {
    fields: [
      { key: 'identifier', label: 'Handle', placeholder: 'you.bsky.social', help: 'Your Bluesky handle or the email on the account.' },
      { key: 'appPassword', label: 'App password', placeholder: 'xxxx-xxxx-xxxx-xxxx', secret: true, help: 'Create one under Settings → App passwords. Never your real password.', helpUrl: 'https://bsky.app/settings/app-passwords' },
    ],
    posting: 'native',
  },
  mastodon: {
    fields: [
      { key: 'instance', label: 'Instance', placeholder: 'mastodon.social', help: 'The server your account lives on.' },
      { key: 'accessToken', label: 'Access token', placeholder: 'Paste your token', secret: true, help: 'Preferences → Development → New application (read + write scopes) → copy the access token.', helpUrl: 'https://mastodon.social/settings/applications' },
    ],
    posting: 'native',
  },
  x: {
    fields: [
      { key: 'appKey', label: 'API key (consumer key)', placeholder: 'From your X developer app', secret: true, helpUrl: 'https://developer.x.com/en/portal/dashboard' },
      { key: 'appSecret', label: 'API key secret', placeholder: 'Consumer secret', secret: true },
      { key: 'accessToken', label: 'Access token', placeholder: 'Access token for your account', secret: true },
      { key: 'accessSecret', label: 'Access token secret', placeholder: 'Access token secret', secret: true },
    ],
    posting: 'native',
    note: 'Create a developer app with Read & Write permissions and generate your account tokens in the portal.',
  },
  linkedin: {
    fields: [
      { key: 'accessToken', label: 'Access token', placeholder: 'Paste your member access token', secret: true, help: 'From your LinkedIn app (w_member_social scope). Tokens live ~60 days.', helpUrl: 'https://www.linkedin.com/developers/apps' },
    ],
    posting: 'native',
  },
  threads: {
    fields: [
      { key: 'userId', label: 'Threads user ID', placeholder: 'Numeric ID from your Meta app', help: 'GET /{threads-user-id} from your Meta app dashboard, or the authorized user probe.' },
      { key: 'accessToken', label: 'Access token', placeholder: 'Paste your token', secret: true, help: 'threads_meta scope on a Meta app.', helpUrl: 'https://threads.meta.com' },
    ],
    posting: 'native',
  },
  facebook: {
    fields: [
      { key: 'pageId', label: 'Page ID', placeholder: 'Numeric page id', help: 'Visible in your Page → About, or via /me? with a page token.' },
      { key: 'pageToken', label: 'Page access token', placeholder: 'Paste the page token', secret: true, help: 'Pages API permission + page token (not a user token).', helpUrl: 'https://developers.facebook.com/docs/pages-api' },
    ],
    posting: 'native',
  },
  instagram: {
    fields: [
      { key: 'userId', label: 'Instagram business user ID', placeholder: 'Numeric IG user id', help: 'Professional/creator account linked to a Meta app.' },
      { key: 'accessToken', label: 'Access token', placeholder: 'Paste your token', secret: true, help: 'instagram_content_publish scope.', helpUrl: 'https://developers.facebook.com/docs/instagram-platform/content-publishing' },
    ],
    posting: 'media-required',
    note: 'The Instagram API only publishes media — attach an image (URL) in the composer for this target.',
  },
  reddit: {
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'From your reddit script app', secret: true, helpUrl: 'https://www.reddit.com/prefs/apps' },
      { key: 'clientSecret', label: 'Client secret', placeholder: 'Script app secret', secret: true },
      { key: 'refreshToken', label: 'Refresh token', placeholder: 'Long-lived refresh token', secret: true, help: 'From the script-app OAuth dance (identity, submit, read scopes).' },
      { key: 'subreddit', label: 'Subreddit', placeholder: 'e.g. sideproject', help: 'Where text posts get submitted (without r/).' },
    ],
    posting: 'native',
    note: 'OpenSocial exchanges the refresh token for an access token on every publish automatically.',
  },
  pinterest: {
    fields: [
      { key: 'accessToken', label: 'Access token', placeholder: 'Paste your token', secret: true, help: 'boards:read + pins:write scopes.', helpUrl: 'https://developers.pinterest.com/apps/' },
      { key: 'boardId', label: 'Board ID', placeholder: 'Board to pin into', help: 'From GET /v5/boards, or the board URL id.' },
    ],
    posting: 'media-required',
    note: 'Pins require an image — attach an image (URL) in the composer for this target.',
  },
  youtube: {
    fields: [
      { key: 'accessToken', label: 'OAuth access token', placeholder: 'youtube.readonly scope token', secret: true, helpUrl: 'https://developers.google.com/youtube/v3/guides/auth' },
    ],
    posting: 'not-supported',
    note: 'The YouTube API has no text-post endpoint. Connect keeps your channel name and subscriber count synced into analytics.',
  },
  tiktok: {
    fields: [
      { key: 'accessToken', label: 'Access token', placeholder: 'user.info.basic scope token', secret: true, helpUrl: 'https://developers.tiktok.com/doc/overview/' },
    ],
    posting: 'not-supported',
    note: 'Direct Post requires TikTok\u2019s audited API access. Connect syncs your profile and follower count for analytics.',
  },
};

export function platformAuth(id: string): PlatformAuth | null {
  return PLATFORM_AUTH[id as PlatformId] ?? null;
}

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
