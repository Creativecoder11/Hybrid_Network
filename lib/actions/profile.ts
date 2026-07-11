"use server";

import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/dal";
import { changePasswordSchema } from "@/lib/validations/profile";
import type { ActionState } from "@/lib/actions/customers";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function changePasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You're not authorized to perform this action." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: str(formData, "currentPassword"),
    newPassword: str(formData, "newPassword"),
    confirmPassword: str(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const dbUser = await User.findById(user.id).select("+passwordHash");
  if (!dbUser?.passwordHash) return { error: "Could not verify your current password." };

  const valid = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash);
  if (!valid) return { error: "Your current password is incorrect." };

  dbUser.passwordHash = await hashPassword(parsed.data.newPassword);
  await dbUser.save();

  await ActivityLog.create({ actor: user.id, action: "PASSWORD_RESET", meta: { event: "SELF_CHANGE" } });

  return { success: "Password updated." };
}
