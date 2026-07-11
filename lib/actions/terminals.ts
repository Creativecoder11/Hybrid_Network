"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { sendTerminalCommand, commandLabel } from "@/lib/terminals/service";
import type { RemoteCommandType } from "@/lib/terminals/types";
import type { ActionState } from "@/lib/actions/customers";

export async function sendTerminalCommandAction(
  terminalId: string,
  command: RemoteCommandType
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };

  await connectDB();

  try {
    const updated = await sendTerminalCommand(terminalId, command, admin.id);

    await ActivityLog.create({
      actor: admin.id,
      targetCustomer: updated.activation.assignedCustomerId,
      action: "TERMINAL_COMMAND",
      meta: { terminalId, command, label: commandLabel(command) },
    });

    revalidatePath("/admin/terminals");
    revalidatePath(`/admin/terminals/${terminalId}`);
    return { success: `${commandLabel(command)} sent successfully.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Command failed." };
  }
}
