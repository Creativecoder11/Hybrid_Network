export type TeamMemberRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "SUPER_ADMIN" | "SUB_ADMIN";
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  createdAt: string;
};
