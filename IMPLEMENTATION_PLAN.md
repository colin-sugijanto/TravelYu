# TravelYu Implementation Checklist

Status legend: `[ ]` pending, `[~]` in progress, `[x]` done

## Phase A - Foundation
- [x] Bootstrap Next.js + Tailwind + TypeScript project structure
- [x] Build full app route map (public, user, admin, API)
- [x] Add reusable UI and layout primitives
- [x] Add Supabase SSR clients + middleware auth protection

## Phase B - Database + Supabase
- [x] Design SQL enums, tables, indexes, and triggers from PRD
- [x] Apply migration to Supabase via MCP (must create new tables)
- [x] Add RLS policies for traveler/admin access patterns
- [x] Add SQL helper functions for points and approvals

## Phase C - Product Features (Frontend + Backend)
- [x] Authentication pages and onboarding profile flow
- [x] AI Intake chat with 7-parameter progress tracking
- [x] Trip comparison flow with option selection
- [x] Payment wall with QRIS creation + expiry/retry UX
- [x] Itinerary viewer split layout (timeline + editor chat)
- [x] Budget tracker, packing list, weather banner, map section
- [x] Group trip, memory wall, reviews, loyalty widgets
- [x] Shareable itinerary and memory public views

## Phase D - AI + Integrations
- [x] OpenRouter integration configured to `stepfun/step-3.5-flash:free`
- [x] AI API routes: intake, editor, compare, generate
- [x] Tool-style editor actions with CS flagging rules
- [x] Payment webhook signature validation and trip status updates
- [x] PDF export endpoint
- [x] WA proxy endpoints and vendor contact endpoint

## Phase E - Admin + Automations
- [x] Admin dashboard sections (queue, flagged, live chat, vendors, users, analytics, whatsapp)
- [x] Build n8n workflow JSON for Gmail + Evolution API notifications
- [x] Register workflow in n8n instance (if node availability permits)

## Phase G - Coherence Hardening
- [x] Remove duplicate Next.js middleware/proxy implementation
- [x] Wire backend event hooks to n8n notifications (itinerary + payment)
- [x] Add secure internal notification endpoint for CS/reminder events
- [x] Re-check lint/typecheck/build after automation and API wiring

## Phase F - Delivery
- [x] Update docs (README, env example, setup guide)
- [x] Run lint/build sanity checks
- [x] Initialize git in this folder
- [x] Create private GitHub repo and add remote
- [x] Commit and push full implementation
