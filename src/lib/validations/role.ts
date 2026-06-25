import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required").max(50, "Max 50 characters"),
  description: z.string().max(200, "Max 200 characters").optional(),
  permissionIds: z.array(z.string().uuid()),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = createRoleSchema.extend({
  roleId: z.string().uuid("Invalid role ID"),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
