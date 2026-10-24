"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
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
  dbUser.mustChangePassword = false;
  await dbUser.save();

  await ActivityLog.create({ actor: user.id, action: "PASSWORD_RESET", meta: { event: "SELF_CHANGE" } });

  return { success: "Password updated." };
}

export async function updateAvatarAction(
  _prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState & { avatarUrl?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You're not authorized to perform this action." };

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) {
    return { error: "Please select an image file to upload." };
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Image file size must be less than 5MB." };
  }

  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
  if (!validTypes.includes(file.type)) {
    return { error: "Please upload a valid image file (JPG, PNG, WEBP, or GIF)." };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let avatarUrl = "";
  try {
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await fs.mkdir(uploadsDir, { recursive: true });
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `avatar-${user.id}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, buffer);
    avatarUrl = `/uploads/avatars/${fileName}`;
  } catch (fsErr) {
    console.warn("[profile] failed to write avatar to public/uploads/avatars, falling back to data URL:", fsErr);
    avatarUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  }

  await connectDB();
  const existingUser = await User.findById(user.id).select("avatarUrl").lean();
  if (existingUser?.avatarUrl && existingUser.avatarUrl.startsWith("/uploads/avatars/") && existingUser.avatarUrl !== avatarUrl) {
    try {
      const oldFilePath = path.join(process.cwd(), "public", existingUser.avatarUrl);
      await fs.unlink(oldFilePath).catch(() => {});
    } catch {}
  }

  await User.findByIdAndUpdate(user.id, { avatarUrl });

  await ActivityLog.create({
    actor: user.id,
    action: "CUSTOMER_UPDATED",
    meta: { event: "AVATAR_CHANGE" },
  });

  revalidatePath("/portal", "layout");
  revalidatePath("/portal/profile");

  return { success: "Profile picture updated successfully.", avatarUrl };
}

export async function removeAvatarAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You're not authorized to perform this action." };

  await connectDB();
  const existingUser = await User.findById(user.id).select("avatarUrl").lean();
  if (existingUser?.avatarUrl && existingUser.avatarUrl.startsWith("/uploads/avatars/")) {
    try {
      const filePath = path.join(process.cwd(), "public", existingUser.avatarUrl);
      await fs.unlink(filePath).catch(() => {});
    } catch {}
  }

  await User.findByIdAndUpdate(user.id, { avatarUrl: "" });

  await ActivityLog.create({
    actor: user.id,
    action: "CUSTOMER_UPDATED",
    meta: { event: "AVATAR_REMOVE" },
  });

  revalidatePath("/portal", "layout");
  revalidatePath("/portal/profile");

  return { success: "Profile picture removed." };
}
