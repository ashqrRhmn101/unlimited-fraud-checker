import { apiGuard } from "@/lib/auth";
import { ImportError, parseText, parseUpload, type ParseResult } from "@/lib/importers";
import { importCustomers } from "@/lib/repo";
import type { UploadSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST /api/upload  (multipart/form-data)
 *   file  → Excel / CSV / PDF / TXT customer list
 *   text  → pasted rows or WhatsApp-style order messages
 */
export async function POST(request: Request) {
  const denied = await apiGuard();
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, message: "ফাইল পাওয়া যায়নি / No file received" }, { status: 400 });
  }

  const file = form.get("file");
  const text = form.get("text");

  let parsed: ParseResult;
  let fileName = "pasted-text.txt";
  let fileSize = 0;

  try {
    if (file && typeof file !== "string") {
      fileName = file.name || "upload";
      fileSize = file.size;
      if (file.size === 0) {
        return Response.json({ ok: false, message: "ফাইলটি খালি / The file is empty" }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return Response.json({ ok: false, message: "ফাইল সর্বোচ্চ 15 MB হতে পারে" }, { status: 413 });
      }
      parsed = await parseUpload(fileName, new Uint8Array(await file.arrayBuffer()));
    } else if (typeof text === "string" && text.trim()) {
      fileSize = Buffer.byteLength(text, "utf8");
      if (fileSize > MAX_BYTES) {
        return Response.json({ ok: false, message: "টেক্সট অনেক বড়" }, { status: 413 });
      }
      parsed = parseText(text);
    } else {
      return Response.json(
        { ok: false, message: "একটি ফাইল দিন অথবা টেক্সট পেস্ট করুন / Provide a file or text" },
        { status: 400 },
      );
    }
  } catch (error) {
    if (error instanceof ImportError) {
      return Response.json({ ok: false, message: error.message }, { status: 422 });
    }
    console.error("[upload] parse failed", error);
    return Response.json({ ok: false, message: "ফাইল প্রসেস করা যায়নি" }, { status: 500 });
  }

  if (parsed.customers.length === 0) {
    return Response.json(
      {
        ok: false,
        message:
          parsed.warnings[0] ??
          "ফাইলে কোনো বৈধ বাংলাদেশী মোবাইল নম্বর পাওয়া যায়নি। নম্বরগুলো 01XXXXXXXXX ফরম্যাটে আছে কিনা দেখুন।",
        rowsScanned: parsed.rowsScanned,
      },
      { status: 422 },
    );
  }

  try {
    const result = await importCustomers(parsed.customers, {
      fileName,
      fileType: parsed.fileType,
      fileSize,
      rowsScanned: parsed.rowsScanned,
      skipped: parsed.invalid,
    });

    const summary: UploadSummary = {
      fileName,
      fileType: parsed.fileType,
      rowsScanned: parsed.rowsScanned,
      found: parsed.customers.length,
      inserted: result.inserted,
      updated: result.updated,
      unchanged: result.unchanged,
      invalid: parsed.invalid,
      duplicates: parsed.duplicates,
      mapping: parsed.mapping,
      warnings: parsed.warnings,
    };

    return Response.json({
      ok: true,
      summary,
      preview: parsed.customers.slice(0, 10).map((customer) => ({
        phone: customer.phone,
        name: customer.name,
        address: customer.address,
        city: customer.city,
      })),
    });
  } catch (error) {
    console.error("[upload] import failed", error);
    return Response.json({ ok: false, message: "ডাটাবেজে সেভ করা যায়নি" }, { status: 500 });
  }
}
