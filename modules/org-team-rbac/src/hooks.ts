import type { InviteMemberInput } from "./schemas";
import type { Membership } from "./types";

// Customization seam: inspect/transform an invite (e.g. domain allowlist), or
// return null to block it. Default pass-through.
export async function beforeInvite(input: InviteMemberInput): Promise<InviteMemberInput | null> {
  return input;
}

// Customization seam: react to a membership change (join/role-change/removal),
// e.g. invalidate a cache, send a notification. Default no-op.
export async function onMembershipChanged(
  _change: { action: "joined" | "role_changed" | "removed"; membership: Membership }
): Promise<void> {
  return;
}
