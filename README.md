# LevelUp — Gamified Fitness Training & Quests

LevelUp turns fitness goals into a Hunter-style progression game. Set a training goal, get an AI-built quest roadmap, complete daily/weekly/monthly missions for XP, climb ranks from **E → S**, unlock achievements, and compete on a live leaderboard.

The UI started from a [Figma design](https://www.figma.com/design/XdDOD1f3gol3DLV4nHgVT3/Gamified-Productivity-Web-App) and has since grown into a full-stack product with billing, referrals, analytics, and real-time features.

---

## Features

### Training & quests

- **Goals** — Create strength, conditioning, or race-prep goals; Gemini generates a phased quest roadmap grounded in an internal fitness library.
- **Quest types** — Daily, weekly, and monthly missions with difficulty tiers, built-in timers, and exercise checklists.
- **Program modules** — Starter+ users see a rotating program sidebar tied to their active goal.
- **Quest penalties & bonuses** — Missed-day XP penalties, timeframe completion bonuses, comeback multipliers after time away, and an easy-mode ramp on return.

### Progression & social

- **Hunter ranks** — Levels, XP, and ranks **E → D → C → B → A → S** with stat growth (strength, intelligence, agility, vitality).
- **Streaks** — Activity streak tracking, streak-freeze bank, calendar view, and streak milestone achievements.
- **Achievements** — Unlockable badges (common → mythic) with share menus for social posts.
- **Leaderboard** — Live rankings via WebSocket; Elite unlocks the full board and flair. Free/Starter/Pro see a preview of top players.
- **Referrals** — Unique invite codes with XP rewards at signup, first goal, and first quest milestones.

### Insights & engagement

- **Dashboard** — Today's quests, rank progress, streak calendar, recent activity feed, and notifications.
- **Analytics** *(Pro+)* — Charts and insights on quest completion, focus time, and trends.
- **Weekly recap** *(Pro+)* — AI-generated weekly summary modal; optional weekly summary email preference.
- **Tutorial** — Guided onboarding overlay with a persistent help button.
- **Sound & celebrations** — UI sound effects (toggleable) and confetti on level-ups and achievements.

### Account & billing

- **Auth** — Email/password sign-up and sign-in; optional Google OAuth.
- **Subscriptions** — Stripe Checkout for **Starter**, **Pro**, and **Elite** (monthly or annual with 14-day trial on annual plans). Customer Portal for manage/cancel/resume.
- **Tiers** — Feature gating across nav items, quest caps, analytics, leaderboard depth, and AI quality.
- **Legal & privacy** — Privacy, Terms, Cookie, and Refund policy pages; cookie consent with PostHog integration.

---

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, Vite 6, React Router 7, Tailwind CSS 4, Radix UI, Motion, Recharts |
| Backend | Node.js, Express, Mongoose (MongoDB) |
| Real-time | WebSocket (`ws`) for leaderboard updates |
| AI | Google Gemini (`@google/generative-ai`) for goal/quest generation and weekly reports |
| Payments | Stripe (subscriptions, webhooks, Customer Portal) |
| Analytics | PostHog (`posthog-js`) with server-fallback config via `/api/public-config` |

---

## Project structure

```
├── src/                    # React SPA (pages, components, hooks, utils)
│   └── app/
│       ├── pages/          # Dashboard, Quests, Goals, Analytics, etc.
│       ├── components/     # Layout, UI primitives, modals
│       ├── tutorial/       # Onboarding overlay
│       ├── audio/          # Sound engine & preferences
│       └── analytics/      # PostHog provider & event helpers
├── server/
│   ├── index.js            # Express entry + WebSocket attach
│   ├── routes/             # REST API routers
│   ├── models/             # Mongoose schemas
│   ├── services/           # Gemini, Stripe, achievements, leaderboard, referrals
│   ├── jobs/               # Cron: daily quest reset, XP penalties
│   └── scripts/            # Stripe bootstrap, fitness ingest, achievement suggestions
├── env.example             # Full server environment template
├── .env.example            # Additional client/public vars (PostHog, app origin)
├── vite.config.ts          # Dev proxy: /api and /ws → backend
└── vercel.json             # SPA rewrites for frontend deploy
```

---

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **MongoDB** running locally or a hosted URI (e.g. Atlas)
- **Gemini API key** for AI goal/quest generation
- **Stripe account** (optional for local dev without billing; required for subscriptions)
- **Google OAuth credentials** (optional; email/password works without them)

---

## Quick start

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy the templates and fill in values:

   ```bash
   cp env.example .env
   cp .env.example .env   # merge PostHog / public-origin vars into .env as needed
   ```

   Minimum for local development:

   - `MONGODB_URI`
   - `JWT_SECRET`
   - `GEMINI_API_KEY`

3. **Start MongoDB** (if running locally)

   ```bash
   mongod
   ```

4. **Run the app**

   ```bash
   npm run dev
   ```

   This starts **Vite** on `http://localhost:5173` and the **API** on `http://localhost:5000` (or the next free port). Vite proxies `/api` and `/ws` to the backend.

5. Open `http://localhost:5173`, create an account, and add your first training goal.

---

## Environment variables

See [`env.example`](env.example) for the complete server configuration and [`.env.example`](.env.example) for client/public settings.

### Core

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs auth tokens |
| `GEMINI_API_KEY` | AI quest/goal generation |
| `FRONTEND_URL` | Stripe redirect URLs and legal links on Checkout |
| `PORT` | API port (default `5000`) |

### Auth (optional)

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GOOGLE_CALLBACK_URL` | OAuth callback (default: `{origin}/api/auth/google/callback`) |
| `OAUTH_SUCCESS_REDIRECT` | Frontend callback after OAuth (default: `http://localhost:5173/auth/callback`) |

### Stripe

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | API key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_PRICE_STARTER` / `_PRO` / `_ELITE` | Monthly Price IDs |
| `STRIPE_PRICE_*_ANNUAL` | Annual Price IDs (33% off vs 12× monthly) |

All `STRIPE_SECRET_KEY` and `STRIPE_PRICE_*` values must be from the **same Stripe account and mode** (test or live).

### Frontend / analytics

| Variable | Purpose |
| --- | --- |
| `VITE_DEV_API_ORIGIN` | Backend origin for Vite proxy in dev (default `http://127.0.0.1:5000`) |
| `VITE_PUBLIC_APP_ORIGIN` / `APP_PUBLIC_ORIGIN` | Canonical public URL for share links |
| `VITE_POSTHOG_KEY` / `POSTHOG_KEY` | PostHog project API key |
| `VITE_POSTHOG_HOST` / `POSTHOG_HOST` | PostHog ingest host |

---

## Stripe setup

1. Set `STRIPE_SECRET_KEY` in `.env`.
2. Bootstrap products and prices:

   ```bash
   npm run stripe:bootstrap
   ```

   Paste the printed `STRIPE_PRICE_*` lines into `.env`.

3. Verify configuration:

   ```bash
   npm run stripe:verify
   ```

4. For local webhooks:

   ```bash
   stripe listen --forward-to localhost:5000/api/billing/webhook
   ```

   Use the CLI `whsec_...` as `STRIPE_WEBHOOK_SECRET` while testing.

   Webhook endpoint: `POST /api/billing/webhook` — subscribe to at least `checkout.session.completed`, `customer.subscription.*`, and `invoice.paid` / `invoice.payment_failed`.

---

## NPM scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite + Express API (concurrently) |
| `npm run build` | Production frontend build |
| `npm run stripe:bootstrap` | Create Stripe products/prices and print env vars |
| `npm run stripe:verify` | Validate Stripe key ↔ Price ID alignment |
| `npm run ingest:fitness` | Ingest fitness library data |
| `npm run suggest:achievements` | Suggest training achievement definitions |

---

## Subscription tiers

Each user has a **tier** on their record: `free`, `starter`, `pro`, or `elite`. Tiers gate in-app features and sync from Stripe webhooks when subscribed.

| Tier | Highlights |
| --- | --- |
| **Free** | Core quests (monthly cap), basic analytics, community support, leaderboard preview |
| **Starter** | Second active goal, AI quest realignment, program sidebar, quest reminder tuning, founding-member badge |
| **Pro** | Analytics page, weekly AI recap modal, weekly summary emails, higher daily quest caps |
| **Elite** | Full leaderboard, priority AI quest briefing, Elite flair, early access to new modes |

Live pricing amounts are fetched from Stripe via `GET /api/billing/plans`. Annual plans include a **14-day free trial** at checkout (card required).

Tier gates in the UI are defined in `src/app/utils/tierFeatures.ts` and should stay aligned with `server/constants/billingPlans.js`.

---

## API overview

| Prefix | Description |
| --- | --- |
| `GET /api/health` | Health check |
| `/api/auth` | Sign-up, login, Google OAuth, account deletion |
| `/api/goals` | CRUD goals, AI quest generation, program modules |
| `/api/quests` | List, complete, revert, exercise checklists |
| `/api/dashboard` | Aggregated home stats |
| `/api/achievements` | Achievement catalog and unlocks |
| `/api/analytics` | Analytics data *(Pro+)* |
| `/api/streak` | Streak calendar |
| `/api/leaderboard` | Rankings |
| `/api/weekly-report` | Weekly AI recap |
| `/api/billing` | Plans, status, Checkout, Portal, cancel/resume |
| `POST /api/billing/webhook` | Stripe webhooks (raw body) |
| `/api/referrals` | Referral code and claim |
| `/api/profile` | Profile read/update |
| `/api/settings` | Preferences, reset progress |
| `/api/history` | Recent activity feed |
| `/api/public-config` | Public client config (PostHog key, app origin) |
| `WS /ws` | Leaderboard live updates |

---

## Deployment

Typical production layout:

- **Frontend** — Vercel (or any static host). `vercel.json` rewrites all routes to `index.html`.
- **Backend** — Render (or similar). Set env vars in the host dashboard; on Render the server skips loading a bundled `.env` in production so dashboard keys cannot conflict with file-based Price IDs.
- **Database** — MongoDB Atlas or managed MongoDB.
- **Stripe** — Point webhooks to `https://<api-host>/api/billing/webhook`.

Set `FRONTEND_URL` and `APP_PUBLIC_ORIGIN` to your production domain so Checkout, Portal, OAuth, and share links resolve correctly.

---

## Design credit

Original UI concept: [Gamified Productivity Web App (Figma)](https://www.figma.com/design/XdDOD1f3gol3DLV4nHgVT3/Gamified-Productivity-Web-App).
