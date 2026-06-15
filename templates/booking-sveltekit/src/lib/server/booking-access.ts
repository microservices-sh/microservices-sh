// Access control for the public booking confirmation page (FIX C2).
//
// Bookings are made by ANONYMOUS guests; the only secret tying a guest to their
// booking is the per-booking `accessToken` (256-bit, generated at create time).
// A booking id is NOT a sufficient secret (it is only ~64-bit and guessable), so
// reading or cancelling a booking requires either an admin session or a correct
// access token compared in constant time.

// Constant-time string comparison — avoids leaking the token via timing.
// Mirrors identity's constantTimeEqual; kept local to avoid cross-package import.
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// True iff the caller may view/cancel this booking: an admin session, OR a
// non-empty access token that matches the booking's token in constant time.
// A NULL/empty stored token (legacy rows) never grants access.
export function canAccessBooking(
  user: { isAdmin?: boolean } | null | undefined,
  bookingAccessToken: string,
  presentedToken: string
): boolean {
  if (user?.isAdmin === true) return true;
  if (!bookingAccessToken) return false;
  return constantTimeEqual(presentedToken, bookingAccessToken);
}
