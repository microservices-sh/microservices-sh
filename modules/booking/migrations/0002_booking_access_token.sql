-- Per-booking high-entropy access token (FIX C2). Gates anonymous guest access
-- to view/cancel a booking. Existing rows keep NULL — a NULL/empty token must
-- never satisfy verification.
ALTER TABLE bookings ADD COLUMN access_token TEXT;
