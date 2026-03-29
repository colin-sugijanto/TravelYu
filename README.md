# TravelYu!

AI-assisted personal travel planning platform for Indonesian destinations.

Stack:
- Next.js 16 (App Router)
- Tailwind CSS
- Clerk (Auth)
- Supabase (Postgres + Storage + RLS)
- Vercel AI SDK + Google AI Studio
- MapTiler API (map rendering)
- n8n (Gmail + Evolution API for email + WhatsApp)

## Implemented Scope (MVP baseline)

- Route skeleton and pages for all PRD path groups:
  - Public: `/`, `/login`, `/trip/s/[public_id]`, `/memory/s/[public_id]`
  - User app: dashboard, trip creation flow, itinerary workspace, profile/referral
  - Admin app: queue, flagged, chat, vendors, users, whatsapp, analytics
- AI endpoints:
  - `POST /api/ai/intake`
  - `POST /api/ai/editor`
  - `POST /api/ai/compare-options`
  - `POST /api/ai/generate-trip`
- Supporting endpoints:
  - `GET /api/trip/[id]/export-pdf`
  - `POST /api/notifications/trip-event`
  - `POST /api/vendor/contact`
  - `GET /api/weather/[city]`
- Supabase migration with tables, enums, indexes, triggers, helper functions, and RLS:
  - `supabase/migrations/20260324_001_travelyu_schema.sql`
- n8n workflow created in instance:
  - `TravelYu Notifications (Gmail + Evolution)`
  - Workflow ID: `qWjHOlA3Sl6hoGuR`
  - Current status: active

## Environment Variables

Copy `.env.example` to `.env.local` and fill values.

Key variables:
- `GOOGLE_AI_STUDIO_API_KEY`
- `GOOGLE_AI_STUDIO_MODEL` (optional override, default: `gemini-3.1-flash-lite-preview`)
- `TRAVELYU_INTERNAL_API_TOKEN`
- `N8N_NOTIFICATION_WEBHOOK_URL`
- `N8N_NOTIFICATION_WEBHOOK_TOKEN`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_MAPTILER_API_KEY`
- `OPENWEATHERMAP_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Local Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Auth Notes

- User authentication now uses Clerk (`/login` renders Clerk SignIn).
- App data is still persisted in Supabase.
- On first Clerk login, app will auto-link/create a corresponding row in `public.users`.

## Supabase Migration

Migration already applied to project `hyadkodaianrwjvmltwl` via MCP:
- `20260324_001_travelyu_schema`

If you need to re-apply manually, run the same SQL from:
- `supabase/migrations/20260324_001_travelyu_schema.sql`

## Notes on n8n Evolution Node

The active WhatsApp workflow in this n8n instance uses `n8n-nodes-evolution-api-english.evolutionApi` with `resource=messages-api` and `operation=send-text`, and TravelYu workflow has been aligned to that mapping.

## Development Mode Notes

- Payment wall is removed from trip creation flow.
- After intake and comparison selection, itinerary can be generated directly.
- Email and WhatsApp delivery are sent through n8n webhook integration.
