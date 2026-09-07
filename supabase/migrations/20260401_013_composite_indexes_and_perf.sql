-- Migration 013: Composite indexes for high-throughput queries and real-time dashboard performance

-- Index for trips dashboard: filter by user and status ordered by created_at desc
CREATE INDEX IF NOT EXISTS idx_trips_user_status_created
  ON trips (user_id, status, created_at DESC);

-- Index for itinerary day timeline lookup
CREATE INDEX IF NOT EXISTS idx_itinerary_items_trip_day_sort
  ON itinerary_items (trip_id, day_number, sort_order ASC);

-- Index for trip memories photo gallery (uses uploaded_at — trip_photos has no created_at)
CREATE INDEX IF NOT EXISTS idx_trip_photos_trip_created
  ON trip_photos (trip_id, uploaded_at DESC);

-- Index for CS approval queue filtering by trip and status
CREATE INDEX IF NOT EXISTS idx_cs_approval_queue_trip_status
  ON cs_approval_queue (trip_id, status);

-- Index for CS chat sessions by trip and status
CREATE INDEX IF NOT EXISTS idx_cs_chat_sessions_trip_status
  ON cs_chat_sessions (trip_id, status);

-- Index for outgoing WAHA message dispatch worker
CREATE INDEX IF NOT EXISTS idx_waha_message_log_status_created
  ON waha_message_log (status, created_at ASC);
