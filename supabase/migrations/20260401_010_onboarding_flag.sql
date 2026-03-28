-- Migration 010: Add onboarding flag to users table
-- This column tracks whether a user has completed the first-time onboarding modal
-- (collecting full_name, whatsapp_number, travel_preferences).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Users who already have a whatsapp_number are considered onboarded
-- (backfill to avoid re-showing modal to existing users)
UPDATE public.users
  SET onboarding_completed = true
  WHERE whatsapp_number IS NOT NULL
    AND whatsapp_number != '';
