"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { ActivityLog } from "@/models/ActivityLog";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { sendTerminalCommand, commandLabel } from "@/lib/terminals/service";
import { REMOTE_COMMANDS, type RemoteCommandType } from "@/lib/terminals/types";
import type { ActionState } from "@/lib/actions/customers";

export async function sendTerminalCommandAction(
  terminalId: string,
  command: RemoteCommandType
): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) return { error: "You're not authorized to perform this action." };
  if (!REMOTE_COMMANDS.includes(command) || typeof terminalId !== "string" || !terminalId) {
    return { error: "Invalid command." };
  }

  await connectDB();

  try {
    const updated = await sendTerminalCommand(terminalId, command, { id: admin.id, name: admin.name, email: admin.email });

    await ActivityLog.create({
      actor: admin.id,
      targetCustomer: updated.activation.assignedCustomerId,
      targetAccount: updated.activation.assignedAccountId,
      action: "TERMINAL_COMMAND",
      meta: { terminalId, command, label: commandLabel(command), dataSource: updated.dataSource },
    });

    revalidatePath("/admin/terminals");
    revalidatePath(`/admin/terminals/${terminalId}`);
    return {
      success:
        updated.dataSource === "SLASH"
          ? `${commandLabel(command)} accepted by the terminal provider. Station Satcom has been notified.`
          : `${commandLabel(command)} simulated (demo terminal).`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Command failed." };
  }
}
