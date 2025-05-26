Komensa v3 — Cursor-Compatible Instructions
🛠️ Summary for Cursor
This codebase uses Next.js 15 + Prisma + Redis + OpenAI Assistants to build an extensible AI-mediated chat system. Below are cursor-optimized instructions to build from scratch:

🧱 Foundational Stack
Next.js 15.3.2 (Latest stable, released May 2025) with App Router
Prisma + Neon (Postgres)
@prisma/adapter-neon — use this to stay Edge-compatible
Redis (Upstash or ioredis) — raw SDK usage only
OpenAI Assistants API — use threads, not chat.completions
Stripe — for monetizing subscriptions and premium extensions

🗂️ Folder Structure (Recommended)
This structure is designed for collaborative feature-based development with Cursor compatibility. Keep feature logic isolated in /features/* folders. Use .cursorignore to protect stable logic (e.g. lib/redis.ts, prisma/schema.prisma) as components harden.
Refer to the full file tree below for implementation:

komensa/
├── .env.local
├── .env.example
├── .cursorignore
├── middleware.ts
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md

├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── loading.tsx
│   ├── 
│   ├── auth/
│   │   └── [...nextauth]/route.ts
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── setup-modal.tsx
│   ├── chat/
│   │   ├── page.tsx
│   │   ├── [chatId]/page.tsx
│   │   └── settings/page.tsx
│   ├── admin/debug/page.tsx
│   ├── demo/page.tsx
│   └── api/
│       ├── messages/route.ts
│       ├── turn/route.ts
│       ├── upload/route.ts
│       ├── system/route.ts
│       ├── stripe/route.ts
│       └── webhooks/stripe/route.ts

├── features/
│   ├── shared/
│   │   ├── types/
│   │   ├── utils/
│   │   └── constants.ts
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   ├── chat/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── types.ts
│   ├── ai/
│   │   ├── services/
│   │   ├── utils/
│   │   └── types.ts
│   ├── typing/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── redis-patterns.ts
│   ├── extensions/
│   │   ├── registry/
│   │   ├── components/
│   │   ├── scripts/
│   │   └── types.ts
│   ├── setup/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   ├── calendar/
│   │   ├── services/
│   │   ├── components/
│   │   └── types.ts
│   ├── analytics/
│   │   ├── services/
│   │   ├── components/
│   │   └── types.ts
│   └── uploads/
│       ├── services/
│       ├── components/
│       └── types.ts

├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── index.ts
│   ├── chat/
│   │   ├── ChatBubble.tsx
│   │   ├── TypingIndicator.tsx
│   │   ├── TurnStatus.tsx
│   │   └── MessageActions.tsx
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx

├── lib/
│   ├── prisma.ts
│   ├── redis.ts
│   ├── openai.ts
│   ├── stripe.ts
│   ├── auth.ts
│   ├── pino.ts
│   └── s3.ts

├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/

├── hooks/
├── utils/
├── extensions/
│   ├── registry.ts
│   ├── types.ts
│   └── examples/
├── tests/
├── scripts/
├── docs/
└── public/
This structure is designed for collaborative feature-based development with Cursor compatibility. Keep feature logic isolated in /features/* folders. Use .cursorignore to protect stable logic (e.g. lib/redis.ts, prisma/schema.prisma) as components harden.

/app
├── layout.tsx
├── page.tsx
├── dashboard/
│   └── setup-modal.tsx      ← optional verification toggle UI
├── chat/
│   ├── page.tsx
│   └── settings.tsx         ← mediator style, FNV state, extensions
├── auth/
│   └── [...nextauth]/route.ts
├── api/
│   ├── messages/
│   ├── turn/
│   ├── stripe/
│   │   └── route.ts
│   ├── upload/
│   └── system/
└── demo/

/features
├── chat/                    ← core AI + state logic
├── ai/                      ← generateAIReply, retries, prompts
├── typing/                  ← pub/sub helpers
├── extensions/              ← store + registry logic
├── setup/                   ← onboarding logic + verification
├── calendar/                ← GCal integration
├── analytics/               ← chat metrics rollups
└── shared/                  ← types, utils, DTOs

/components
├── ChatBubble.tsx
├── TurnStatus.tsx
└── TypingIndicator.tsx

/lib
├── prisma.ts
├── redis.ts
├── openai.ts
├── stripe.ts
├── pino.ts
└── auth.ts

/prisma
├── schema.prisma
└── seed.ts

/public
/hooks
/utils
/tests
.cursorignore
/app               → pages & routes
/components        → chat UI
/lib               → db, redis, openai clients
/prisma            → schema.prisma
/server            → actions, api, message pipelines
/hooks             → useChat, useTyping, etc.

📦 Environment Setup
Create .env.local from this sample:
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

🔐 Auth Flow
Use Next-Auth v5 at /auth/[...nextauth]/route.ts
Google provider enabled by default
Add middleware.ts to enforce session for /chat, /dashboard

🧩 Schema Design Highlights
todos persist per chat and help revisit commitments, enabling follow-through and lightweight accountability.
user_context_snapshots and context_threads maintain cross-chat, cross-platform emotional and thematic continuity between users.
Use events for all messages + turns
Use participant_state for user-level feelings/needs
Use chat_turn_state for active turn tracking
Add user_context_snapshots and context_threads to track user-wide issues across chats
All Slack/email imports go into events with type = 'imported'

🧠 AI Interaction Model
Use openai.beta.threads + runs
Always include formatStateForPrompt() result
Parse STATE_UPDATE_JSON: back from AI
On timeout or failure, call resetAssistantStateAndTurn()
Wrap AI calls in runWithRetries() with exponential backoff (max 3 tries)
Handle Assistant 429/500 errors with retries in runWithRetries()

📡 File & Media Uploads
Use presigned POST to S3 via /api/upload
Store storage_key, mime, size, transcript in attachments table
Handle file processing in background workers to avoid blocking the main thread

💸 Stripe Integration
🎟️ Coupon Code Support
Use Stripe coupons and promotion codes via Stripe dashboard or Checkout sessions.
On checkout.session.completed, check for a promo and log it to redeemed_coupons (optional local table).
Suggested SQL:

CREATE TABLE redeemed_coupons (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id),
code TEXT,
stripe_coupon_id TEXT,
redeemed_at TIMESTAMPTZ DEFAULT now()
);

Add /api/webhooks/stripe/route.ts to:
- Verify Stripe signature
- Upsert subscriptions
- Insert into chat_extensions when invoice.paid
- Handle subscription lifecycle events

🧪 Testing / CI
pnpm run test runs Jest + Supertest against Neon branch
GitHub Actions: deploys schema via prisma migrate deploy, runs tests
npm run db:seed creates 2 fake users, 1 demo chat, and a pre-populated Assistant thread

🔍 Observability
Use pino + pino-http for structured logging
Log Redis + AI events
Stream logs via Upstash-compatible HTTP transport
Add pino transport for tailing logs in development

🧠 Cursor-Specific Tips
Use the following header format in any file you want GPT-4o to focus or avoid changes:

// GPT CONTEXT:
// This file handles [what this file does]
// Related modules: /features/[...]
// Do NOT modify: [optional protected modules]
Example:

// GPT CONTEXT:
// This file handles streaming OpenAI Assistant replies and pushing updates via Redis pub/sub.
// Related modules: /features/ai/generateAIReply.ts, /lib/openai.ts
// Do NOT modify /lib/redis.ts or /features/chat/events.ts in this file.
Use a .cursorignore file to exclude stable files and third-party logic from Cursor's attention.
Keep feature code in modular directories (/features/chat, /features/calendar, etc.) to support independent development and codegen.
Update .cursorignore as features stabilize (e.g. ignore lib/redis.ts or prisma/schema.prisma once locked).
Encourage collaborators to document any local changes or overrides near the module entry point.
Define all enums (e.g. origin, turn_taking) in Prisma schema with native enums or CHECK constraints
Use createPrismaClient() that supports Edge usage (e.g., adapter-neon)
Add full Prisma types to Message, Chat, Event, Todo, etc.

📦 External Extensions Integration
Initial in-app extensions:
turn-taking-strict: enforce structured back-and-forth turn logic.
nvc-style-mediator: uses a compassionate prompt from mediator_profiles.
think-good-thought-cues: offers guided suggestions mid-conversation.

These are included directly in the DB seeding (extensions, mediator_profiles) and surfaced in /chat?settings. Additional third-party extensions can still follow the external repo model.
Komensa supports integrating modular extensions via external repositories.

Host each extension in its own repo (e.g. komensa-extension-timeline) with:
manifest.json
optional frontend component
optional runtime logic (Node or WASM)
In the main app:
Add /extensions/ directory with:
registry.ts → loads and validates remote manifests (GitHub/NPM/etc)
load:extensions script → populates extensions and extension_versions tables
Dynamically load renderable extensions (iframe or embedded React component)
Use .cursorignore to ignore /extensions/**/dist or auto-generated bundles
DB Tables required: extensions, extension_versions, chat_extensions

Run npm run load:extensions to seed extensions & extension_versions from /extensions/**/manifest.json

⚙️ Build Order
Create schema.prisma, then run prisma migrate dev
Add Neon + Redis clients in lib/
Scaffold /api/messages, /api/turn using events model
Build generateAIReply() using OpenAI Assistant thread model
Add streaming token broadcasts using Redis pub/sub
Integrate push + presence detection
Add Prisma types + DTOs to frontend hook logic
Move heavy mediator streaming to /server/workers/mediator.ts (Vercel background function)

🔒 Rate Limiting & Abuse Prevention
Guard /api/messages with:
- 20 requests/minute globally
- 5 messages/5 seconds per user
Use Redis incr/ex for rate limiting
Implement exponential backoff for retries

📊 Schema Design Highlights
todos persist per chat and help revisit commitments, enabling follow-through and lightweight accountability.
user_context_snapshots and context_threads maintain cross-chat, cross-platform emotional and thematic continuity between users.
Use events for all messages + turns
Use participant_state for user-level feelings/needs
Use chat_turn_state for active turn tracking
Add user_context_snapshots and context_threads to track user-wide issues across chats
All Slack/email imports go into events with type = 'imported'

CREATE TABLE user_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE context_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  thread_id TEXT,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

✅ Ready for Production When...
Messages replayable from events
Assistant gracefully recovers from errors
Stripe unlocks extensions via chat_extensions
Redis and Neon turn state always in sync
Devs can clone, seed, and chat via local Assistant thread