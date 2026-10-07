'use client';

import { XIcon, InstagramIcon, TikTokIcon, LinkedInIcon, FacebookIcon, ThreadsIcon, BlueskyIcon, MastodonIcon, YouTubeIcon, PinterestIcon, RedditIcon } from './platform-icons';
import { cn } from '@/lib/utils';

const MAP: Record<string, (props: { className?: string; style?: React.CSSProperties }) => React.ReactElement> = {
  x: XIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  linkedin: LinkedInIcon,
  facebook: FacebookIcon,
  threads: ThreadsIcon,
  bluesky: BlueskyIcon,
  mastodon: MastodonIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
  reddit: RedditIcon,
};

export function PlatformIcon({ platform, className, style }: { platform: string; className?: string; style?: React.CSSProperties }) {
  const Cmp = MAP[platform];
  if (!Cmp) return <span className={cn('inline-block h-4 w-4 rounded-full bg-muted', className)} style={style} />;
  return <Cmp className={className} style={style} />;
}

export function PlatformAvatar({
  platform,
  color,
  className,
  size = 'md',
}: {
  platform: string;
  color?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = { sm: 'h-6 w-6', md: 'h-9 w-9', lg: 'h-12 w-12' };
  const iconSizes = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-lg text-white shadow-sm', sizes[size], className)}
      style={{ background: color ?? 'linear-gradient(135deg, #8b5cf6, #d946ef)' }}
    >
      <PlatformIcon platform={platform} className={iconSizes[size]} />
    </span>
  );
}
