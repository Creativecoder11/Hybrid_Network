"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/connect";
import { ActivityLog } from "@/models/ActivityLog";
import { CustomerAccount } from "@/models/CustomerAccount";
import { User } from "@/models/User";
import { listVessels } from "@/lib/starlink/vessels";
import { listServiceLines, listTenantUserTerminals } from "@/lib/starlink/inventory";
import { StarlinkApiError, friendlyStarlinkErrorMessage } from "@/lib/starlink/client";
import { createTerminal, addTerminalToServiceLine, type SlashWriteContext } from "@/lib/starlink/passthrough";
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

const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{6,64}$/;

/**
 * Adds a user terminal to an existing Starlink service line (SLASH WRITE).
 * The account number, the terminal's identifiers and whether it is already
 * on the Starlink account all come from the SLASH API, not from the form: a
 * terminal the account doesn't know yet is registered on it first. Each WRITE
 * is audited and emailed to Station Satcom by the passthrough layer.
 */
export async function addTerminalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAuthorizedUser(["SUPER_ADMIN"]);
  if (!admin) return { error: "Only a Super Admin can add terminals." };

  const serviceLineNumber = String(formData.get("serviceLineNumber") ?? "").trim();
  const enteredId = String(formData.get("deviceId") ?? "").trim();
  if (!serviceLineNumber) return { error: "Choose a service line." };
  if (!DEVICE_ID_PATTERN.test(enteredId)) return { error: "Enter a valid device ID (letters, numbers and dashes only)." };

  let line, known, vessel;
  try {
    const [lines, terminals, vessels] = await Promise.all([listServiceLines(), listTenantUserTerminals(), listVessels()]);
    line = lines.find((l) => l.serviceLineNumber === serviceLineNumber);
    known = terminals.find((t) =>
      [t.userTerminalId, t.kitSerialNumber, t.dishSerialNumber].some((v) => v && v.toLowerCase() === enteredId.toLowerCase())
    );
    vessel = vessels.find((v) => v.serviceLineNumber === serviceLineNumber);
  } catch (err) {
    return { error: friendlyStarlinkErrorMessage(err) };
  }
  if (!line) return { error: "That service line was not found on the Starlink account." };
  if (!line.accountNumber) return { error: "Starlink did not report an account number for that service line." };
  if (known?.serviceLineNumber) {
    return {
      error:
        known.serviceLineNumber === serviceLineNumber
          ? "That terminal is already on this service line."
          : `That terminal is already on service line ${known.serviceLineNumber}. Remove it from there first.`,
    };
  }

  const deviceId = known?.userTerminalId ?? enteredId;
  const accountNumber = line.accountNumber;

  await connectDB();
  const account = vessel
    ? await CustomerAccount.findOne({ starlinkVesselIds: vessel.vesselId }).select("accountNumber customer").lean()
    : null;
  const owner = account ? await User.findById(account.customer).select("name company").lean() : null;

  const ctx: Omit<SlashWriteContext, "operation"> = {
    initiatedBy: { id: admin.id, name: admin.name, email: admin.email },
    customerId: account?.customer.toString() ?? null,
    customerName: owner ? owner.company || owner.name : null,
    accountId: account?._id.toString() ?? null,
    accountNumber: account?.accountNumber ?? null,
    slashAccountNumber: accountNumber,
    serviceLineNumber,
    deviceId,
    kitSerialNumber: known?.kitSerialNumber || null,
    product: line.productReferenceId || null,
  };
  const describe = (err: unknown) =>
    err instanceof StarlinkApiError ? friendlyStarlinkErrorMessage(err) : "The terminal provider did not accept the request.";

  // Not in the account's terminal list yet: register it before attaching.
  if (!known) {
    try {
      await createTerminal({ accountNumber, deviceId }, { ...ctx, operation: "Register user terminal on Starlink account" });
    } catch (err) {
      return { error: `Couldn't register the terminal on the Starlink account. ${describe(err)}` };
    }
  }

  try {
    await addTerminalToServiceLine(
      { accountNumber, serviceLineNumber, deviceId },
      { ...ctx, operation: "Add user terminal to service line" }
    );
  } catch (err) {
    const inactiveHint = line.active ? "" : " This service line is inactive in Starlink, which is the likely reason.";
    return {
      error: known
        ? `Couldn't add the terminal to the service line. ${describe(err)}${inactiveHint}`
        : `The terminal was registered on the Starlink account, but couldn't be added to the service line. ${describe(err)}${inactiveHint}`,
    };
  }

  revalidatePath("/admin/terminals");
  return { success: "Terminal added. Station Satcom has been notified. It can take a minute to appear in the list." };
}
