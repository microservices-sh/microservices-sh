import { z } from "zod";

const slug = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "must be a lowercase slug");

export const createOrganizationInputSchema = z.object({
  name: z.string().min(1).max(120),
  slug,
  ownerUserId: z.string().min(1)
});

export const updateOrganizationInputSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(120),
  slug
});

export const inviteMemberInputSchema = z.object({
  orgId: z.string().min(1),
  email: z.email(),
  roleId: z.string().min(1)
});

export const acceptInvitationInputSchema = z.object({
  token: z.string().min(1),
  userId: z.string().min(1)
});

export const updateMemberRoleInputSchema = z.object({
  orgId: z.string().min(1),
  userId: z.string().min(1),
  roleId: z.string().min(1)
});

export const createRoleInputSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(60),
  permissions: z.array(z.string().min(1)).default([])
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationInputSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleInputSchema>;
export type CreateRoleInput = z.infer<typeof createRoleInputSchema>;
