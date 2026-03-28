# TravelYu! — Revised PRD + Full Technical Implementation Plan

**Version:** 2.0 | March 2026 | Based on codebase audit + gap analysis  
**Scope:** End-to-end customer journey completion, AI quality uplift, production readiness

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Revised Product Understanding](#2-revised-product-understanding)
3. [Current State Audit](#3-current-state-audit)
4. [Missing Features: Industry-Standard Audit](#4-missing-features-industry-standard-audit)
5. [Customer Journey Map: Gap Analysis](#5-customer-journey-map-gap-analysis)
6. [Implementation Plan: Phase by Phase](#6-implementation-plan-phase-by-phase)
7. [AI Quality Uplift Plan](#7-ai-quality-uplift-plan)
8. [Data Architecture Changes](#8-data-architecture-changes)
9. [File-by-File Implementation Guide](#9-file-by-file-implementation-guide)
10. [Notification Integration (n8n)](#10-notification-integration-n8n)
11. [Acceptance Criteria](#11-acceptance-criteria)

---

## 1. Executive Summary

TravelYu is a conversational AI travel planner for Indonesian destinations. The codebase has a solid foundation — auth, DB schema, AI endpoints, intake chat, admin dashboard — but the **end-to-end customer journey has critical gaps** that prevent a user from completing a real trip from intent to post-trip review without manual intervention or broken states.

**The 7 critical gaps:**
1. Intake → Comparison transition is fragile (token-based detection, no parameter persistence)
2. Itinerary generation produces ungrounded output (no real vendor data seeded, free model unreliable)
3. Trip status lifecycle is incomplete (no admin approval UI, no trip completion, no post-trip trigger)
4. Weather banner is hardcoded, not live
5. AI editor tool results are not rendered in the chat UI
6. Packing list is mock-only, never AI-generated
7. Points/loyalty events are never actually triggered

This document is the complete plan to fix all of these and build the full E2E journey.

---

## 2. Revised Product Understanding

### 2.1 Core Value Proposition (Refined)

TravelYu is a **personal AI travel concierge** for Indonesian domestic travel. The differentiation:
- Conversational intake (no forms) in Bahasa Indonesia
- AI generates a draft itinerary grounded in real Indonesian vendors and destinations
- Human CS oversight for high-stakes changes (locked bookings, vendor swaps)
- Post-trip memory + review loop that earns points

### 2.2 User Lifecycle

```
Register → Onboard (WA number, travel preferences)
  → New Trip (Standard | Surprise Me)
  → AI Intake Chat (7 parameters via conversation)
  → Trip Comparison (3 AI-generated options)
  → [DEV: skip payment] → AI Itinerary Generation
  → Itinerary Workspace (view/edit/download)
  → Trip Active (reminder H-1 via n8n)
  → Post-Trip (review, photos, earn points)
  → Loyalty Tier Upgrade
```

### 2.3 What This App Is NOT

- Not a booking engine (no real reservations, no live inventory)
- Not replacing travel agents for complex international trips
- Not a social platform (memory wall is private/shareable link only)
- No payment processing (removed from MVP scope)

---

## 3. Current State Audit

### 3.1 What Works ✅

| Feature | File(s) | Status |
|---|---|---|
| Clerk authentication | `src/middleware.ts`, `src/app/(public)/login` | ✅ Working |
| User auto-creation | `src/lib/auth.ts` | ✅ Working |
| Homepage marketing | `src/app/page.tsx` + components/marketing/ | ✅ Working |
| Dashboard | `src/app/(app)/dashboard/page.tsx` | ✅ Working |
| Intake chat UI | `src/components/intake/intake-chat.tsx` | ✅ Renders |
| Trip comparison UI | `src/components/intake/comparison-cards.tsx` | ✅ Renders |
| Itinerary timeline | `src/components/itinerary/timeline.tsx` | ✅ Renders |
| Budget tracker | `src/components/itinerary/budget-tracker.tsx` | ✅ Renders |
| Admin flag queue | `src/components/admin/flag-queue.tsx` | ✅ Renders |
| Admin CS chat | `src/components/admin/cs-chat-panel.tsx` | ✅ Renders |
| n8n workflow definition | `src/lib/n8n-workflow.ts` | ✅ Defined |
| Supabase schema | `supabase/migrations/` | ✅ Applied |
| PDF export (basic) | `src/app/api/trip/[id]/export-pdf/route.ts` | ✅ Works (basic) |
| Photo memory wall | `src/components/memory/memory-wall.tsx` | ✅ Works |
| Vendor review UI | `src/app/(app)/trip/[id]/review/page.tsx` | ✅ Renders |

### 3.2 What Is Broken or Incomplete ❌

| Feature | File(s) | Problem |
|---|---|---|
| Intake completion detection | `intake-chat.tsx` L43-60 | Token + regex fragile; breaks on model paraphrasing |
| Parameter persistence to DB | `intake-chat.tsx` | Intake params collected in memory, NOT saved to `trips.intake_data` during chat |
| AI generation model quality | `openrouter.ts` | `stepfun/step-3.5-flash:free` has low reliability for JSON tool calling |
| Itinerary grounding | `generate-trip/route.ts` | No real vendor data seeded; Tavily results are generic web pages |
| Weather banner (live) | `weather-banner.tsx` | Props are hardcoded, no real API call in workspace |
| AI editor tool results | `editor-chat.tsx` | Tool call results not rendered; user sees nothing when AI edits |
| Trip approval flow | admin pages | No admin button to approve `draft` → `approved` |
| Trip completion flow | entire app | No way to mark trip as `completed` (required for reviews) |
| Post-trip trigger | `data.ts` | `apply_points_event` RPC exists but is never called |
| Packing list AI generation | `packing/page.tsx` | Returns `mockPackingList` always; AI tool `generate_packing_list` never called from page |
| Onboarding after first login | missing | User gets dumped to dashboard with no WA/preference collection |
| Surprise Me destination logic | `intake-chat.tsx` | Mode is passed but AI prompt doesn't auto-select destination |
| `selected_comparison_option` validation | `generate-trip/route.ts` L98 | `selectedOption` validation allows 0 which is falsy, causes misroute |
| Realtime trip status update | `trip/[id]/page.tsx` | `GeneratingPoller` polls every 5s but doesn't update UI without full page reload |
| Points earning on events | multiple | No calls to points RPC on trip completion, review, photo upload |
| Group trip member invite UI | missing | Schema exists, no invite flow |

### 3.3 What Has Suboptimal UX 🟡

| Feature | Problem |
|---|---|
| Intake chat progress tracker | Pattern-matching is slow/inaccurate; detected fields don't match actual conversation state |
| Comparison options display | No loading state when `compare-options` API is running (takes 10-30s) |
| Trip detail status page | "Sedang Diproses" shows but no estimated time or progress bar |
| Map | Static image or iframe embed; no interactive pins |
| PDF export | No TravelYu branding, no full itinerary structure |
| Vendor review | Only shows for `completed` trips; no way to set trip to completed |

---

## 4. Missing Features: Industry-Standard Audit

Based on industry-standard AI travel apps (Layla, Roam Around, GuideGeek, TripAdvisor AI), these features are expected but absent:

### 4.1 Core Gaps vs. Industry Standard

| Feature | Industry Standard | TravelYu Status |
|---|---|---|
| **Destination autocomplete/suggestion** | Users see popular destinations instantly | ❌ Missing |
| **Estimated trip cost breakdown before generation** | Cost shown in comparison cards | 🟡 Shown but unverified |
| **Day-by-day visual itinerary (calendar view)** | Card-per-day with timeline | 🟡 Exists, needs polish |
| **"Regen this day" button** | User can regenerate a single day | ❌ Missing |
| **Vendor detail cards** (photos, rating, hours) | Click item → see vendor info | ❌ Missing |
| **Offline PDF/share** | Exportable, branded PDF | 🟡 Exists, basic |
| **H-1 reminder** | Push/WA notification day before | 🟡 n8n event defined, not triggered |
| **Post-trip prompt** | App prompts review after trip date | ❌ Missing |
| **"Similar trip" suggestions** | After completing trip, suggest next | ❌ Missing |
| **Trip template library** | Pre-built itinerary starters | ❌ Missing (nice-to-have) |
| **Multi-city routing** | Jakarta → Yogyakarta → Bali | ❌ Missing |
| **Real-time flight/accommodation prices** | Traveloka/Tiket API | ❌ Out of scope (future) |
| **Collaborative editing** | Group members can comment | ❌ Missing (schema exists) |
| **"Ask AI about this place"** | In-context place queries | ❌ Missing |

### 4.2 Critical-Path Features (Must for E2E)

These are blocking the customer from completing the journey:

1. **Admin: Approve draft itinerary** → enables user to enter workspace
2. **Admin or auto: Mark trip as completed** → enables post-trip flow
3. **Points earning on trip events** → loyalty loop closes
4. **Onboarding flow** → captures WA number for n8n notifications
5. **Live weather in workspace** → real API call, not hardcoded
6. **AI editor tool result display** → user sees confirmation of changes
7. **Packing list from AI** → must call the tool, not return mock
8. **Intake parameter save to DB during chat** → enables resuming incomplete intakes

---

## 5. Customer Journey Map: Gap Analysis

### Full E2E Journey with Status

```
STAGE 1: DISCOVERY & AUTH
├── Visit homepage                     ✅ Works
├── Click "Mulai Rencanakan"           ✅ Works  
├── Clerk login/signup                 ✅ Works
└── First-time onboarding modal        ❌ MISSING — blocks WA notification later

STAGE 2: TRIP CREATION
├── /trip/new — choose Standard/Surprise ✅ Works
├── Draft trip created in DB           ✅ Works
└── Redirected to /trip/new/intake     ✅ Works

STAGE 3: AI INTAKE CHAT
├── AI greets, asks 7 params           ✅ Works (model dependent)
├── Progress tracker updates           🟡 Fragile regex detection
├── Params saved to trips.intake_data  ❌ MISSING — only saved at end
├── INTAKE_COMPLETE token emitted      🟡 Model may paraphrase
└── Auto-redirect to compare           🟡 Works if token detected

STAGE 4: TRIP COMPARISON
├── compare-options API called         ✅ Works
├── 3 option cards rendered            ✅ Works  
├── User selects option                ✅ Works
├── "Generate Itinerary" clicked       ✅ Works
└── Trip status → "generating"         ✅ Works

STAGE 5: AI ITINERARY GENERATION
├── Background AI generation           🟡 Works (model unreliable on free tier)
├── Itinerary saved to DB              🟡 Works when model calls tool
├── Trip status → "approved" (dev)     ✅ Works in dev
├── n8n itinerary_ready notification  ❌ MISSING — scheduleNotification called but n8n not configured
└── User sees completed itinerary      ✅ Works if generation succeeded

STAGE 6: ITINERARY WORKSPACE
├── Timeline view                      ✅ Works
├── AI editor chat                     🟡 Works but tool results not shown
├── Budget tracker                     ✅ Works
├── Weather banner (live)              ❌ HARDCODED — not real API
├── Map view                           🟡 Static image only
├── Packing list (AI)                  ❌ MOCK DATA — never calls AI
├── Download PDF                       🟡 Basic, no branding
├── Shareable link                     ✅ Works (read-only view)
└── Flag item for CS                   ✅ Works

STAGE 7: CS/ADMIN OVERSIGHT
├── Admin sees flagged items           ✅ Works
├── Admin approves/rejects             ✅ Works
├── Admin sees trip queue              ✅ Works  
├── Admin CAN approve draft→approved  ❌ MISSING — no button in admin
├── CS live chat                       ✅ Works
└── WhatsApp vendor contact            🟡 Queued, n8n dependency

STAGE 8: TRIP EXECUTION
├── H-1 reminder notification         ❌ MISSING — no trigger, no scheduler
└── (User takes trip)                  N/A

STAGE 9: POST-TRIP
├── Trip marked as "completed"         ❌ MISSING — no mechanism
├── Points earned (100 pts/trip)       ❌ MISSING — RPC exists, never called
├── Post-trip review prompt            ❌ MISSING
├── Vendor review submission           🟡 Works but requires completed status
├── Photo upload to memory wall        ✅ Works
├── Points earned (50 pts/review)      ❌ MISSING
└── Points earned (10 pts/photo)       ❌ MISSING

STAGE 10: LOYALTY
├── Points balance visible             ✅ Works
├── Tier calculation                   ✅ Works (display only)
├── Redeem planning discount           🟡 API exists, needs testing
└── Referral tracking                  ❌ MISSING — no tracking mechanism
```

---

## 6. Implementation Plan: Phase by Phase

### Phase 1: Critical Path Fixes (Days 1–5)

These are the minimum changes to make the E2E journey completable end-to-end.

---

#### P1.1 — First-Time Onboarding Modal

**Problem:** After first login, user goes directly to dashboard with no WA number collected. n8n notifications will fail.

**Implementation:**

Create `src/components/onboarding/onboarding-modal.tsx`:

```tsx
"use client";
// Modal shown when profile.whatsapp_number is null
// Collects: full_name, whatsapp_number, travel_preferences (vibe multiselect)
// On submit: PATCH /api/user/profile
// Dismissible after first view (stores dismissed flag in profile or localStorage)
```

Add to `src/app/(app)/layout.tsx`:
```tsx
// After getCurrentAppUser(), check if profile.whatsapp_number is null
// If null AND no "onboarding_dismissed" cookie → show modal
// The modal is a full-screen overlay with a friendly form
```

New API route `src/app/api/user/profile/route.ts`:
```ts
// PATCH — update full_name, whatsapp_number, travel_preferences
// Also sets an "onboarding_completed" field (add column to users table)
// Uses supabaseAdmin to bypass RLS
// Revalidates user profile cache tag
```

Migration `supabase/migrations/20260401_010_onboarding_flag.sql`:
```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
```

---

#### P1.2 — Intake Parameter Persistence During Chat

**Problem:** Intake parameters are detected in the browser but never written to `trips.intake_data` until compare-options fires. If user drops off mid-intake, session is lost.

**Implementation:**

Add a new API endpoint `src/app/api/trip/[id]/intake-progress/route.ts`:
```ts
// PATCH — accepts partial intake_data JSON
// Merges with existing intake_data (don't overwrite fields already set)
// Called from the client every time a user message is sent
// Debounced to avoid excessive writes (300ms debounce)
```

Modify `src/components/intake/intake-chat.tsx`:
```tsx
// After each user message send:
// 1. Extract detected parameters from flattenedText
// 2. Build partial intakeData object
// 3. Call PATCH /api/trip/[id]/intake-progress with detected params
// Use useEffect watching messages array
// Debounce 500ms to avoid hammering on fast typing
```

The parameter extraction function:
```ts
function extractIntakeParams(text: string): Partial<IntakeData> {
  const params: Partial<IntakeData> = {};
  // WHO
  const whoMatch = text.match(/(?:kami|saya|aku|ada)\s+(\d+)\s+orang|(?:pasangan|keluarga|sendiri|solo)/i);
  if (whoMatch) params.who = whoMatch[0];
  // VIBE
  const vibes = ['healing', 'adventure', 'petualangan', 'kuliner', 'budaya', 'santai', 'romantic'];
  const detectedVibes = vibes.filter(v => text.toLowerCase().includes(v));
  if (detectedVibes.length) params.vibe = detectedVibes.join(', ');
  // WHERE — named Indonesian destinations
  const destinations = ['bali', 'lombok', 'yogyakarta', 'jogja', 'jakarta', 'bandung', 
    'nusa penida', 'komodo', 'raja ampat', 'labuan bajo', 'manado', 'flores', 'bromo'];
  const dest = destinations.find(d => text.toLowerCase().includes(d));
  if (dest) params.where = dest;
  // WHEN — date patterns
  const whenMatch = text.match(/(\d{1,2}\s*[-–]\s*\d{1,2}\s+\w+|\w+\s+\d{4}|\d+\s*hari\s*\d*\s*malam)/i);
  if (whenMatch) params.when = whenMatch[0];
  // BUDGET
  const budgetMatch = text.match(/(?:rp\.?\s*)?(\d+(?:\.\d+)*)\s*(?:juta|ribu|k|rb)/i);
  if (budgetMatch) params.budget = budgetMatch[0];
  // PACING
  if (/santai|pelan|slow/i.test(text)) params.pacing = 'slow';
  else if (/padat|packed|banyak/i.test(text)) params.pacing = 'packed';
  else if (/balanced|seimbang/i.test(text)) params.pacing = 'balanced';
  return params;
}
```

---

#### P1.3 — Admin: Approve Draft Itinerary

**Problem:** After generation, trip is `draft` in production. No UI for admin to approve it.

**Implementation:**

Add to `src/app/(admin)/admin/trips/page.tsx`:
```tsx
// For each trip with status === 'draft', show an "Approve" button
// Button calls PATCH /api/admin/trips/[id]/approve
// Optimistic update on click
```

New API `src/app/api/admin/trips/[id]/approve/route.ts`:
```ts
// PATCH — requires admin role
// Updates trips.status from 'draft' to 'approved'
// Triggers itinerary_ready notification via scheduleNotification
// Revalidates trip cache tags
// Awards 100 points to trip owner via apply_points_event RPC (service_role only)
```

Also add to admin trips page: filter dropdown (All | Intake | Generating | Draft | Approved | Active | Completed)

---

#### P1.4 — Trip Completion Mechanism

**Problem:** Reviews, post-trip points, and the full loyalty loop require `trip.status === 'completed'`. Nothing sets this.

**Implementation:**

**Option A (Manual — Admin marks complete):**
Add "Mark Completed" button in admin trip detail. Fastest to implement.

**Option B (Auto — based on trip end date):**
When `intake_data.when` contains an end date that has passed, auto-complete via a cron or on next page load.

**Implement both:**

New API `src/app/api/admin/trips/[id]/complete/route.ts`:
```ts
// PATCH — admin only
// Sets status = 'completed'
// Calls apply_points_event RPC: +100 pts for the trip owner (event_type: 'trip_completed')
// Schedules post_trip review prompt notification to n8n
// Revalidates cache
```

Add to trip detail page (`src/app/(app)/trip/[id]/page.tsx`):
```tsx
// Auto-complete check: if trip.status === 'active' AND trip end date < today
// Show banner: "Trip selesai! Bagikan pengalamanmu" with link to /trip/[id]/review
// Also show button: "Tandai Trip Selesai" (calls POST /api/trip/[id]/complete as self-service)
```

New self-service API `src/app/api/trip/[id]/complete/route.ts`:
```ts
// POST — trip owner only
// Only allowed if trip is 'active' or 'approved' (not blocking strict 'active' requirement)
// Sets status = 'completed'
// Awards points, schedules notification
```

---

#### P1.5 — Points Earning on Events

**Problem:** `apply_points_event` RPC exists in DB but is never called from the app.

**Events and Points:**

| Event | Points | Trigger Location |
|---|---|---|
| Trip completed | 100 | `/api/trip/[id]/complete` |
| Vendor review submitted | 50 | `/api/trip/[id]/reviews` POST |
| Photo uploaded | 10 | `/api/trip/[id]/photos` POST |
| Referral signup | 25 | `/api/user/profile` on onboarding (referral code detection) |

**Implementation:**

Create `src/lib/points.ts`:
```ts
export async function awardPoints(
  userId: string,
  pointsDelta: number,
  eventType: string,
  referenceId?: string
) {
  // Calls supabaseAdmin.rpc('apply_points_event', ...)
  // Fire-and-forget (doesn't block the response)
  // Revalidates user profile cache tag
}
```

Add `awardPoints` calls in:
- `src/app/api/trip/[id]/complete/route.ts` → +100
- `src/app/api/trip/[id]/reviews/route.ts` POST → +50 per first review per vendor
- `src/app/api/trip/[id]/photos/route.ts` POST → +10 per photo (max first 20)

Note: `apply_points_event` is `service_role` only in the DB, which is correct since `supabaseAdmin` uses the service role key.

---

### Phase 2: AI Quality Uplift (Days 6–12)


#### P2.2 — Vendor Database Seeding

**Problem:** `vendors` table is empty. AI has no internal data to use, so it falls back entirely to Tavily web search, which returns generic URLs, not structured data.

**Create seed file `supabase/seed/vendors.sql`:**

```sql
-- Seed 50+ verified Indonesian vendors across categories
-- Hotels
INSERT INTO public.vendors (name, type, city, province, price_tier, avg_rating, is_verified, location_lat, location_lng, tags) VALUES
('Alaya Resort Ubud', 'hotel', 'Ubud', 'Bali', 'premium', 4.8, true, -8.5069, 115.2625, ARRAY['romantic', 'nature', 'spa']),
('Komaneka at Bisma', 'hotel', 'Ubud', 'Bali', 'premium', 4.9, true, -8.5124, 115.2614, ARRAY['luxury', 'valley view', 'healing']),
('The Layar', 'villa', 'Seminyak', 'Bali', 'premium', 4.7, true, -8.6874, 115.1570, ARRAY['private pool', 'romantic', 'beach']),
('Svarga Loka Resort', 'hotel', 'Ubud', 'Bali', 'mid', 4.5, true, -8.5178, 115.2692, ARRAY['family', 'pool', 'rice terrace']),
('ZEN Rooms Kuta', 'hotel', 'Kuta', 'Bali', 'budget', 3.9, true, -8.7217, 115.1686, ARRAY['budget', 'central', 'beach access']),
('Plataran Borobudur', 'hotel', 'Magelang', 'Jawa Tengah', 'premium', 4.8, true, -7.6047, 110.2037, ARRAY['heritage', 'romantic', 'temple view']),
('Phoenix Hotel Yogyakarta', 'hotel', 'Yogyakarta', 'DIY', 'mid', 4.3, true, -7.7957, 110.3658, ARRAY['heritage', 'central', 'cultural']),
('The 101 Yogyakarta Tugu', 'hotel', 'Yogyakarta', 'DIY', 'mid', 4.4, true, -7.7876, 110.3636, ARRAY['central', 'family', 'cultural']),
('Aston Lombok Beach Resort', 'hotel', 'Senggigi', 'Nusa Tenggara Barat', 'mid', 4.2, true, -8.4892, 116.0492, ARRAY['beach', 'family', 'sunset']),
('Cocotinos Sekotong', 'hotel', 'Sekotong', 'Nusa Tenggara Barat', 'mid', 4.6, true, -8.7681, 115.9387, ARRAY['secluded', 'snorkeling', 'nature']),

-- Restaurants  
('Locavore', 'restaurant', 'Ubud', 'Bali', 'premium', 4.9, true, -8.5147, 115.2615, ARRAY['fine dining', 'local ingredients', 'romantic']),
('Warung Babi Guling Ibu Oka', 'restaurant', 'Ubud', 'Bali', 'budget', 4.7, true, -8.5059, 115.2622, ARRAY['local', 'babi guling', 'authentic']),
('Merah Putih Restaurant', 'restaurant', 'Seminyak', 'Bali', 'premium', 4.6, true, -8.6812, 115.1556, ARRAY['indonesian', 'fine dining', 'cocktails']),
('Naughty Nuri''s Warung', 'restaurant', 'Ubud', 'Bali', 'mid', 4.5, true, -8.5201, 115.2640, ARRAY['ribs', 'casual', 'social']),
('Gudeg Yu Djum', 'restaurant', 'Yogyakarta', 'DIY', 'budget', 4.8, true, -7.7883, 110.3761, ARRAY['gudeg', 'local', 'breakfast', 'authentic']),
('Jejamuran', 'restaurant', 'Yogyakarta', 'DIY', 'mid', 4.6, true, -7.7419, 110.3836, ARRAY['mushroom', 'vegetarian friendly', 'unique']),
('Bebek Goreng Pak Ndut', 'restaurant', 'Yogyakarta', 'DIY', 'budget', 4.4, true, -7.8039, 110.3658, ARRAY['local', 'duck', 'authentic']),
('RM Sate Kelinci Pak Pong', 'restaurant', 'Wonosobo', 'Jawa Tengah', 'budget', 4.5, true, -7.3634, 109.9002, ARRAY['satay', 'local', 'authentic']),
('Cafe Jepun Bali', 'restaurant', 'Kuta', 'Bali', 'mid', 4.3, true, -8.7189, 115.1701, ARRAY['breakfast', 'casual', 'vegetarian']),
('Sardine Restaurant', 'restaurant', 'Seminyak', 'Bali', 'premium', 4.7, true, -8.6801, 115.1582, ARRAY['seafood', 'romantic', 'rice paddy']),

-- Attractions
('Tegalalang Rice Terrace', 'attraction', 'Ubud', 'Bali', 'budget', 4.6, true, -8.4314, 115.2788, ARRAY['rice terrace', 'instagram', 'nature']),
('Tanah Lot Temple', 'attraction', 'Tabanan', 'Bali', 'budget', 4.7, true, -8.6213, 115.0868, ARRAY['temple', 'sunset', 'cultural']),
('Borobudur Temple', 'attraction', 'Magelang', 'Jawa Tengah', 'budget', 4.9, true, -7.6079, 110.2038, ARRAY['heritage', 'sunrise', 'UNESCO']),
('Prambanan Temple', 'attraction', 'Yogyakarta', 'DIY', 'budget', 4.8, true, -7.7520, 110.4914, ARRAY['heritage', 'Hindu', 'UNESCO']),
('Mount Bromo', 'attraction', 'Probolinggo', 'Jawa Timur', 'mid', 4.9, true, -7.9425, 112.9530, ARRAY['volcano', 'sunrise', 'adventure']),
('Nusa Penida Kelingking Beach', 'attraction', 'Nusa Penida', 'Bali', 'budget', 4.8, true, -8.7514, 115.4571, ARRAY['cliff', 'instagram', 'scenic']),
('Kuta Beach', 'attraction', 'Kuta', 'Bali', 'budget', 4.2, true, -8.7183, 115.1686, ARRAY['beach', 'surf', 'sunset']),
('Goa Gajah (Elephant Cave)', 'attraction', 'Ubud', 'Bali', 'budget', 4.4, true, -8.5235, 115.2878, ARRAY['temple', 'historical', 'cultural']),
('Malioboro Street', 'attraction', 'Yogyakarta', 'DIY', 'budget', 4.5, true, -7.7931, 110.3656, ARRAY['shopping', 'batik', 'cultural', 'street food']),
('Keraton Yogyakarta', 'attraction', 'Yogyakarta', 'DIY', 'budget', 4.6, true, -7.8056, 110.3642, ARRAY['heritage', 'sultanate', 'cultural']),

-- Experiences
('Ubud Monkey Forest Trekking', 'experience', 'Ubud', 'Bali', 'budget', 4.3, true, -8.5185, 115.2585, ARRAY['wildlife', 'nature', 'walking']),
('Balinese Cooking Class Paon Bali', 'experience', 'Ubud', 'Bali', 'mid', 4.8, true, -8.5127, 115.2611, ARRAY['cooking', 'cultural', 'hands-on']),
('White Water Rafting Ayung River', 'experience', 'Ubud', 'Bali', 'mid', 4.6, true, -8.5342, 115.2342, ARRAY['adventure', 'river', 'group']),
('Batik Workshop Yogyakarta', 'experience', 'Yogyakarta', 'DIY', 'budget', 4.7, true, -7.8021, 110.3649, ARRAY['craft', 'cultural', 'hands-on']),
('Sunrise Merapi Jeep Tour', 'experience', 'Yogyakarta', 'DIY', 'mid', 4.8, true, -7.5410, 110.4457, ARRAY['adventure', 'volcano', 'sunrise', 'jeep']),
('Wayang Kulit Performance Sonobudoyo', 'experience', 'Yogyakarta', 'DIY', 'budget', 4.5, true, -7.8012, 110.3638, ARRAY['traditional', 'cultural', 'night']),
('Snorkeling Menjangan Island', 'experience', 'Buleleng', 'Bali', 'mid', 4.7, true, -8.1184, 114.5228, ARRAY['snorkeling', 'marine', 'nature']),
('Komodo Dragon Tour', 'experience', 'Labuan Bajo', 'Nusa Tenggara Timur', 'mid', 4.9, true, -8.4540, 119.8896, ARRAY['wildlife', 'unique', 'boat']),

-- Transport
('Sanur–Nusa Penida Fast Boat (Mola Mola Express)', 'transport', 'Sanur', 'Bali', 'mid', 4.4, true, -8.6775, 115.2628, ARRAY['fast boat', 'Nusa Penida', 'reliable']),
('Blue Bird Taxi Bali', 'transport', 'Denpasar', 'Bali', 'budget', 4.3, true, -8.6705, 115.2126, ARRAY['taxi', 'metered', 'reliable']),
('Grab Yogyakarta', 'transport', 'Yogyakarta', 'DIY', 'budget', 4.2, true, -7.7971, 110.3688, ARRAY['ride-hailing', 'affordable', 'app']),
('Perama Tour Bus Bali–Lombok', 'transport', 'Denpasar', 'Bali', 'budget', 3.9, true, -8.6705, 115.2126, ARRAY['tourist bus', 'ferry', 'budget']),
('Bluebird Limousine Airport Transfer', 'transport', 'Denpasar', 'Bali', 'mid', 4.5, true, -8.7382, 115.1669, ARRAY['airport', 'ac', 'reliable']),

-- Guides
('Made Bali Private Tour Guide', 'guide', 'Ubud', 'Bali', 'mid', 4.9, true, -8.5069, 115.2625, ARRAY['English', 'Balinese culture', 'flexible']),
('Yogyakarta Local Guide Pak Slamet', 'guide', 'Yogyakarta', 'DIY', 'budget', 4.8, true, -7.7971, 110.3688, ARRAY['Bahasa Indonesia', 'history', 'temple']);
```

---

#### P2.3 — Enhanced Generation Prompts

**Upgrade `src/app/api/ai/generate-trip/route.ts` system prompt:**

```ts
const GENERATION_SYSTEM_PROMPT = `
You are TravelYu Itinerary Engine, an expert trip planner for Indonesian domestic destinations.

## Core Rules
1. You MUST call the save_itinerary tool with the complete itinerary. Never output JSON as text.
2. Every item needs a realistic est_cost_idr based on actual Indonesian 2025/2026 prices.
3. Balance the day (morning/afternoon/evening) — avoid clustering everything in morning.
4. Include transport items between locations if they are >2km apart.
5. Dining items must be included at least twice per day.
6. Accommodation must be included on day_number 1 with time_slot 'evening'.
7. IMPORTANT: Indonesian price benchmarks:
   - Budget hotel/guesthouse: Rp 200.000–500.000/night
   - Mid hotel: Rp 500.000–1.500.000/night  
   - Premium villa: Rp 1.500.000–5.000.000/night
   - Local warung meal: Rp 20.000–50.000/person
   - Mid restaurant: Rp 50.000–150.000/person
   - Premium restaurant: Rp 150.000–500.000/person
   - Local attraction: Rp 15.000–75.000/person
   - Premium experience: Rp 150.000–500.000/person
   - Grab/taxi short trip: Rp 25.000–80.000
   - Fast boat between islands: Rp 150.000–350.000

## Itinerary Quality Rules
- Day 1: Arrival + check-in + welcome dinner + easy orientation activity
- Middle days: Core attractions + experiences + local food discovery
- Last day: Morning activity + checkout + departure (estimate transport)
- Mix activity types: never 3 attractions in a row; break with dining, rest, or transport
- Include at least 1 hidden gem (non-touristy spot) per trip
- Pacing: slow=max 2 activities/day, balanced=3-4/day, packed=5-6/day

## Data Priority
1. Use internal vendor DB names if provided in context (these are verified)
2. For gaps, generate realistic Indonesian venue names with accurate descriptions
3. Prices must reflect current 2026 Indonesian market rates

## Output Format
Call save_itinerary with a complete, realistic Indonesian trip. The tripId, totalEstCostIdr,
and all items must be accurate and ready for the user to act on.
`;
```

**Upgrade vendor context injection in `generate-trip/route.ts`:**

```ts
// Before calling AI, fetch relevant vendors from DB
const { data: relevantVendors } = await supabaseAdmin
  .from('vendors')
  .select('id, name, type, city, price_tier, avg_rating, tags')
  .ilike('city', `%${destinationCity}%`)
  .eq('is_verified', true)
  .limit(30);

const vendorContext = relevantVendors?.map(v => 
  `[${v.type.toUpperCase()}] ${v.name} | ${v.city} | ${v.price_tier} | ${v.avg_rating}★ | ${v.tags?.join(', ')}`
).join('\n') ?? 'No vendors in database for this destination.';

// Inject into prompt:
const prompt = `
...intake data...

VERIFIED VENDORS AVAILABLE FOR THIS DESTINATION:
${vendorContext}

Prioritize using these verified vendors by name in your itinerary items.
For each vendor used, set source='internal_db'.
For items not in the vendor list, set source='web_search' and generate realistic details.
`;
```

---

#### P2.4 — Better Intake System Prompt

Replace the current intake system prompt in `src/app/api/ai/intake/route.ts`:

```ts
const INTAKE_SYSTEM_PROMPT = `
Kamu adalah TravelYu AI, asisten perencanaan perjalanan domestik Indonesia yang hangat dan responsif.

## Tujuan
Kumpulkan TEPAT 7 parameter ini melalui percakapan natural:
1. **WHO** — Siapa saja yang ikut (jumlah, tipe grup: solo/pasangan/keluarga/teman)
2. **VIBE** — Suasana trip yang diinginkan (healing/adventure/kuliner/budaya/mixed)
3. **WHEN** — Tanggal atau periode keberangkatan + durasi
4. **WHERE** — Destinasi di Indonesia (boleh kabur: "Bali" atau lebih spesifik: "Ubud")
5. **BUDGET** — Anggaran total dalam IDR (semua orang, semua biaya)
6. **PACING** — Ritme perjalanan (santai/balanced/padat)
7. **SPECIAL_NEEDS** — Kebutuhan khusus (vegetarian, aksesibilitas, alergi, dll.) — bisa "tidak ada"

## Aturan Percakapan
- Tanyakan SATU hal per giliran. Jangan bertanya 2 hal sekaligus.
- Gunakan Bahasa Indonesia yang hangat dan casual (bukan kaku/formal).
- Jika user memberikan jawaban yang samar, klarifikasi dengan pertanyaan lanjutan.
- Setelah semua 7 parameter terkumpul, buat RINGKASAN KONFIRMASI singkat yang jelas.
- Tunggu konfirmasi user ("oke", "bener", "ya", "lanjut") sebelum mengeluarkan token selesai.
- Setelah user mengonfirmasi, keluarkan token [INTAKE_COMPLETE] di baris TERAKHIR.

## Panduan Destinasi Indonesia
- Jika user belum tahu destinasi: "Boleh cerita lebih tentang vibe yang kamu mau? Nanti AI bisa bantu rekomendasikan."
- Destinasi populer: Bali, Lombok, Yogyakarta, Raja Ampat, Labuan Bajo, Bromo, Nusa Penida, Gili Islands
- Selalu validasi: destinasi harus di Indonesia.

## Budget Guidance
- Budget rendah: <Rp 1,5 juta/orang/hari
- Budget menengah: Rp 1,5–4 juta/orang/hari  
- Budget premium: >Rp 4 juta/orang/hari
- Jika budget tidak realistis untuk destinasi, jelaskan dengan ramah dan tawarkan alternatif.

## JANGAN
- Jangan sebut angka harga spesifik sebelum 7 parameter lengkap
- Jangan rekomendasikan destinasi luar negeri
- Jangan lewati konfirmasi sebelum mengeluarkan [INTAKE_COMPLETE]
`;
```

---

#### P2.5 — AI Editor Tool Result Rendering

**Problem:** When the AI editor calls tools (update_itinerary_item, swap_vendor, etc.), the tool execution result is not shown in the chat bubble. User doesn't know if the edit succeeded.

**Fix `src/components/itinerary/editor-chat.tsx`:**

```tsx
// The useChat hook from @ai-sdk/react provides message parts
// Tool invocation parts have type: 'tool-invocation'
// Tool result parts have type: 'tool-result'
// Need to render these in the chat UI

function renderMessageParts(parts: MessagePart[]) {
  return parts.map((part, idx) => {
    if (part.type === 'text') {
      return <p key={idx} className="whitespace-pre-line">{part.text}</p>;
    }
    if (part.type === 'tool-invocation') {
      return (
        <div key={idx} className="mt-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs">
          <p className="font-semibold text-blue-700">🔧 {formatToolName(part.toolInvocation.toolName)}</p>
          <p className="text-blue-600 mt-0.5">{formatToolArgs(part.toolInvocation)}</p>
        </div>
      );
    }
    if (part.type === 'tool-result') {
      const isOk = part.result?.ok === true;
      return (
        <div key={idx} className={`mt-1 rounded-lg px-3 py-2 text-xs ${isOk ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'} border`}>
          {isOk ? '✅ Perubahan berhasil disimpan' : `❌ ${part.result?.error ?? 'Perubahan gagal'}`}
          {part.result?.flagged && <span className="ml-2 text-amber-600">📋 Menunggu approval CS</span>}
        </div>
      );
    }
    return null;
  });
}

function formatToolName(name: string): string {
  const labels: Record<string, string> = {
    update_itinerary_item: 'Update aktivitas',
    add_itinerary_item: 'Tambah aktivitas',
    delete_itinerary_item: 'Hapus aktivitas',
    swap_vendor: 'Ganti vendor',
    flag_for_cs_approval: 'Kirim ke CS',
    search_alternatives: 'Cari alternatif',
    generate_packing_list: 'Generate packing list',
    get_weather_info: 'Cek cuaca',
    escalate_to_human_cs: 'Hubungi CS',
  };
  return labels[name] ?? name;
}
```

Also: after a successful tool call that modifies `itinerary_items`, call `router.refresh()` so the timeline and budget tracker update without full reload.

---

#### P2.6 — Live Weather in Workspace

**Problem:** `WeatherBanner` receives hardcoded props. The workspace doesn't call the weather API.

**Fix `src/app/(app)/trip/[id]/page.tsx`:**

Create a proper server component `WeatherFetcher` that calls the weather API:

```tsx
async function WeatherSection({ city }: { city: string }) {
  try {
    // Call internal weather API (which calls OpenWeatherMap)
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/weather/${encodeURIComponent(city)}`, {
      next: { revalidate: 3600 } // cache 1 hour
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();
    const forecast = data.forecast as Array<{
      weather: Array<{ main: string; description: string }>;
      main: { temp: number };
      dt_txt: string;
    }>;
    
    if (!forecast?.length) return null;
    
    // Detect rain in next 3 days
    const hasRain = forecast.slice(0, 12).some(f => 
      f.weather[0]?.main?.toLowerCase().includes('rain')
    );
    
    const avgTemp = Math.round(forecast[0]?.main?.temp ?? 28);
    
    if (hasRain) {
      return (
        <WeatherBanner
          city={city}
          condition="rain"
          advice={`Potensi hujan di ${city} dalam 3 hari ke depan. Pertimbangkan jadwal outdoor activities di pagi hari.`}
        />
      );
    }
    
    return (
      <WeatherBanner
        city={city}
        condition="clear"
        advice={`Cuaca cerah di ${city} ~${avgTemp}°C. Kondisi ideal untuk outdoor activities!`}
      />
    );
  } catch {
    return null; // silently fail, weather is non-critical
  }
}
```

Add `NEXT_PUBLIC_APP_URL` to env: `http://localhost:3000` in dev, production URL in prod.

---

#### P2.7 — Packing List: Real AI Generation

**Problem:** `/trip/[id]/packing` page returns `mockPackingList` from `data.ts`. The AI tool exists but is never called from the page.

**New approach:** Generate packing list server-side on page load if not already cached.

Add `getOrGeneratePackingList(tripId)` to `src/lib/data.ts`:
```ts
export async function getOrGeneratePackingList(tripId: string, trip: Trip) {
  // Check if packing list is stored in trip metadata (intake_data.packingList)
  if (trip.intake_data?.packingList) {
    return trip.intake_data.packingList as PackingItem[];
  }
  
  // Generate via AI (simplified, no tool calling — just generateText)
  const destination = trip.intake_data?.where ?? 'Indonesia';
  const duration = extractDurationDays(trip.intake_data?.when ?? '3 hari');
  const activities = extractActivities(trip.intake_data?.vibe ?? '');
  
  try {
    const { text } = await generateText({
      model: chatModel,
      prompt: `Generate packing list untuk trip ke ${destination}, ${duration} hari, aktivitas: ${activities}.
Return JSON array: [{"item": "...", "category": "Essentials|Clothing|Documents|Health|Electronics|Activities", "checked": false}]
Max 25 items. Return ONLY JSON, no markdown.`,
      maxRetries: 1,
    });
    
    const parsed = JSON.parse(text.trim()) as PackingItem[];
    
    // Cache to trips.intake_data
    await supabaseAdmin
      .from('trips')
      .update({ intake_data: { ...trip.intake_data, packingList: parsed } })
      .eq('id', tripId);
    
    return parsed;
  } catch {
    return mockPackingList; // genuine fallback
  }
}
```

Update `src/app/(app)/trip/[id]/packing/page.tsx`:
```tsx
export default async function TripPackingPage({ params }) {
  const { id } = await params;
  const trip = await getTripById(id);
  if (!trip) redirect('/dashboard');
  const items = await getOrGeneratePackingList(id, trip);
  return <PackingList initialItems={items} tripId={id} />;
}
```

---

### Phase 3: UX Completeness (Days 13–18)

#### P3.1 — "Regen This Day" Button

Users need to be able to regenerate a single day's itinerary without regenerating the whole trip.

New API `src/app/api/trip/[id]/regen-day/route.ts`:
```ts
// POST { dayNumber: number }
// Requires trip owner auth
// Calls AI to generate new items for that day only
// Deletes existing items for that day
// Inserts new items
// Revalidates cache
```

Add to `src/components/itinerary/timeline.tsx`:
```tsx
// Each day card header has a "🔄 Regen hari ini" button (small, secondary)
// Confirms in a dialog: "Yakin? Aktivitas hari {n} akan diubah AI."
// Shows loading spinner on that day's card during regen
```

---

#### P3.2 — Vendor Detail Popover

When user clicks an itinerary item, show a popover with:
- Vendor name, type, city, rating, price tier
- Tags
- "Tukar vendor" button (triggers AI editor with pre-filled prompt)
- Link to booking_url if available
- Google Maps link (lat/lng)

Implement as `src/components/itinerary/vendor-popover.tsx`.

---

#### P3.3 — Generating Progress UX

**Problem:** "Sedang Diproses AI" screen shows a spinner but no estimated time or progress.

**Enhancement:**

```tsx
// In trip/[id]/page.tsx, for status === 'generating':
// Show elapsed time counter
// Show progress messages that rotate:
//   0-10s: "Memilih aktivitas terbaik untuk kamu..."
//   10-20s: "Menyusun jadwal harian yang optimal..."
//   20-30s: "Mengecek cuaca dan kondisi lokal..."
//   30s+: "Hampir selesai! Memfinalisasi budget..."
// Show estimated time: "Proses ini biasanya 30-90 detik"
```

---

#### P3.4 — Trip Status Active Toggle

When trip status is `approved`, add a banner in the workspace:

```tsx
// "Trip sudah disetujui! Aktifkan perjalananmu ketika kamu berangkat."
// Button: "Mulai Trip" → PATCH status to 'active'
// This enables the H-1 reminder trigger check
```

New API `src/app/api/trip/[id]/activate/route.ts`:
```ts
// PATCH — trip owner only, trip must be 'approved'
// Sets status = 'active'
// Schedules H-1 reminder notification (using trip's when date)
// Schedules post-trip complete notification (using trip end date + 1 day)
```

---

#### P3.5 — Enhanced PDF Export

Replace pdf-lib basic output with a branded multi-page PDF:

`src/app/api/trip/[id]/export-pdf/route.ts` improvements:
```ts
// Page 1: Cover page — TravelYu logo, trip name, destination, dates, traveler name
// Page 2+: Day-by-day itinerary with:
//   - Day header with total daily budget
//   - Time slots with activity icons (text-based: [🏨] [🍽️] [🎭] [🚌])
//   - Location address
//   - Tips section
//   - Estimated cost per item
// Last page: Total budget breakdown by category + packing list summary
// Footer on each page: "Generated by TravelYu.id | trip/{public_id}"
```

---

#### P3.6 — Onboarding Complete Gate

After onboarding modal is submitted:
1. Save `whatsapp_number`, `full_name`, `travel_preferences` to DB
2. Set `onboarding_completed = true`
3. Grant 25 welcome points via `apply_points_event`
4. Show confetti or celebration moment
5. Redirect to `/trip/new` with a "Yuk buat trip pertamamu!" prompt

---

### Phase 4: Admin Completeness (Days 19–22)

#### P4.1 — Admin Trip Management Enhanced

`src/app/(admin)/admin/trips/page.tsx` needs:
- Status filter tabs (All | Draft | Approved | Active | Completed)
- For `draft` trips: "Approve" button → calls `/api/admin/trips/[id]/approve`
- For `active` trips: "Mark Completed" button → calls `/api/admin/trips/[id]/complete`
- Trip expanded view: show `intake_data` summary, creation date, user WA number
- Sort by created_at desc (most recent first)

#### P4.2 — Admin Analytics Real Data

`src/app/(admin)/admin/analytics/page.tsx` — add charts:
- Trip volume by week (7-day rolling)
- Status distribution pie chart
- Revenue funnel (intake → comparison → generated)
- Top destinations by trip count

Use inline SVG charts (no chart library dependency — CSS-based bar charts).

---

## 7. AI Quality Uplift Plan

### 7.1 Prompt Engineering Principles

| Principle | Current State | Target |
|---|---|---|
| Output format enforcement | JSON requested in prose | Explicit JSON schema in prompt + zod validation |
| Tool choice strategy | `toolChoice: auto` | `toolChoice: required` for generation |
| Context window usage | ~1000 tokens | 4000-8000 tokens with full vendor context |
| Retry strategy | maxRetries: 2 | Primary model + fallback model pattern |
| Validation | Basic zod on output | Full itinerary validation before DB insert |
| Grounding | Web search only | Vendor DB first, Tavily second |

### 7.2 Generation Validation Layer

Before inserting any itinerary items, validate the AI output:

```ts
// src/lib/ai/validate-itinerary.ts
export function validateItinerary(items: unknown[]): {
  valid: boolean;
  errors: string[];
  corrected?: SavedItinerary;
} {
  const errors: string[] = [];
  
  if (!Array.isArray(items) || items.length < 3) {
    errors.push(`Too few items: ${items?.length ?? 0}. Minimum 3.`);
  }
  
  const hasDining = items.some((i: any) => i.activityType === 'dining');
  if (!hasDining) errors.push('No dining items — at least 1 meal required');
  
  const hasAccommodation = items.some((i: any) => i.activityType === 'accommodation');
  if (!hasAccommodation) errors.push('No accommodation item');
  
  const totalCost = items.reduce((sum: number, i: any) => sum + (i.estCostIdr ?? 0), 0);
  if (totalCost < 100000) errors.push(`Total cost Rp ${totalCost} seems too low`);
  if (totalCost > 200_000_000) errors.push(`Total cost Rp ${totalCost} seems too high`);
  
  // Check for duplicate titles
  const titles = items.map((i: any) => i.title);
  const dupTitles = titles.filter((t, idx) => titles.indexOf(t) !== idx);
  if (dupTitles.length > 0) errors.push(`Duplicate items: ${dupTitles.join(', ')}`);
  
  return { valid: errors.length === 0, errors };
}
```

If validation fails, log errors and trigger the fallback generation path.

### 7.3 Tavily Search Strategy

Current Tavily usage: one generic query per generation. Improve:

```ts
// src/lib/ai/tavily.ts — enhanced
export async function searchIndonesiaPlaces(
  query: string, 
  limit = 5,
  options?: {
    searchType?: 'attractions' | 'restaurants' | 'hotels' | 'activities';
    city?: string;
  }
) {
  const enrichedQuery = options?.city 
    ? `${query} ${options.city} Indonesia 2025 review`
    : `${query} Indonesia wisata terbaik 2025`;
  
  // ... fetch with enriched query
}

// Pre-fetch 3 targeted searches before generation:
const [attractionsData, restaurantsData, activitiesData] = await Promise.allSettled([
  searchIndonesiaPlaces('wisata terbaik', 8, { searchType: 'attractions', city: destinationCity }),
  searchIndonesiaPlaces('restoran lokal rekomendasi', 5, { searchType: 'restaurants', city: destinationCity }),
  searchIndonesiaPlaces('aktivitas pengalaman unik', 5, { searchType: 'activities', city: destinationCity }),
]);

// Compile into context string for the AI prompt
const webResearchContext = [
  formatSearchResults('ATTRACTIONS', attractionsData),
  formatSearchResults('RESTAURANTS', restaurantsData),
  formatSearchResults('ACTIVITIES', activitiesData),
].join('\n\n');
```

### 7.4 Intake Completion — Dual Detection

Instead of relying only on the `[INTAKE_COMPLETE]` token (which models sometimes paraphrase), add a server-side check:

```ts
// src/app/api/trip/[id]/intake-check/route.ts
// POST { conversationHistory: string }
// Uses a fast AI call to evaluate if all 7 params are collected
// Returns { complete: boolean, missingParams: string[], summary: string }
// This runs independently of the streaming chat
```

Call this from the client every time a new assistant message arrives. If `complete: true` AND the streaming has stopped, trigger the comparison generation.

This adds redundancy: either the token is detected OR the server-side check confirms completion.

---

## 8. Data Architecture Changes

### 8.1 New Migrations Needed

**Migration 010: Onboarding flag**
```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
```

**Migration 011: Trip metadata extensions**  
```sql
-- Allow storing packingList and other computed fields in intake_data JSONB
-- No schema change needed — JSONB is flexible. Just document the new keys:
-- intake_data.packingList: PackingItem[]
-- intake_data.completionCheckedAt: ISO timestamp
-- intake_data.generationAttempts: number
```

**Migration 012: Realtime enable**
```sql
-- Enable realtime for trip status changes (so client gets live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.itinerary_items;
```

**Migration 013: Trip active dates**
```sql
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS trip_start_date date,
ADD COLUMN IF NOT EXISTS trip_end_date date;
-- Populate from intake_data.when on trip generation
```

### 8.2 Trip Status Auto-Update via Supabase Realtime

Replace the polling `GeneratingPoller` with Supabase Realtime subscription:

```tsx
// src/components/trip/trip-status-watcher.tsx
"use client";

export function TripStatusWatcher({ tripId, initialStatus }: { tripId: string; initialStatus: TripStatus }) {
  const router = useRouter();
  
  useEffect(() => {
    if (initialStatus !== 'generating') return;
    
    const channel = supabaseRealtime
      .channel(`trip-status-${tripId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'trips',
        filter: `id=eq.${tripId}`,
      }, (payload) => {
        const newStatus = payload.new?.status;
        if (newStatus && newStatus !== 'generating') {
          router.refresh();
        }
      })
      .subscribe();
      
    return () => { void supabaseRealtime.removeChannel(channel); };
  }, [tripId, initialStatus, router]);
  
  return null;
}
```

Replace `GeneratingPoller` usage with `TripStatusWatcher` in `trip/[id]/page.tsx`.

---

## 9. File-by-File Implementation Guide

### Priority 1 — Blocking E2E (implement in this order)

```
1.  src/lib/points.ts                              NEW — awardPoints utility
2.  src/app/api/trip/[id]/complete/route.ts        NEW — self-service trip completion
3.  src/app/api/admin/trips/[id]/approve/route.ts  NEW — admin approve draft
4.  src/app/api/admin/trips/[id]/complete/route.ts NEW — admin mark completed
5.  src/app/api/user/profile/route.ts              NEW — update profile
6.  src/app/api/trip/[id]/intake-progress/route.ts NEW — partial intake save
7.  src/app/api/trip/[id]/activate/route.ts        NEW — mark trip active
8.  src/components/onboarding/onboarding-modal.tsx NEW — first-time onboarding
9.  src/app/(app)/layout.tsx                       MODIFY — add onboarding modal check
10. src/app/(admin)/admin/trips/page.tsx           MODIFY — add approve/complete buttons
11. src/app/api/trip/[id]/reviews/route.ts         MODIFY — add +50 pts on review
12. src/app/api/trip/[id]/photos/route.ts          MODIFY — add +10 pts on photo upload
```

### Priority 2 — AI Quality (implement after Priority 1)

```
13. src/lib/ai/openrouter.ts                       MODIFY — add generationModel, chatModel
14. src/lib/ai/validate-itinerary.ts               NEW — output validation
15. src/lib/ai/tavily.ts                           MODIFY — enhanced search strategy
16. src/app/api/ai/generate-trip/route.ts          MODIFY — better prompts, vendor context
17. src/app/api/ai/intake/route.ts                 MODIFY — better system prompt
18. src/app/api/ai/compare-options/route.ts        MODIFY — use generationModel
19. supabase/seed/vendors.sql                      NEW — 50+ Indonesian vendors
20. src/app/api/trip/[id]/intake-check/route.ts    NEW — server-side completion check
```

### Priority 3 — UX Completeness (implement last)

```
21. src/components/itinerary/editor-chat.tsx       MODIFY — render tool results
22. src/components/itinerary/timeline.tsx          MODIFY — add regen-day button, vendor popover
23. src/components/trip/trip-status-watcher.tsx    NEW — realtime status update
24. src/components/weather/weather-banner.tsx      MODIFY — make data-driven
25. src/app/(app)/trip/[id]/page.tsx               MODIFY — live weather, status-watcher, activate button
26. src/app/(app)/trip/[id]/packing/page.tsx       MODIFY — use getOrGeneratePackingList
27. src/lib/data.ts                                MODIFY — add getOrGeneratePackingList
28. src/app/api/trip/[id]/export-pdf/route.ts      MODIFY — branded multi-page PDF
29. src/app/api/trip/[id]/regen-day/route.ts       NEW — regenerate single day
30. src/components/vendor-detail/vendor-popover.tsx NEW — item detail view
```

---

## 10. Notification Integration (n8n)

The n8n workflow at `src/lib/n8n-workflow.ts` handles all Email and WhatsApp delivery. This section defines when and how the Next.js app triggers it.

### 10.1 Notification Trigger Map

| Event | Trigger Location | n8n Event Type | Channel |
|---|---|---|---|
| Itinerary ready | `POST /api/admin/trips/[id]/approve` | `itinerary_ready` | both |
| CS approved change | `PATCH /api/trip/[id]/flagged/[queueId]` | `cs_approved` | both |
| Trip reminder H-1 | `POST /api/trip/[id]/activate` (schedules H-1) | `trip_reminder_h1` | both |
| Post-trip review prompt | `POST /api/trip/[id]/complete` | `post_trip_review` | email |
| Points earned | after points RPC | `points_earned` | whatsapp |
| Vendor contacted | CS action in admin | `vendor_contact` | whatsapp |

### 10.2 H-1 Reminder Scheduling

n8n doesn't natively support "send at a future time" without a scheduler node. Options:

**Option A: Vercel Cron (recommended for simplicity)**

Add `src/app/api/cron/trip-reminders/route.ts`:
```ts
// Called daily at 09:00 WIB via vercel.json cron
// Queries trips where:
//   status = 'active' AND trip_start_date = CURRENT_DATE + 1
// For each: fire n8n notification
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Verify cron secret header
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const { data: trips } = await supabaseAdmin
    .from('trips')
    .select('id, user_id, trip_start_date')
    .eq('status', 'active')
    .eq('trip_start_date', tomorrow.toISOString().split('T')[0]);
  
  for (const trip of trips ?? []) {
    const recipient = await resolveTripRecipient(trip.id);
    if (recipient) {
      await sendTravelYuNotification({
        eventType: 'trip_reminder_h1',
        tripId: trip.id,
        userName: recipient.userName,
        email: recipient.email,
        phoneE164: recipient.phoneE164,
        channelPreference: 'both',
      });
    }
  }
  
  return Response.json({ ok: true, processed: trips?.length ?? 0 });
}
```

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/trip-reminders",
      "schedule": "0 2 * * *"
    }
  ]
}
```

(02:00 UTC = 09:00 WIB)

**Option B: n8n Schedule Trigger**
Add a Schedule node in n8n that runs daily and queries Supabase directly. More complex to set up but doesn't require Vercel.

### 10.3 Post-Trip Review Prompt

Trigger from `POST /api/trip/[id]/complete`:
```ts
scheduleNotification({
  eventType: 'post_trip_review' as any, // add to n8n workflow
  tripId: trip.id,
  userName: recipient.userName,
  email: recipient.email,
  phoneE164: null, // email only for review prompt
  channelPreference: 'email',
  subject: 'Bagaimana tripmu ke [destination]?',
  emailText: `Halo [nama], trip ke [destination] sudah selesai! Yuk bagikan pengalamanmu dan bantu traveler lain. Klik di sini: [review link]`,
});
```

Add `post_trip_review` case to n8n Switch node.

---

## 11. Acceptance Criteria

### Full E2E Journey Checklist

The implementation is complete when all of these pass:

**Onboarding**
- [ ] New user after Clerk login sees onboarding modal on first visit
- [ ] Modal captures WA number (validated: starts with 08/+62)
- [ ] 25 welcome points awarded on onboarding completion

**Intake**
- [ ] AI chat greets user and collects all 7 parameters
- [ ] Each detected parameter auto-saved to `trips.intake_data` (verify in Supabase dashboard)
- [ ] Progress tracker shows correct field as detected (not all false)
- [ ] After 7th parameter confirmed, comparison options page loads within 45 seconds
- [ ] Trip comparison shows 3 distinct cards with budget differences

**Generation**
- [ ] User selects option, clicks Generate
- [ ] Trip status → `generating` within 1 second (UI updates without page reload)
- [ ] Itinerary generated with at least 8 items for a 3-day trip
- [ ] At least 2 dining items, 1 accommodation, 1 transport included
- [ ] `source` field is `internal_db` for seeded vendors, `web_search` for others
- [ ] Total cost is realistic (between Rp 1M–50M for a 3-5 day trip)
- [ ] Trip status → `draft` in production (or `approved` in dev)

**Admin Approval**
- [ ] Admin visits `/admin/trips`, sees trip in `draft` state
- [ ] Admin clicks Approve → status changes to `approved`
- [ ] n8n webhook fires `itinerary_ready` event
- [ ] User receives (simulated) notification

**Workspace**
- [ ] User sees full timeline on `/trip/[id]`
- [ ] Weather banner shows real condition for destination city
- [ ] AI editor chat renders tool results (✅ or ❌ after each change)
- [ ] Budget tracker updates after AI adds/removes item (route.refresh())
- [ ] Map shows correct city area
- [ ] Packing list is AI-generated, not mock data
- [ ] PDF export downloads with proper branding and full itinerary

**Post-Trip**
- [ ] User clicks "Mulai Trip" → status `active`
- [ ] User clicks "Selesaikan Trip" → status `completed` + 100 pts
- [ ] Vendor review page accessible and submittable
- [ ] +50 pts after review submission
- [ ] Photo upload works, +10 pts per photo
- [ ] Memory wall shows uploaded photos
- [ ] Loyalty tier updates (explorer → adventurer at 500 pts)

**Admin Quality**
- [ ] CS flagged queue shows items with approve/reject working
- [ ] CS chat sends messages visible to user
- [ ] WhatsApp log shows queued messages

---

## Appendix B: Recommended Development Order

**Week 1 (Days 1–5): Critical Path**
- Day 1: Onboarding modal + profile API + points utility
- Day 2: Trip complete API (admin + self-service) + activate API
- Day 3: Admin approve button + points integration in reviews/photos
- Day 4: Intake progress persistence + dual completion detection
- Day 5: Test full E2E journey manually

**Week 2 (Days 6–10): AI Quality**
- Day 6-7: Vendor seed SQL + model strategy refactor
- Day 8-9: Enhanced generation prompt + validation layer + Tavily improvements
- Day 10: Packing list AI generation + intake system prompt upgrade

**Week 3 (Days 11-15): UX**
- Day 11: Editor tool result rendering + route.refresh() after tool calls
- Day 12: Live weather + realtime trip status watcher
- Day 13: Regen-day button + vendor popover
- Day 14: PDF export branding
- Day 15: Generating progress UX + trip activate/complete banners in workspace

**Week 4 (Days 16-20): Admin + Notifications**
- Day 16-17: Admin trip management (filters, approve, complete buttons)
- Day 18: H-1 cron + post-trip email trigger
- Day 19: Full notification testing against n8n
- Day 20: End-to-end QA pass, acceptance criteria checklist

---

*TravelYu Implementation Plan v2.0 — Internal Technical Document*  
*Generated: March 2026 | Next Review: After Week 2 completion*
