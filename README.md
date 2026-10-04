<div align="center">

<img src="docs/screenshots/dashboard.png" alt="OpenSocial dashboard" width="100%"/>

# OpenSocial

**One composer, every platform.**

Link your social accounts, write once, publish everywhere — with automations, analytics and an AI co-writer built in.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-8b5cf6.svg)](LICENSE)

</div>

---

## Why

Every creator knows the drill: the same post gets retyped five times across five tabs. OpenSocial collapses that into a single workspace — compose, tailor per platform, schedule or publish, and let automations handle the re-posting while analytics show what actually worked.

## Features

**Composer** — write once, publish to every linked account at once. Per-platform character limits are enforced live, each platform can get a customized variant of the text, image attachments by URL, plus a real-time preview that mimics how the post will look on X, Instagram, LinkedIn and friends. Publish immediately, schedule for later, or save a draft.

**Automations** — cross-posting rules that run themselves. "When I post to X → also post to Threads and Bluesky after 5 minutes." Text is trimmed to each platform's limit automatically, delays are configurable, and every rule tracks its own run count. A background worker publishes anything due.

**Analytics** — audience growth, engagement over time, impressions trend, per-platform performance with engagement rates, and a top-performing-posts leaderboard. Everything is computed from your own accounts and posting history — the dashboard is empty until you bring data in, and nothing is generated for you.

**AI Assistant** — streaming chat that drafts posts, builds content calendars, suggests hashtags and sharpens hooks. One-click "send to composer" on any reply. Works with three providers:

| Provider | Model handling | Get a key |
|---|---|---|
| **OpenRouter** | **Auto** — scans all `$0` free models, picks the strongest available per message | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **PubliHQ** | Gateway default model, streaming | [publihq.com](https://publihq.com) |
| **OpenAI** | `gpt-4o-mini` by default, streaming | [platform.openai.com](https://platform.openai.com/api-keys) |

**Accounts** — connect profiles across X, Instagram, TikTok, LinkedIn, Facebook, Threads, Bluesky, Mastodon, YouTube, Pinterest and Reddit. Each account has its own cross-post toggle, and follower tracking starts the day you link it.

| | | |
|:---:|:---:|:---:|
| ![](docs/screenshots/composer.png) | ![](docs/screenshots/analytics.png) | ![](docs/screenshots/ai-assistant.png) |
| *Composer + live preview* | *Analytics* | *AI Assistant* |
| ![](docs/screenshots/accounts.png) | ![](docs/screenshots/automations.png) | |
| *Account linking* | *Automations* | |

## Quick start

```bash
git clone https://github.com/your-username/opensocial.git
cd opensocial
cp .env.example .env
bun install          # or: npm install / pnpm install
bun run db:generate  # or: npx prisma generate
bun run db:push      # or: npx prisma db push
bun run dev          # or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The workspace starts **completely empty** — no demo accounts, no sample posts, no invented numbers. A getting-started card walks you through the three steps: link an account, publish something, set up an automation.

> Want a clean slate later? **Settings → Clear workspace** wipes everything (AI keys are kept), or run `bun run db:reset`.

## Linking accounts

The connect flow works out of the box: pick a platform, enter the handle and (optionally) the account's current follower count — that number becomes the first data point in your growth chart, and everything after it is real tracking. This runs in **demo mode** — it stores the handle and preferences without contacting the platform, so you can build and evaluate the whole workflow without registering developer apps.

Going live with real posting is a per-platform OAuth integration. The publishing engine (`src/lib/publisher.ts`) is the single choke point: wherever `publishPost` marks a target as delivered, call the platform's API instead and map the returned engagement into `PostTarget`. Start points:

| Platform | Developer portal |
|---|---|
| X / Twitter | [developer.x.com](https://developer.x.com) |
| Instagram | [developers.facebook.com](https://developers.facebook.com/docs/instagram-platform) |
| TikTok | [developers.tiktok.com](https://developers.tiktok.com) |
| LinkedIn | [learn.microsoft.com/linkedin](https://learn.microsoft.com/en-us/linkedin/) |
| Facebook | [developers.facebook.com](https://developers.facebook.com/docs/pages-api) |
| Threads | [threads.meta.com](https://threads.meta.com) |
| Bluesky | [atproto.com](https://atproto.com) (app passwords work out of the box) |
| Mastodon | any instance's `/settings/applications` |
| YouTube | [developers.google.com/youtube](https://developers.google.com/youtube/v3) |
| Pinterest | [developers.pinterest.com](https://developers.pinterest.com) |
| Reddit | [reddit.com/dev/api](https://www.reddit.com/dev/api/) |

Bluesky (atproto) and Mastodon are the friendliest first targets — both authenticate with app passwords and post with a single HTTP call.

## AI keys

Keys are added in-app (**Settings → AI providers** or the panel in the AI Assistant), stored server-side in the database, masked everywhere in the UI, and never returned in full to the browser. The chat endpoint streams SSE end-to-end.

The OpenRouter auto-pick logic (`src/lib/ai.ts`) fetches the model catalog, filters models where prompt and completion pricing are both `0`, prefers a curated list (DeepSeek V3, Llama 3.3 70B, Gemini Flash, Qwen 2.5 72B …), falls back to the highest-context free model, and caches the choice for 10 minutes. The resolved model id is returned in the `X-OS-Model` response header and shown under each conversation.

## Stack & structure

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite · Recharts · Zustand · next-themes

```
src/
├── app/
│   ├── api/
│   │   ├── accounts/        # list / connect / disconnect / auto-post toggles
│   │   ├── posts/           # CRUD + publish + due-post worker
│   │   ├── automations/     # cross-posting rules
│   │   ├── analytics/       # aggregated metrics
│   │   ├── ai/chat/         # streaming SSE proxy to providers
│   │   ├── ai/models/       # OpenRouter free-model catalog
│   │   ├── settings/        # API key storage (masked)
│   │   ├── reset/           # wipe workspace data
│   │   └── chat/history/    # persisted conversations
│   └── page.tsx             # single-page app shell
├── components/opensocial/   # one file per view + shell
└── lib/
    ├── ai.ts                # provider routing + free-model picker
    ├── publisher.ts         # publish engine + automation firing
    ├── platforms.ts         # platform metadata & limits
    └── store.ts             # client state
prisma/schema.prisma         # 7 models
docs/screenshots/            # what you saw above
```

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Dev server on port 3000 |
| `bun run build` / `bun run start` | Production build & serve |
| `bun run db:push` | Apply schema to the database |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run lint` | ESLint |
| `bun run db:reset` | Wipe accounts, posts, automations, chat and keys |

## Roadmap

- [ ] Real OAuth connectors (Bluesky & Mastodon first)
- [ ] Media library with native uploads
- [ ] Queued calendar drag-and-drop
- [ ] Comment inbox across platforms
- [ ] Multi-user workspaces

## FAQ

**Is the posting real?** Posting runs in demo mode until you wire a platform's OAuth into the publisher — see [Linking accounts](#linking-accounts). Connected accounts hold your handle and the follower count you enter; engagement metrics on published posts are simulated until then. Everything else (scheduling, automations, AI) is fully functional, and all analytics are computed only from the data you create.

**Where are my API keys stored?** In your local SQLite database, server-side only. The browser only ever receives a masked preview.

**Which AI provider should I pick?** OpenRouter — the auto free-model routing costs nothing to try.

---

Built with Next.js 16. Licensed under [MIT](LICENSE).
