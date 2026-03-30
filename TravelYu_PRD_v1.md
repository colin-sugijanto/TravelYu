# TravelYu! - Product Requirements Document (Codebase-Aligned)

**AI-assisted personal travel planning platform for Indonesian destinations**  
Version 1.2 | March 2026 | Updated to match current repository + implementation plan progress

**Current stack:** Next.js 16 (App Router) - Tailwind CSS - Clerk - Supabase - Vercel AI SDK - OpenRouter - n8n - OpenStreetMap + Leaflet - OpenWeatherMap - Upstash Redis - Tavily

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Users and Roles](#2-users-and-roles)
3. [Core User Journey (As Built)](#3-core-user-journey-as-built)
4. [Feature Specifications (Implemented MVP)](#4-feature-specifications-implemented-mvp)
5. [AI Architecture](#5-ai-architecture)
6. [Data Architecture (Supabase)](#6-data-architecture-supabase)
7. [API Surface (Current)](#7-api-surface-current)
8. [App Route Structure (Current)](#8-app-route-structure-current)
9. [Integrations and Notification System](#9-integrations-and-notification-system)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Known Gaps and Next Iteration Priorities](#11-known-gaps-and-next-iteration-priorities)
12. [Milestones and Delivery Focus](#12-milestones-and-delivery-focus)

---

## 1. Product Overview

### 1.1 Vision

TravelYu is a personal AI travel concierge for domestic Indonesian trips. The product combines:

- conversational intake in Bahasa Indonesia,
- AI-generated itinerary options and full trip plans,
- an editable itinerary workspace,
- human admin/CS oversight for high-stakes changes,
- post-trip memory/review/loyalty loop.

### 1.2 Problem Statement

The product addresses common planning pain points:

- too many destination/activity choices with unclear tradeoffs,
- high manual research effort,
- weak personalization from generic travel tools,
- poor continuity from planning through post-trip reflection.

### 1.3 Product Scope (Current Build)

This repository currently delivers an MVP planning product (not a booking engine), including:

- public marketing pages,
- Clerk authentication + Supabase app user bridge,
- first-time onboarding modal and profile capture,
- trip intake with incremental parameter persistence,
- AI comparison generation and option selection,
- background itinerary generation with validation + fallback,
- itinerary workspace with editor tools, map, weather, budget, and day regeneration,
- trip lifecycle transitions (`draft`/`approved`/`active`/`completed`),
- admin queue/chat/oversight tooling,
- post-trip reviews, memory wall, and points automation,
- notification webhook integration.

### 1.4 Explicitly Out of Scope (Current)

- live booking/inventory integration (airline/hotel OTA APIs),
- production payment checkout (planning fee is bypassed in current flow),
- full referral attribution lifecycle,
- full collaborative group invite/comment UX,
- multi-city routing and dynamic transportation optimization.

### 1.5 Product Success Indicators

For the current phase, success means users/admin can complete end-to-end flow with no manual DB intervention:

- user finishes intake -> comparison -> generation -> workspace,
- generated itinerary persists valid items in database,
- admin can approve and complete trips in console,
- user can activate and complete own trip from workspace,
- post-trip reviews/photos/points execute correctly,
- reminder/notification paths are wired for production deployment.

---

## 2. Users and Roles

| Role | Description | Current Permissions |
|---|---|---|
| `user` | Traveler creating and managing trips | Create trips, complete intake, select options, generate itinerary, edit itinerary via AI tools, activate/complete trips, upload photos, submit reviews, redeem points |
| `admin` | Customer Success / trip operator | Access admin pages, approve draft trips, complete trips, process flagged queue, reply to CS chat |
| `super_admin` | Elevated admin role | Same practical access as admin in current implementation |

Identity and sessions are handled by **Clerk**. App profile + role + loyalty data are persisted in **Supabase `users`**.

---

## 3. Core User Journey (As Built)

1. User lands on `/` and signs in via `/login`.
2. On first app access, onboarding modal collects WhatsApp + travel preferences and marks onboarding complete.
3. User starts a trip from `/trip/new` and selects **Standard** or **Surprise Me** mode.
4. Intake chat on `/trip/new/intake` gathers 7 planning parameters.
5. Intake data is incrementally saved to `trips.intake_data` and completion is detected by:
   - token signal (`[INTAKE_COMPLETE]`), and
   - server-side completion check (`/api/trip/[id]/intake-check`).
6. `/trip/new/compare` displays 3 AI options; user selects one.
7. User triggers generation; status moves to `generating`, generation runs in background.
8. AI generation persists itinerary, validates output, and sets status to:
   - `approved` in development,
   - `draft` in production path.
9. If trip is `draft`, admin approves from `/admin/trips`.
10. User works in `/trip/[id]` (timeline, map, weather, budget, AI editor, CS chat, regen day).
11. User activates trip (`approved` -> `active`) and later completes trip (`active`/`approved` -> `completed`), or admin completes as needed.
12. Post-trip flows unlock: vendor review, photo memory wall, points events, share links.

---

## 4. Feature Specifications (Implemented MVP)

### 4.1 Public Experience and Marketing

Implemented routes/pages:

- `/` landing page,
- `/destinations`,
- `/activities`,
- PWA manifest (`public/manifest.json`).

### 4.2 Authentication, Access Control, and Onboarding

Implemented:

- Clerk SignIn flow with redirect continuation,
- middleware + server-side route/API checks,
- admin-only guard in `(admin)` layout and admin APIs,
- auto-link/create app user row in Supabase on first authenticated session,
- onboarding modal (`OnboardingModal`) for:
  - full name,
  - WhatsApp number,
  - vibes and budget tier,
- profile update endpoint `PATCH /api/user/profile`,
- `users.onboarding_completed` support,
- welcome points awarded on first onboarding completion.

### 4.3 Trip Creation and Intake

Implemented:

- mode selection (`standard`, `surprise`) on `/trip/new`,
- draft trip row creation,
- intake chat endpoint `POST /api/ai/intake`,
- parameter progress panel in UI,
- partial persistence during chat via `PATCH /api/trip/[id]/intake-progress`,
- dual completion detection via token + `POST /api/trip/[id]/intake-check`.

### 4.4 Comparison and Itinerary Generation

Implemented:

- comparison generation via `POST /api/ai/compare-options`,
- persistence in `comparison_options`,
- option selection via `POST /api/trip/[id]/select-option`,
- generation trigger `POST /api/trip/[id]/generate` with immediate `generating` status,
- generation engine `POST /api/ai/generate-trip` with:
  - selected comparison context,
  - verified vendor context from DB,
  - Tavily search tool support,
  - itinerary validation layer,
  - fallback JSON parsing path,
  - trip start/end date extraction to `trip_start_date` and `trip_end_date` when parseable.

### 4.5 Itinerary Workspace (`/trip/[id]`)

Implemented:

- state-aware rendering for `intake`, `generating`, `draft`, `approved`, `active`, `completed`,
- realtime watcher via Supabase Realtime (`TripStatusWatcher`) for generation completion,
- generation progress UX with rotating messages + elapsed time,
- timeline by day with status badges,
- per-day regeneration (`POST /api/trip/[id]/regen-day`),
- verified vendor modal (`VendorModal`) on internal DB items,
- map overview with OpenStreetMap + Leaflet,
- budget tracker by category and total,
- weather banner backed by OpenWeatherMap (graceful fallback),
- AI editor chat (`POST /api/ai/editor`) with tool invocation/result rendering,
- CS live chat panel (`GET/POST /api/trip/[id]/chat`),
- owner lifecycle actions (`PATCH /api/trip/[id]/activate`, `POST /api/trip/[id]/complete`),
- PDF export endpoint (`GET /api/trip/[id]/export-pdf`),
- packing list page using AI generation + caching to `intake_data.packingList`.

### 4.6 Post-Trip, Reviews, Photos, and Loyalty

Implemented:

- review page `/trip/[id]/review` with vendor review submission,
- review gate enforced to completed trips,
- memory wall page `/trip/[id]/memory` with Supabase Storage,
- shared read-only routes:
  - `/trip/s/[public_id]`,
  - `/memory/s/[public_id]`,
- points events wired in APIs:
  - onboarding completion (+25, first time),
  - trip approval (+100, admin approval flow),
  - trip completion (+100),
  - first review per vendor/trip/user (+50),
  - photo upload (+10 per photo, capped to first 20 photos per user per trip),
- rewards redemption endpoint `POST /api/rewards/redeem` using RPC.

### 4.7 Admin Console and Operations

Implemented admin pages:

- `/admin`, `/admin/trips`, `/admin/flagged`, `/admin/chat`,
- `/admin/vendors`, `/admin/users`, `/admin/whatsapp`, `/admin/analytics`.

Implemented admin actions:

- approve draft trip: `POST /api/admin/trips/[id]/approve` (alias route exists at `/api/admin/trip/[id]/approve`),
- complete trip: `POST /api/admin/trips/[id]/complete`,
- resolve flagged queue item: `PATCH /api/trip/[id]/flagged/[queueId]`,
- reply in CS chat: `POST /api/admin/chat/[sessionId]/reply`.

---

## 5. AI Architecture

### 5.1 Model and Runtime

- Vercel AI SDK: `generateText`, `streamText`, `useChat`,
- OpenRouter base URL: `https://openrouter.ai/api/v1`,
- default model (current default config): `stepfun/step-3.5-flash:free`,
- Chat Completions compatible provider path used for multi-turn flows.

### 5.2 AI Endpoints

- `POST /api/ai/intake` - conversational intake,
- `POST /api/ai/compare-options` - generate + save 3 options,
- `POST /api/ai/generate-trip` - generate + persist full itinerary,
- `POST /api/ai/editor` - itinerary editing assistant with tools.

### 5.3 Editor Tool Surface

Implemented tool calls include:

- `update_itinerary_item`
- `add_itinerary_item`
- `delete_itinerary_item`
- `swap_vendor`
- `search_alternatives`
- `flag_for_cs_approval`
- `contact_vendor_via_whatsapp`
- `get_weather_info`
- `escalate_to_human_cs`
- `generate_packing_list`

### 5.4 Guardrails and Recovery

- AI rate limiting via Upstash,
- retry strategy on model calls,
- generation timeout handling + status recovery,
- itinerary validation before persistence,
- fallback JSON parse path when tool-save path fails.

---

## 6. Data Architecture (Supabase)

### 6.1 Core Tables in Use

- `users`
- `trips`
- `itinerary_items`
- `vendors`
- `comparison_options`
- `trip_preferences`
- `group_trip_members`
- `cs_approval_queue`
- `cs_chat_sessions`
- `vendor_reviews`
- `trip_photos`
- `user_points_log`
- `waha_message_log`

### 6.2 Key Fields and Schema Additions

- `users.onboarding_completed` (onboarding state),
- `trips.trip_start_date`, `trips.trip_end_date` (lifecycle + reminders),
- `trips.intake_data` stores runtime metadata (including cached packing list).

### 6.3 Functions and Automation

- `apply_points_event` RPC for loyalty transactions,
- `redeem_planning_points` RPC for redemption,
- `set_updated_at` trigger pattern,
- RLS hardening and Clerk compatibility migrations.

### 6.4 Realtime, Storage, and Seeds

- Realtime publication includes `trips` and `itinerary_items`,
- Storage bucket for photos: `trip-photos`,
- Indonesian vendor grounding dataset seeded via migration `20260401_012_vendor_seed.sql`.

---

## 7. API Surface (Current)

### 7.1 AI and Planning APIs

- `POST /api/ai/intake`
- `POST /api/ai/compare-options`
- `POST /api/ai/generate-trip`
- `POST /api/ai/editor`
- `POST /api/trip/[id]/select-option`
- `POST /api/trip/[id]/generate`
- `PATCH /api/trip/[id]/intake-progress`
- `POST /api/trip/[id]/intake-check`
- `POST /api/trip/[id]/regen-day`

### 7.2 Workspace and Lifecycle APIs

- `PATCH /api/trip/[id]/activate`
- `POST /api/trip/[id]/complete`
- `GET /api/trip/[id]/chat`
- `POST /api/trip/[id]/chat`
- `GET /api/trip/[id]/export-pdf`

### 7.3 Reviews, Photos, Profile, Rewards

- `GET /api/trip/[id]/reviews`
- `POST /api/trip/[id]/reviews`
- `GET /api/trip/[id]/photos`
- `POST /api/trip/[id]/photos`
- `DELETE /api/trip/[id]/photos`
- `PATCH /api/user/profile`
- `POST /api/rewards/redeem`

### 7.4 Admin and Ops APIs

- `POST /api/admin/trips/[id]/approve`
- `POST /api/admin/trips/[id]/complete`
- `PATCH /api/trip/[id]/flagged/[queueId]`
- `POST /api/admin/chat/[sessionId]/reply`
- `POST /api/vendor/contact`
- `POST /api/notifications/trip-event`

### 7.5 Utility APIs

- `GET /api/weather/[city]`
- `GET /api/vendor/[id]`

---

## 8. App Route Structure (Current)

### 8.1 Public Routes

- `/`
- `/destinations`
- `/activities`
- `/login`
- `/trip/s/[public_id]` (shared itinerary, read-only)
- `/memory/s/[public_id]` (shared memory wall, read-only)

### 8.2 Authenticated User Routes

- `/dashboard`
- `/trip/new`
- `/trip/new/intake`
- `/trip/new/compare`
- `/trip/[id]`
- `/trip/[id]/budget`
- `/trip/[id]/packing`
- `/trip/[id]/memory`
- `/trip/[id]/review`
- `/profile`
- `/referral`

### 8.3 Admin Routes

- `/admin`
- `/admin/trips`
- `/admin/flagged`
- `/admin/chat`
- `/admin/vendors`
- `/admin/users`
- `/admin/whatsapp`
- `/admin/analytics`

---

## 9. Integrations and Notification System

### 9.1 External Services in Use

| Service | Current Use |
|---|---|
| Clerk | Authentication and session management |
| Supabase | Postgres, Storage, Realtime |
| OpenRouter | LLM routing for intake/compare/generation/editor |
| Tavily | Supplemental web context for generation/editor tools |
| OpenWeatherMap | Forecast data for weather banner and AI weather tool |
| OpenStreetMap + Leaflet | Map overview rendering |
| n8n | Email + WhatsApp orchestration via webhook |
| Upstash Redis | AI endpoint rate limiting |

### 9.2 Notification Events Implemented in Code

- `itinerary_ready`
- `cs_approved`
- `trip_reminder_h1`
- `vendor_contact`
- `trip_completed`
- `post_trip_review`
- `points_earned`
- `cs_reply`

---

## 10. Non-Functional Requirements

### 10.1 Security

- authenticated checks on app routes + API handlers,
- strict admin role checks for admin pages/endpoints,
- trip ownership/group membership checks for trip resources,
- Supabase RLS and hardened migrations,
- token validation for internal notifications endpoint,

### 10.2 Reliability and Failure Handling

- background generation with explicit status transitions,
- timeout + fallback path in generation,
- graceful rollback to `intake` on generation failure,
- non-blocking notification and points dispatch patterns,
- non-critical weather and intake background calls fail gracefully.

### 10.3 Performance and UX

- cache tags + revalidation for trip/profile/admin metrics,
- Realtime updates for generation status,
- suspense skeleton patterns for heavy panels,
- responsive layouts for public/user/admin surfaces.

### 10.4 Environment Variables

Core required variables:

- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (optional override)
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `OPENWEATHERMAP_API_KEY`
- `N8N_NOTIFICATION_WEBHOOK_URL`, `N8N_NOTIFICATION_WEBHOOK_TOKEN`
- `TRAVELYU_INTERNAL_API_TOKEN`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

Feature-optional but recommended:

- `TAVILY_API_KEY`

---

## 11. Known Gaps and Next Iteration Priorities

This PRD reflects current implementation. Remaining priorities:

1. Replace payment bypass with production checkout + reconciliation.
2. Improve AI consistency/reliability for long or edge-case itineraries (model strategy + observability).
3. Upgrade map from static/fallback to richer interactive map UX.
4. Upgrade PDF export from basic format to branded multi-page output.
5. Expand admin analytics from KPI cards to trend/funnel visualizations.
6. Deliver full group collaboration UX (invites, roles, collaborative edits/comments).
7. Strengthen referral attribution backend and anti-abuse logic.
8. Continue vendor dataset enrichment/maintenance by destination and category.

Detailed sequencing remains in `TRAVELYU_IMPLEMENTATION_PLAN.md`.

---

## 12. Milestones and Delivery Focus

### 12.1 Delivered in Current Codebase

- app shell + public pages + role-aware protected experiences,
- onboarding modal + profile persistence + welcome points,
- intake persistence + dual completion detection,
- comparison + generation pipeline with validation and fallback,
- workspace lifecycle controls (activate/complete),
- editor tool result rendering + day regeneration,
- admin approve/complete/flag/chat operations,
- post-trip reviews/photos/points automation,
- lifecycle automation via in-app and admin actions,
- n8n notification event integration.

### 12.2 Next Delivery Focus

- production monetization flow,
- AI quality and observability upgrades,
- deeper UX polish (map, PDF, analytics),
- collaboration and referral system completeness.

---

*TravelYu PRD v1.2 - Internal Product and Engineering Document*  
*Aligned with repository state and implementation plan progress as of March 2026*
