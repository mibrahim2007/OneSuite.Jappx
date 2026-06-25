import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  roleId: z.string().uuid("Select a role"),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Invalid invitation link."),
  fullName: z.string().min(1, "Name is required").max(100),
  password: z.string().min(1, "Password is required"),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
