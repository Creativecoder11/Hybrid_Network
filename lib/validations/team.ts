import { z } from "zod";

export const createTeamMemberSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email"),
  phone: z.string().optional().default(""),
  role: z.enum(["SUPER_ADMIN", "SUB_ADMIN"]),
});
export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;
