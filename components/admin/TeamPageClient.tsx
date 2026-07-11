"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Mail, Ban, CheckCircle2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableContainer, Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { TeamFormModal } from "@/components/admin/TeamFormModal";
import {
  suspendTeamMemberAction,
  reactivateTeamMemberAction,
  resendTeamInviteAction,
} from "@/lib/actions/team";
import { formatDate } from "@/lib/utils/format";
import type { TeamMemberRow } from "@/lib/types/team";

const STATUS_LABEL: Record<TeamMemberRow["status"], string> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  INVITED: "Invited",
};
const STATUS_TONE: Record<TeamMemberRow["status"], "green" | "amber" | "red"> = {
  ACTIVE: "green",
  SUSPENDED: "red",
  INVITED: "amber",
};

export function TeamPageClient({
  members,
  currentUserId,
}: {
  members: TeamMemberRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<{ error?: string; success?: string } | undefined>) {
    setBusyId(id);
    const result = await fn();
    setBusyId(null);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(result?.success ?? "Done.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-bold text-text-primary">Team</p>
          <p className="text-sm">Manage admin and sub-admin accounts.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="size-4" />
          Invite Team Member
        </Button>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No team members yet"
          action={
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" />
              Invite Team Member
            </Button>
          }
        />
      ) : (
        <TableContainer>
          <Table>
            <THead>
              <TR>
                <TH>Member</TH>
                <TH>Email</TH>
                <TH>Phone</TH>
                <TH>Role</TH>
                <TH>Joined</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {members.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name} size="sm" />
                      <span className="font-medium text-text-primary">
                        {m.name}
                        {m.id === currentUserId && <span className="ml-1.5 text-xs text-text-muted">(you)</span>}
                      </span>
                    </div>
                  </TD>
                  <TD className="text-text-secondary">{m.email}</TD>
                  <TD className="text-text-secondary">{m.phone || "--"}</TD>
                  <TD>
                    <Badge tone={m.role === "SUPER_ADMIN" ? "blue" : "neutral"}>
                      {m.role === "SUPER_ADMIN" ? "Super Admin" : "Sub Admin"}
                    </Badge>
                  </TD>
                  <TD className="text-text-secondary">{formatDate(m.createdAt)}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      {m.status === "INVITED" && (
                        <button
                          onClick={() => run(m.id, () => resendTeamInviteAction(m.id))}
                          disabled={busyId === m.id}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-blue disabled:opacity-50"
                          aria-label="Resend invite"
                        >
                          <Mail className="size-4" />
                        </button>
                      )}
                      {m.id !== currentUserId &&
                        (m.status === "SUSPENDED" ? (
                          <button
                            onClick={() => run(m.id, () => reactivateTeamMemberAction(m.id))}
                            disabled={busyId === m.id}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised hover:text-accent-green disabled:opacity-50"
                            aria-label="Reactivate"
                          >
                            <CheckCircle2 className="size-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => run(m.id, () => suspendTeamMemberAction(m.id))}
                            disabled={busyId === m.id}
                            className="rounded-lg p-1.5 text-text-muted hover:bg-red/10 hover:text-red disabled:opacity-50"
                            aria-label="Suspend"
                          >
                            <Ban className="size-4" />
                          </button>
                        ))}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      )}

      {modalOpen && (
        <TeamFormModal
          onClose={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
