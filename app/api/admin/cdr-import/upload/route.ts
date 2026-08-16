import { NextResponse, type NextRequest } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { previewRetailCdrImport, processRetailCdrImport } from "@/lib/cdr/retailCdrProcess";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const mode = String(formData.get("mode") ?? "preview") === "commit" ? "commit" : "preview";
  const identifierColumn = String(formData.get("identifierColumn") ?? "").trim() || undefined;
  const wholesaleColumn = String(formData.get("wholesaleColumn") ?? "").trim() || undefined;

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No file was uploaded." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: "File is too large. Maximum size is 20 MB." },
      { status: 400 }
    );
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ success: false, error: "Please upload a .csv file." }, { status: 400 });
  }

  const csvText = await file.text();
  const columnOverride = { identifierColumn, wholesaleColumn };

  try {
    if (mode === "preview") {
      const preview = await previewRetailCdrImport({ csvText, columnOverride });
      return NextResponse.json({ success: true, mode, data: preview });
    }

    const result = await processRetailCdrImport({
      csvText,
      fileName: file.name,
      uploadedBy: admin.id,
      columnOverride,
    });
    return NextResponse.json({ success: result.status === "COMPLETED", mode, data: result });
  } catch (err) {
    console.error("CDR retail import failed", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong while processing the file." },
      { status: 500 }
    );
  }
}
