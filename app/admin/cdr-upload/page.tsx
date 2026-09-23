import { redirect } from "next/navigation";

export default function CdrUploadPage() {
  redirect("/admin/billing/cdr-import");
}
