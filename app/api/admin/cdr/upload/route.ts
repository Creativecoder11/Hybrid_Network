import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { processCdrUpload } from "@/lib/cdr/process";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
  const admin = await getAuthorizedUser(["SUPER_ADMIN", "SUB_ADMIN"]);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const uploadModeRaw = String(formData.get("uploadMode") ?? "REPLACE");
  const uploadMode = uploadModeRaw === "ACCUMULATE" ? "ACCUMULATE" : "REPLACE";

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No file was uploaded." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: "File is too large. Maximum size is 20 MB." },
      { status: 400 }
    );
  }

  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
  if (!isCsv && !isXlsx) {
    return NextResponse.json(
      { success: false, error: "Unsupported file type. Please upload a .xlsx or .csv file." },
      { status: 400 }
    );
  }

  let buffer: Buffer;
  if (isCsv) {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
    const worksheet = XLSX.utils.aoa_to_sheet(parsed.data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet");
    buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  } else {
    buffer = Buffer.from(await file.arrayBuffer());
  }

  try {
    const result = await processCdrUpload({
      buffer,
      fileName: file.name,
      uploadMode,
      uploadedBy: admin.id,
    });

    return NextResponse.json({ success: result.status === "COMPLETED", data: result });
  } catch (err) {
    console.error("CDR upload failed", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong while processing the file." },
      { status: 500 }
    );
  }
}
