-- Migration 011: Add explicit trip dates and enable realtime streaming

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_start_date date,
  ADD COLUMN IF NOT EXISTS trip_end_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'itinerary_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.itinerary_items;
  END IF;
END $$;
