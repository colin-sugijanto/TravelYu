-- Migration 016: RLS hardening for Travel Vault + credit tables (014/015).
-- All app access goes through service_role server-side (API routes, server
-- components); browser/realtime clients only subscribe to trips/cs tables.
-- Enabling RLS with NO policies = deny-by-default for anon/authenticated,
-- while service_role bypasses RLS entirely. Safe to apply.

alter table public.trip_bookings enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.ai_credit_ledger enable row level security;
alter table public.ai_usage_log enable row level security;
