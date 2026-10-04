export interface Account {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  avatarColor: string;
  followers: number;
  autoPost: boolean;
  status: string;
  connectedAt: string;
  _count?: { targets: number };
}

export interface PostTarget {
  id: string;
  postId: string;
  accountId: string;
  platform: string;
  content: string | null;
  status: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  clicks: number;
  publishedAt: string | null;
  account?: Account;
}

export interface Post {
  id: string;
  content: string;
  mediaUrl: string | null;
  status: 'draft' | 'scheduled' | 'queued' | 'published' | 'failed';
  scheduledAt: string | null;
  publishedAt: string | null;
  source: string;
  automationId: string | null;
  createdAt: string;
  targets: PostTarget[];
}

export interface Automation {
  id: string;
  name: string;
  sourcePlatform: string;
  targetPlatforms: string[];
  delayMinutes: number;
  template: string | null;
  enabled: boolean;
  runs: number;
  createdAt: string;
}

export interface ChatMsg {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string | null;
  model?: string | null;
  createdAt?: string;
}

export interface Analytics {
  totals: {
    followers: number;
    impressions: number;
    engagements: number;
    clicks: number;
    posts: number;
    engagementRate: number;
    connectedAccounts: number;
  };
  growth: { date: string; followers: number }[];
  platformBreakdown: { platform: string; followers: number; impressions: number; engagements: number; posts: number }[];
  engagementSeries: { date: string; engagements: number; impressions: number }[];
  topPosts: {
    id: string;
    content: string;
    platforms: string[];
    publishedAt: string | null;
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
    engagementRate: number;
  }[];
}
