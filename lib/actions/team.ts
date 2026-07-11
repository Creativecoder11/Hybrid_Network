"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { issueInvite } from "@/lib/auth/invite";
import { createTeamMemberSchema } from "@/lib/validations/team";
import type { ActionState } from "@/lib/actions/customers";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createTeamMemberAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can manage team members." };

  const parsed = createTeamMemberSchema.safeParse({
    name: str(formData, "name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    role: str(formData, "role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  await connectDB();
  const existing = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (existing) return { error: "A user with this email already exists." };

  const member = await User.create({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone,
    role: parsed.data.role,
    status: "INVITED",
    createdBy: admin.id,
  });

  await ActivityLog.create({
    actor: admin.id,
    action: "TEAM_MEMBER_CREATED",
    meta: { memberId: member._id.toString(), email: member.email, role: member.role },
  });

  try {
    await issueInvite(member, { isTeamInvite: true });
  } catch (err) {
    console.error("Failed to send team invite email", err);
  }

  revalidatePath("/admin/team");
  return { success: `Invitation sent to ${parsed.data.email}.` };
}

export async function suspendTeamMemberAction(memberId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can manage team members." };
  if (memberId === admin.id) return { error: "You can't suspend your own account." };

  await connectDB();
  const member = await User.findOne({ _id: memberId, role: { $in: ["SUPER_ADMIN", "SUB_ADMIN"] } });
  if (!member) return { error: "Team member not found." };

  member.status = "SUSPENDED";
  await member.save();

  await ActivityLog.create({ actor: admin.id, action: "TEAM_MEMBER_SUSPENDED", meta: { memberId } });

  revalidatePath("/admin/team");
  return { success: "Team member suspended." };
}

export async function reactivateTeamMemberAction(memberId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can manage team members." };

  await connectDB();
  const member = await User.findOne({ _id: memberId, role: { $in: ["SUPER_ADMIN", "SUB_ADMIN"] } });
  if (!member) return { error: "Team member not found." };

  member.status = "ACTIVE";
  await member.save();

  await ActivityLog.create({ actor: admin.id, action: "TEAM_MEMBER_SUSPENDED", meta: { memberId, reactivated: true } });

  revalidatePath("/admin/team");
  return { success: "Team member reactivated." };
}

export async function resendTeamInviteAction(memberId: string): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can manage team members." };

  await connectDB();
  const member = await User.findOne({ _id: memberId, role: { $in: ["SUPER_ADMIN", "SUB_ADMIN"] } });
  if (!member) return { error: "Team member not found." };
  if (member.status === "ACTIVE") return { error: "This member has already activated their account." };

  await issueInvite(member, { isTeamInvite: true });
  await ActivityLog.create({ actor: admin.id, action: "INVITE_RESENT", meta: { memberId } });

  revalidatePath("/admin/team");
  return { success: `Invitation resent to ${member.email}.` };
}
