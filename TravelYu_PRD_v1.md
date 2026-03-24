# TravelYu! — Product Requirements Document

**AI-Assisted Personal Travel Planning Platform for Indonesian Destinations**
Version 1.0 | March 2026 | MVP Build

**Tech Stack:** Next.js 16 · Tailwind CSS · Shadcn UI · Supabase · OpenRouter · WAHA

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Core User Flows](#2-core-user-flows)
3. [Feature Specifications](#3-feature-specifications-mvp)
4. [Admin Dashboard](#4-admin-dashboard-cs-interface)
5. [AI Architecture](#5-ai-architecture)
6. [Database Schema](#6-database-schema-supabase-postgresql)
7. [External API Integrations](#7-external-api-integrations)
8. [App Route Structure](#8-app-route-structure-nextjs-16-app-router)
9. [Key Component Architecture](#9-key-component-architecture)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Development Phases & Milestones](#11-development-phases--milestones)

---

## 1. Product Overview

### 1.1 Vision

TravelYu! adalah platform personal travel planning berbasis AI untuk destinasi Indonesia. Platform ini menggabungkan conversational AI agent untuk intake dan editing itinerary, dengan human-in-the-loop (CS) untuk kurasi final dan booking vendor. Tujuannya: menghilangkan friction perencanaan perjalanan sehingga pengguna dapat fokus pada pengalaman liburannya.

### 1.2 Problem Statement

| Pain Point | Dampak ke User |
|---|---|
| Information overload dari terlalu banyak pilihan | Stres, paralysis, waktu terbuang |
| Perencanaan itinerary memakan waktu & energi | Liburan terasa seperti pekerjaan |
| Risiko salah pilih hotel/aktivitas | Pengalaman suboptimal, uang terbuang |
| Tidak ada kurator terpercaya untuk destinasi lokal | Kehilangan hidden gems Indonesia |
| OTA hanya booking — tidak ada personalisasi | Itinerary generik tidak sesuai vibe |

### 1.3 Solution

TravelYu! menjadi "personal travel concierge digital" — AI mengumpulkan preferensi via chat, menghasilkan draft itinerary terkurasi, dan CS manusia mengawasi/mengoverride bila diperlukan. User bisa edit itinerary via AI chat kapan saja.

### 1.4 Target Market

| Segmen | Karakteristik & Kebutuhan |
|---|---|
| Budget Travelers | Mahasiswa & anak muda, cari promo, harga transparan, easy booking |
| Young Professionals | Short trip, booking cepat & praktis, tidak mau riset panjang |
| Family Travelers | Utamakan keamanan & kenyamanan, butuh aktivitas untuk semua usia |
| Business Travelers | Fleksibilitas jadwal, invoice resmi, perubahan last-minute |
| Digital-Savvy Travelers | Cari destinasi viral & hidden gem, itinerary Instagram-worthy |

### 1.5 Success Metrics (KPIs)

| Metric | Target MVP (3 bulan) | Target 6 Bulan |
|---|---|---|
| Completed Trip Plans (paid) | 50 trips/bulan | 200 trips/bulan |
| AI Intake Completion Rate | >70% | >85% |
| CS Intervention Rate | <30% trips | <15% trips |
| User Satisfaction (post-trip) | >4.2 / 5 | >4.5 / 5 |
| Avg. Revenue per Trip | Rp 150.000 planning fee | Rp 250.000 blended |
| Itinerary Edit Sessions per Trip | Baseline | <3 major edits |

---

## 2. Core User Flows

### 2.1 Standard User Flow (End-to-End)

1. User mendaftar / login (Google OAuth atau Magic Link via Supabase)
2. User memilih mode: **Standard** (chat intake) atau **Surprise Me** (budget + tanggal saja)
3. AI Intake Agent mengumpulkan 7 parameter via percakapan chat
4. Sistem menampilkan 2–3 opsi itinerary ringkas (Trip Comparison) untuk dipilih user
5. Payment wall muncul: user membayar planning fee via QRIS/GoPay (Midtrans/Xendit)
6. Webhook Midtrans/Xendit memperbarui `payment_status` di Supabase → unlock itinerary generation
7. AI Itinerary Engine generate draft lengkap menggunakan vendor DB internal + web search (Tavily)
8. Draft langsung ditampilkan ke user (CS hanya menerima notifikasi, tidak memblokir tampilan)
9. User berinteraksi dengan itinerary: edit via AI Chat Editor, lihat budget tracker, download PDF
10. CS menerima notifikasi WhatsApp untuk flagged items (vendor swap, locked items)
11. User menyelesaikan perjalanan → Post-trip: tulis review + upload foto ke memory wall

### 2.2 Surprise Me Mode Flow

1. User memilih "Surprise Me" di homepage
2. AI hanya menanyakan: budget total (IDR), tanggal keberangkatan, durasi, jumlah pax
3. AI memilih destinasi Indonesia secara otomatis berdasarkan budget + musim + trending
4. Flow berlanjut ke payment → generation seperti normal

### 2.3 Group Trip Planning Flow

1. User membuat Trip baru dan memilih "Group Trip"
2. User memasukkan email anggota grup (maks 10 pax untuk MVP)
3. Sistem mengirim undangan via email (Supabase Auth invitation)
4. Setiap anggota dapat melihat itinerary yang sama (read-only kecuali trip owner)
5. Trip owner saja yang bisa trigger AI edits; anggota bisa comment / upvote aktivitas

---

## 3. Feature Specifications (MVP)

### 3.1 Authentication & User Onboarding

| Komponen | Detail |
|---|---|
| Auth Provider | Supabase Auth — Google OAuth + Email Magic Link |
| User Role | `user` (traveler), `admin` (CS/planner), `super_admin` |
| Onboarding | After first login: nama, nomor WhatsApp, preferensi perjalanan dasar (culture/adventure/healing/culinary) |
| Session | JWT via Supabase; persistent session di browser |
| Route Protection | Next.js `middleware.ts` — redirect ke `/login` jika unauthenticated |

---

### 3.2 AI Conversational Intake Agent

Agent ini adalah pintu masuk utama. Ia **HARUS** mengumpulkan 7 parameter sebelum lanjut ke payment. Tidak ada form statis — semua via percakapan natural dalam Bahasa Indonesia.

#### 7 Parameter Wajib (Perfect Itinerary Constraints)

| Parameter | Contoh Input User | Validasi AI |
|---|---|---|
| **WHO** — Pax & profil | "Kami berdua, pasangan muda" | Jumlah orang, hubungan, usia grup |
| **WHY/VIBE** — Tujuan trip | "Pengen healing, santai di pantai" | Kategori: healing/adventure/culture/culinary/mixed |
| **WHEN** — Tanggal & durasi | "Akhir April, 4 hari 3 malam" | Date range valid, cek konflik musim hujan |
| **WHERE** — Destinasi | "Belum tau, terserah AI" atau "Bali" | Validasi destinasi Indonesia; trigger Surprise Me jika kosong |
| **BUDGET** — Anggaran total | "Budget sekitar 3 juta per orang" | Parse IDR, set tier (budget/mid/premium) |
| **PACING** — Ritme perjalanan | "Santai aja, jangan terlalu padat" | slow/balanced/packed — pengaruhi density itinerary |
| **SPECIAL NEEDS** | "Ada yang vegetarian, takut ketinggian" | Dietary, accessibility, preferensi akomodasi |

#### Behavior Rules untuk Intake Agent

- Jika user tidak tahu destinasi → otomatis masuk mode Surprise Me, AI pilih berdasarkan vibe + budget
- Jika tanggal masuk musim hujan di destinasi pilihan → AI warn dan tawarkan alternatif tanggal
- Jika budget tidak realistis untuk destinasi → AI jelaskan gap dan tawarkan penyesuaian
- Setelah semua 7 parameter terkumpul → AI tampilkan summary konfirmasi sebelum ke payment
- User bisa akses tombol "Bicara ke CS" kapan saja selama intake untuk eskalasi ke manusia

---

### 3.3 Trip Comparison (Pre-Payment)

Setelah intake selesai dan sebelum payment, AI menyajikan 2–3 opsi itinerary ringkas untuk dipilih user.

| Elemen | Detail |
|---|---|
| Format tampilan | Card per opsi: nama trip, destinasi highlight, estimasi budget, vibe tag |
| Opsi yang dihasilkan | Misal: Opsi A (budget-focused), Opsi B (balanced), Opsi C (premium experience) |
| User action | Pilih satu opsi → lanjut ke payment |
| Data persistence | Pilihan tersimpan di `trip_preferences` di Supabase |

---

### 3.4 Payment Wall

| Komponen | Detail |
|---|---|
| Gateway | Midtrans (primary) atau Xendit (fallback) — keduanya support QRIS & GoPay |
| Produk | Flat planning fee (Rp 99.000–Rp 199.000, TBD berdasarkan tier trip) |
| Flow | Generate QRIS → User scan → Webhook Midtrans → Supabase update `trips.payment_status = 'paid'` → Trigger generation |
| Expiry | QRIS expire dalam 15 menit; bisa regenerate |
| Retry | Jika payment gagal, user kembali ke halaman payment dengan QRIS baru |
| Invoice | Auto-generate PDF invoice via Supabase Edge Function, kirim via email |

---

### 3.5 AI Itinerary Generation Engine

#### Data Sources (Priority Order)

1. **Internal Vendor DB (Supabase)** — vendor yang sudah diverifikasi dan dikurasi manual
2. **Indonesian Provider APIs** — jika vendor punya API endpoint (hotel aggregator, Traveloka API, dsb)
3. **Web Search via Tavily API** — untuk fill gaps, hidden gems, ulasan terkini

#### Output Structure per Itinerary Item

| Field | Keterangan |
|---|---|
| `day` | Hari ke-berapa (1, 2, 3, ...) |
| `time_slot` | morning / afternoon / evening / night |
| `activity_type` | accommodation / transport / dining / attraction / experience / rest |
| `vendor_id` | FK ke tabel vendors (null jika dari web search) |
| `title` | Nama aktivitas/tempat |
| `description` | Deskripsi singkat + tips |
| `est_cost_idr` | Estimasi biaya dalam IDR |
| `location_lat_lng` | Koordinat untuk peta |
| `status` | draft / booked_flexible / booked_locked / cancelled |
| `booking_url` | Link booking langsung jika tersedia |
| `source` | internal_db / web_search / provider_api |

---

### 3.6 Itinerary Viewer

| Fitur | Detail |
|---|---|
| Layout | Split view: kiri = itinerary timeline, kanan = AI Chat Editor |
| Timeline view | Card per hari dengan time slots; icon per activity_type; est. cost visible |
| Map integration | Mapbox atau Leaflet.js — pin per lokasi per hari; cluster otomatis |
| PDF Export | Server-side PDF generation via Puppeteer di Next.js API route; branded TravelYu! template |
| Shareable Link | Setiap trip punya shareable URL: `/trip/[public_id]`; read-only view untuk non-owner |
| Budget Tracker | Real-time tally: budget tersisa vs estimasi spend; breakdown per kategori (akomodasi, makan, transportasi, aktivitas) |
| Packing List | AI generate packing list berdasarkan destinasi, durasi, aktivitas, cuaca; user bisa centang item |
| Weather Warning | Integrasi OpenWeatherMap API — banner peringatan jika destinasi masuk musim hujan/ekstrem pada tanggal trip |

---

### 3.7 Context-Aware AI Chat Editor

#### Arsitektur

Chat editor menggunakan Vercel AI SDK (`useChat` hook) dengan streaming response. Setiap request menyertakan full itinerary state sebagai context. AI dipersenjatai dengan tool calls untuk aksi nyata terhadap database.

#### Tool Definitions

| Tool Name | Fungsi & Trigger |
|---|---|
| `update_itinerary_item` | Ubah detail item (waktu, deskripsi, tips) — hanya untuk status draft/booked_flexible |
| `swap_vendor` | Ganti hotel/aktivitas dengan alternatif — trigger `flag_for_cs_approval` jika item sudah booked |
| `search_alternatives` | Cari alternatif vendor via Tavily atau internal DB berdasarkan query user |
| `flag_for_cs_approval` | Tandai perubahan butuh approval CS; kirim notifikasi ke admin dashboard + WhatsApp CS |
| `contact_vendor_via_whatsapp` | Trigger WAHA API untuk kirim pesan otomatis ke vendor (cek ketersediaan, reschedule) |
| `add_itinerary_item` | Tambah item baru ke hari tertentu |
| `delete_itinerary_item` | Hapus item; jika locked → flag ke CS |
| `get_weather_info` | Ambil data cuaca destinasi untuk tanggal trip via OpenWeatherMap |
| `escalate_to_human_cs` | User request bicara ke CS manusia; buat CS session di admin dashboard |
| `generate_packing_list` | Generate packing list berbasis konteks trip saat ini |

#### Rules Engine

- Item status = `booked_locked` (< 24 jam sebelum aktivitas) → AI **DILARANG** direct DB update; wajib `flag_for_cs_approval`
- Vendor swap apapun yang sudah confirmed → wajib CS approval dulu sebelum update DB
- **Major change** = ganti destinasi utama, ubah tanggal, atau tukar hotel → selalu flag ke CS
- **Minor change** = ubah jam, tambah/hapus restoran, tambah catatan → AI langsung update tanpa CS
- Jika AI tidak yakin kategori perubahan → default ke `flag_for_cs_approval`

---

### 3.8 CS Live Chat Escalation

| Komponen | Detail |
|---|---|
| Trigger | User ketik "bicara ke CS" atau klik tombol escalation di chat; juga auto-trigger jika AI gagal resolve 3x |
| CS Interface | Admin dashboard — tab "Live Chat Sessions"; CS bisa ambil session dan reply |
| Handoff | AI menampilkan "CS sedang menghubungi Anda" + estimasi waktu tunggu |
| Resolusi | CS bisa mark session "resolved"; kontrol kembali ke AI |
| Notifikasi CS | WhatsApp via WAHA + in-app notifikasi admin |

---

### 3.9 Surprise Me Mode

- User hanya isi: budget, tanggal, durasi, jumlah pax
- AI Engine pilih destinasi berdasarkan: musim terbaik, trending destinations, budget fit, diversity dari trip sebelumnya (jika ada riwayat)
- Destinasi disembunyikan sampai itinerary fully generated (reveal animation di UI)
- User bisa "shuffle" destinasi 1x gratis; 2x+ dikenai fee tambahan (TBD)

---

### 3.10 Loyalty & Points System

| Komponen | Detail |
|---|---|
| **Earn** | 100 poin per trip completed; 50 poin per review; 25 poin per referral signup; 10 poin per photo upload |
| **Redeem** | 500 poin = diskon Rp 50.000 planning fee; 1000 poin = free planning fee |
| **Tiers** | Explorer (0–499), Adventurer (500–1999), Wanderer (2000+) |
| Perk Wanderer | Priority CS, akses early deals, itinerary template premium |
| DB | Tabel `user_points`: user_id, points_balance, lifetime_points, tier |

---

### 3.11 Post-Trip Features

#### Vendor Reviews & Ratings

- Setelah `trip_status = 'completed'`, user mendapat prompt untuk review setiap vendor di itinerary
- Rating: 1–5 bintang + komentar teks per vendor
- Review publik ditampilkan di halaman vendor (internal page)
- CS bisa flag/remove review yang tidak pantas

#### Photo Memory Wall

- User upload foto perjalanan ke trip memory wall
- Foto tersimpan di Supabase Storage; tampilan grid per trip
- User bisa share memory wall via shareable link (terpisah dari itinerary link)
- Batas upload MVP: 20 foto per trip

---

### 3.12 Notifications

| Event | Email | WhatsApp (WAHA) |
|---|---|---|
| Itinerary ready | Ya — link ke dashboard | Ya — pesan ringkas + link |
| CS approve perubahan | Ya | Ya |
| Payment berhasil | Ya + invoice PDF | Ya — konfirmasi singkat |
| Payment gagal/expired | Ya + link QRIS baru | Ya |
| Trip reminder (H-1) | Ya | Ya — reminder + packing list |
| Post-trip review prompt | Ya (H+1) | Tidak |
| Points earned | Tidak | Ya — gamifikasi singkat |

---

## 4. Admin Dashboard (CS Interface)

### 4.1 Dashboard Sections

| Section | Fungsi |
|---|---|
| Trip Queue | Semua trip aktif; filter by status (draft, paid, approved, active, completed) |
| Flagged Items | Daftar itinerary items yang butuh approval CS — sorted by urgency |
| Live Chat Sessions | Chat escalation dari user; CS ambil dan reply langsung |
| Vendor Management | CRUD vendor di Supabase: nama, tipe, WhatsApp number, API endpoint |
| User Management | Lihat user profile, trip history, points balance, role management |
| Analytics | Trip volume, revenue, avg satisfaction score, CS intervention rate |
| WhatsApp Center | Log semua WAHA messages sent/received; trigger manual message ke vendor/user |

### 4.2 CS Workflow untuk Flagged Items

1. CS menerima notifikasi WhatsApp: "Ada permintaan perubahan butuh approval"
2. CS buka Admin Dashboard → tab Flagged Items
3. CS review perubahan yang diminta user + current itinerary state
4. CS pilih: **Approve** (AI execute update), **Reject** (AI inform user dengan alasan), atau **Edit Manual**
5. Jika butuh konfirmasi vendor: CS klik "Hubungi Vendor" → WAHA kirim pesan otomatis ke WhatsApp vendor
6. Setelah vendor konfirmasi → CS approve → DB update → User notified

---

## 5. AI Architecture

### 5.1 Tech Stack AI

| Komponen | Teknologi |
|---|---|
| AI SDK | Vercel AI SDK (`ai` package) — `useChat`, `useUIState`, `streamText` |
| Model Router | OpenRouter — endpoint: `https://openrouter.ai/api/v1` |
| Primary Model | `stepfun/step-3.5-flash:free` (tool calling + long context) |
| Fallback Model | - (MVP single-model via OpenRouter) |
| Web Search | Tavily API — `search_indonesia_places` tool |
| Orchestration | Pure Vercel AI SDK tool calling — tidak menggunakan LangChain/LangGraph |
| Streaming | React Server Components + AI SDK streaming untuk real-time response |

### 5.2 Agent System Prompts (Outline)

#### Intake Agent System Prompt

```
Kamu adalah TravelYu AI, asisten perencanaan perjalanan pribadi yang friendly dan paham
destinasi Indonesia. Tugasmu adalah mengumpulkan 7 parameter dari user (who, why/vibe,
when, where, budget, pacing, special needs) melalui percakapan natural dalam Bahasa
Indonesia. Tanyakan satu hal dalam satu waktu — jangan overwhelming.

Jika user tidak tahu destinasi, tawarkan Surprise Me mode. Setelah semua 7 parameter
terkumpul, tampilkan summary dan minta konfirmasi sebelum lanjut ke payment.

JANGAN pernah menyebut harga atau rekomendasi spesifik sebelum parameter lengkap.
```

#### Itinerary Editor Agent System Prompt

```
Kamu adalah editor itinerary TravelYu. Kamu memiliki akses penuh ke itinerary user saat
ini dalam format JSON. Bantu user memodifikasi itinerary menggunakan tools yang tersedia.

ATURAN KRITIS:
1. Jangan update langsung item dengan status 'booked_locked' — gunakan flag_for_cs_approval.
2. Vendor swap APAPUN yang sudah confirmed harus melalui CS approval.
3. Selalu konfirmasi perubahan ke user sebelum execute tool.
4. Jika tidak yakin apakah perubahan major/minor, default ke flag_for_cs.

Konteks itinerary saat ini: [INJECTED_ITINERARY_JSON]
```

### 5.3 OpenRouter Configuration

```typescript
// lib/ai/openrouter.ts
import { createOpenAI } from '@ai-sdk/openai';

export const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const model = openrouter('stepfun/step-3.5-flash:free');
```

---

## 6. Database Schema (Supabase PostgreSQL)

### 6.1 Core Tables

#### `users` (extends Supabase `auth.users`)

| Column | Type & Notes |
|---|---|
| `id` | UUID — FK `auth.users` |
| `full_name` | TEXT |
| `whatsapp_number` | TEXT — untuk WAHA notifications |
| `travel_preferences` | JSONB — `{vibe: string[], budget_tier: string}` |
| `role` | ENUM(user, admin, super_admin) |
| `points_balance` | INTEGER DEFAULT 0 |
| `lifetime_points` | INTEGER DEFAULT 0 |
| `loyalty_tier` | ENUM(explorer, adventurer, wanderer) DEFAULT explorer |
| `created_at` | TIMESTAMPTZ DEFAULT now() |

#### `trips`

| Column | Type & Notes |
|---|---|
| `id` | UUID PRIMARY KEY |
| `user_id` | UUID FK users.id |
| `public_id` | TEXT UNIQUE — untuk shareable link |
| `status` | ENUM(intake, payment_pending, paid, generating, draft, approved, active, completed, cancelled) |
| `payment_status` | ENUM(pending, paid, failed, refunded) |
| `payment_ref` | TEXT — Midtrans/Xendit transaction ID |
| `planning_fee_idr` | INTEGER |
| `is_group_trip` | BOOLEAN DEFAULT false |
| `is_surprise_mode` | BOOLEAN DEFAULT false |
| `intake_data` | JSONB — semua 7 parameter dari AI intake |
| `selected_comparison_option` | INTEGER — opsi mana yang dipilih (1, 2, 3) |
| `total_est_cost_idr` | INTEGER |
| `created_at / updated_at` | TIMESTAMPTZ |

#### `itinerary_items`

| Column | Type & Notes |
|---|---|
| `id` | UUID PRIMARY KEY |
| `trip_id` | UUID FK trips.id |
| `day_number` | INTEGER |
| `time_slot` | ENUM(morning, afternoon, evening, night) |
| `sort_order` | INTEGER — urutan dalam time_slot |
| `activity_type` | ENUM(accommodation, transport, dining, attraction, experience, rest) |
| `vendor_id` | UUID FK vendors.id NULLABLE |
| `title` | TEXT |
| `description` | TEXT |
| `tips` | TEXT NULLABLE |
| `est_cost_idr` | INTEGER |
| `location_lat` | DECIMAL |
| `location_lng` | DECIMAL |
| `location_address` | TEXT |
| `status` | ENUM(draft, booked_flexible, booked_locked, cancelled, flagged) |
| `source` | ENUM(internal_db, web_search, provider_api, manual_cs) |
| `booking_url` | TEXT NULLABLE |
| `booking_ref` | TEXT NULLABLE |
| `flagged_reason` | TEXT NULLABLE |
| `flagged_at / resolved_at` | TIMESTAMPTZ NULLABLE |

#### `vendors`

| Column | Type & Notes |
|---|---|
| `id` | UUID PRIMARY KEY |
| `name` | TEXT |
| `type` | ENUM(hotel, villa, restaurant, attraction, transport, experience, guide) |
| `city` | TEXT — kota/daerah di Indonesia |
| `province` | TEXT |
| `whatsapp_number` | TEXT NULLABLE — untuk WAHA contact |
| `api_endpoint` | TEXT NULLABLE |
| `price_tier` | ENUM(budget, mid, premium) |
| `avg_rating` | DECIMAL(3,2) |
| `is_verified` | BOOLEAN DEFAULT false |
| `location_lat / location_lng` | DECIMAL |
| `tags` | TEXT[] — e.g. ['pantai', 'romantic', 'family-friendly'] |
| `created_at` | TIMESTAMPTZ |

#### Supporting Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `group_trip_members` | trip_id, user_id, role(owner/member), joined_at | Group trip participants |
| `cs_approval_queue` | trip_id, item_id, requested_change(JSONB), status, cs_id, reviewed_at | Flagged items needing CS review |
| `cs_chat_sessions` | trip_id, user_id, cs_id, status(open/resolved), messages(JSONB[]) | Live chat escalation log |
| `vendor_reviews` | vendor_id, user_id, trip_id, rating(1–5), comment, is_public | Post-trip vendor reviews |
| `trip_photos` | trip_id, user_id, storage_path, caption, uploaded_at | Memory wall photos |
| `user_points_log` | user_id, points_delta, event_type, reference_id, created_at | Points transaction log |
| `waha_message_log` | recipient_type(user/vendor), recipient_id, message, status, sent_at | WhatsApp message audit log |
| `comparison_options` | trip_id, option_number, summary(JSONB), is_selected | Pre-payment trip option cards |

### 6.2 Row Level Security (RLS) Policies

- `trips`: SELECT/UPDATE hanya untuk `trips.user_id = auth.uid()` ATAU `role = admin`
- `itinerary_items`: akses via `trips.user_id`; admin full access
- `vendor_reviews`: user hanya bisa INSERT/UPDATE review milik sendiri
- `trip_photos`: user hanya akses foto di trip yang mereka ikuti
- `cs_approval_queue`: admin-only SELECT/UPDATE
- `vendors`: SELECT public; INSERT/UPDATE/DELETE hanya super_admin

---

## 7. External API Integrations

| Service | Fungsi | Implementation |
|---|---|---|
| Midtrans | Payment QRIS + GoPay | Node.js SDK; webhook di `/api/payment/midtrans-webhook` |
| Supabase Storage | Photo memory wall uploads | `supabase.storage.from('trip-photos').upload()` |
| Tavily API | Web search untuk destinasi + vendor | Tool call: `search_indonesia_places(query)` |
| OpenRouter | AI model routing (Stepfun) | Vercel AI SDK `createOpenAI` dengan custom `baseURL` |
| WAHA (WhatsApp) | Notifikasi user + kontak vendor | REST API: `POST /api/sendText`; self-hosted Docker |
| OpenWeatherMap | Weather check per destinasi + tanggal | Tool call: `get_weather_info(city, date_range)` |
| Mapbox / Leaflet | Map display di itinerary viewer | Client-side React component; pins dari lat/lng DB |
| Resend | Email notifikasi + invoice | Supabase Edge Function trigger on DB event |
| Puppeteer | PDF export itinerary | Next.js API route: `/api/trip/[id]/export-pdf` |

---

## 8. App Route Structure (Next.js 16 App Router)

### 8.1 Public Routes

| Route | Halaman |
|---|---|
| `/` | Homepage — value prop, CTA, testimoni |
| `/login` | Auth page — Google OAuth + Magic Link |
| `/trip/[public_id]` | Shareable itinerary view (read-only, no auth required) |
| `/memory/[public_id]` | Shareable photo memory wall (read-only) |

### 8.2 Authenticated User Routes

| Route | Halaman |
|---|---|
| `/dashboard` | User dashboard — list trips, points balance, quick actions |
| `/trip/new` | Start trip — mode pilihan (Standard vs Surprise Me) |
| `/trip/new/intake` | AI Intake Agent chat interface |
| `/trip/new/compare` | Trip Comparison — 2–3 opsi pre-payment |
| `/trip/new/payment` | Payment wall — QRIS generation |
| `/trip/[id]` | Itinerary viewer + AI Chat Editor (split layout) |
| `/trip/[id]/packing` | Packing list view + checklist |
| `/trip/[id]/budget` | Budget tracker breakdown |
| `/trip/[id]/memory` | Photo memory wall upload + gallery |
| `/trip/[id]/review` | Post-trip vendor review form |
| `/profile` | User profile, preferences, points history |
| `/referral` | Referral program + loyalty tier dashboard |

### 8.3 Admin Routes

| Route | Halaman |
|---|---|
| `/admin` | Admin overview dashboard + KPI widgets |
| `/admin/trips` | Trip queue management + filter/search |
| `/admin/flagged` | Flagged items approval queue |
| `/admin/chat` | Live CS chat sessions |
| `/admin/vendors` | Vendor CRUD management |
| `/admin/users` | User management + role assignment |
| `/admin/whatsapp` | WAHA message center + log |
| `/admin/analytics` | Revenue, trip volume, satisfaction metrics |

### 8.4 API Routes

| Route | Fungsi |
|---|---|
| `POST /api/ai/intake` | Streaming AI intake chat endpoint (`streamText`) |
| `POST /api/ai/editor` | Streaming AI editor chat endpoint dengan tool calling |
| `POST /api/ai/generate-trip` | Trigger itinerary generation (dipanggil setelah payment confirmed) |
| `POST /api/ai/compare-options` | Generate 2–3 comparison options pre-payment |
| `POST /api/payment/create-qris` | Buat QRIS via Midtrans |
| `POST /api/payment/midtrans-webhook` | Midtrans payment callback handler |
| `GET /api/trip/[id]/export-pdf` | Generate dan return PDF itinerary |
| `POST /api/waha/send` | Internal proxy untuk WAHA message sending |
| `POST /api/waha/webhook` | Incoming WhatsApp message handler (dari vendor reply) |
| `POST /api/vendor/contact` | Trigger WAHA vendor contact via CS action |
| `GET /api/weather/[city]` | OpenWeatherMap proxy |

---

## 9. Key Component Architecture

| Component | Lokasi & Deskripsi |
|---|---|
| `<IntakeChat />` | `app/trip/new/intake/page.tsx` — Shadcn chat UI + `useChat` hook + progress indicator 7 params |
| `<ComparisonCards />` | `app/trip/new/compare/page.tsx` — 3 cards dengan vibe tag, budget, highlight destinasi |
| `<QRISPayment />` | `app/trip/new/payment/page.tsx` — QR display, countdown timer 15min, auto-polling status |
| `<ItineraryTimeline />` | `components/itinerary/Timeline.tsx` — accordion per day, card per item, status badge |
| `<ItineraryMap />` | `components/itinerary/Map.tsx` — Leaflet/Mapbox, cluster pins, popup per vendor |
| `<EditorChat />` | `components/itinerary/EditorChat.tsx` — floating chat, `useChat`, tool result renderer |
| `<BudgetTracker />` | `components/itinerary/BudgetTracker.tsx` — progress bar per kategori, total remaining |
| `<PackingList />` | `components/packing/PackingList.tsx` — checklist dengan kategori, AI generate + manual add |
| `<WeatherBanner />` | `components/weather/WeatherBanner.tsx` — conditional warning banner di itinerary header |
| `<MemoryWall />` | `components/memory/MemoryWall.tsx` — masonry grid, upload dropzone, Supabase Storage |
| `<PointsWidget />` | `components/loyalty/PointsWidget.tsx` — balance, tier badge, progress bar ke tier berikutnya |
| `<AdminFlagQueue />` | `app/admin/flagged/page.tsx` — server component, list flagged items + approve/reject actions |
| `<CSChatPanel />` | `app/admin/chat/page.tsx` — realtime chat via Supabase Realtime subscriptions |

---

## 10. Non-Functional Requirements

### 10.1 Performance

- Time to First Byte (TTFB): < 200ms untuk semua server-rendered pages
- AI Intake first response: < 2 detik (streaming dimulai)
- Itinerary generation completion: < 30 detik (tampilkan loading progress)
- PDF export generation: < 10 detik
- Mobile Lighthouse Score: > 80 (Performance, Accessibility, SEO)

### 10.2 Security

- Semua DB access via Supabase RLS — tidak ada direct admin bypass di frontend
- Payment webhook: validasi Midtrans signature di setiap callback sebelum DB update
- WAHA: hanya accessible dari server-side API routes, tidak dari client
- OpenRouter key: server-side only (`NEXT_PUBLIC_` tidak digunakan untuk AI key)
- User uploads: validasi tipe file + size limit di Supabase Storage policies
- Rate limiting: Upstash Redis ratelimit di `/api/ai/*` endpoints (10 req/min per user)

### 10.3 Environment Variables

| Variable | Deskripsi |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key (server-side only) |
| `TAVILY_API_KEY` | Tavily web search API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `MIDTRANS_SERVER_KEY` | Midtrans server key untuk payment creation |
| `MIDTRANS_CLIENT_KEY` | Midtrans client key (public, untuk Snap.js) |
| `WAHA_API_URL` | URL self-hosted WAHA instance |
| `WAHA_API_KEY` | WAHA authentication key |
| `OPENWEATHERMAP_API_KEY` | OpenWeatherMap API key |
| `RESEND_API_KEY` | Resend email service API key |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public token untuk peta |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis untuk rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |

---

## 11. Development Phases & Milestones

| Phase | Scope | Target Duration |
|---|---|---|
| **Phase 1: Foundation** | Next.js setup, Supabase schema + RLS, Auth (Google OAuth + Magic Link), User dashboard shell, Admin dashboard shell | 1 minggu |
| **Phase 2: AI Intake & Payment** | Intake Agent chat (7 params), Trip Comparison cards, Midtrans QRIS integration, Webhook payment handler, OpenRouter + Vercel AI SDK setup | 1.5 minggu |
| **Phase 3: Itinerary Core** | AI Generation Engine (Tavily + internal DB), Itinerary Timeline viewer, Mapbox integration, AI Chat Editor + tool calling, Budget Tracker | 2 minggu |
| **Phase 4: Notifications & CS** | WAHA integration (user + vendor), Email via Resend, Admin Flagged Queue, CS approval workflow, Live chat escalation | 1 minggu |
| **Phase 5: Extended Features** | PDF export, Weather integration, Packing list, Surprise Me mode, Group trip, Shareable links | 1.5 minggu |
| **Phase 6: Post-Trip & Loyalty** | Vendor reviews, Photo memory wall, Loyalty points system, Points redemption flow | 1 minggu |
| **Phase 7: Polish & Launch** | Mobile responsiveness audit, Performance optimization, Error handling, Rate limiting, Seeding vendor DB, UAT | 1 minggu |

> **Total Estimated MVP Duration:** ~10 minggu (solo developer) atau 6–7 minggu (2 developer)

---

*TravelYu! PRD v1.0 — Confidential & Internal Use Only*
*Stack: Next.js 16 · Tailwind CSS · Shadcn UI · Supabase · OpenRouter · WAHA · Midtrans*
