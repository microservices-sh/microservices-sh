CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_confirmed_slot ON bookings(service_id, starts_at) WHERE status = 'confirmed';
