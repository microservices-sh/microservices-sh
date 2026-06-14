import { z } from "zod";

export const configSchema = z.object({
  // How long an invitation token is valid.
  invitationTtlMs: z.number().int().positive().default(604_800_000), // 7 days
  // Default role names + permissions seeded into every new org.
  ownerRoleName: z.string().default("owner"),
  memberRoleName: z.string().default("member")
});

export const defaultConfig = {
  invitationTtlMs: 604_800_000,
  ownerRoleName: "owner",
  memberRoleName: "member"
} satisfies z.infer<typeof configSchema>;

// Default roles seeded per organization at creation. "owner" holds the "*"
// wildcard; downgrading/removing the last owner is refused by the use cases.
export const DEFAULT_ROLES: ReadonlyArray<{ name: string; permissions: string[] }> = [
  { name: "owner", permissions: ["*"] },
  { name: "admin", permissions: ["org.read", "org.manage", "member.manage"] },
  { name: "member", permissions: ["org.read"] }
];
