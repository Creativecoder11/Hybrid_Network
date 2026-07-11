import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth/dal";
import { TeamPageClient } from "@/components/admin/TeamPageClient";
import type { TeamMemberRow } from "@/lib/types/team";

export const metadata: Metadata = {
  title: "Team | Hybrid Networks Admin",
};

export default async function TeamPage() {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "SUPER_ADMIN") redirect("/admin");

  await connectDB();
  const members = await User.find({ role: { $in: ["SUPER_ADMIN", "SUB_ADMIN"] } })
    .sort({ createdAt: -1 })
    .lean();

  const rows: TeamMemberRow[] = members.map((m) => ({
    id: m._id.toString(),
    name: m.name,
    email: m.email,
    phone: m.phone ?? "",
    role: m.role as "SUPER_ADMIN" | "SUB_ADMIN",
    status: m.status,
    createdAt: (m.createdAt as Date | undefined)?.toISOString() ?? "",
  }));

  return <TeamPageClient members={rows} currentUserId={currentUser.id} />;
}
