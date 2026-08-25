import { NextResponse, NextRequest } from "next/server";
import { getDbPool } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

function sanitizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) cleaned = "91" + cleaned;
  return cleaned;
}

function maskPhone(phone: string): string {
  const c = String(phone || "").replace(/\D/g, "");
  if (c.length < 5) return "****";
  return c.slice(0, 2) + "******" + c.slice(-3);
}

export async function POST(req: NextRequest) {
  try {
    const { recipients, templateName, templateLang, templateVarFields, role } = await req.json();

    if (!recipients || recipients.length === 0)
      return NextResponse.json({ success: false, error: "No recipients provided" }, { status: 400 });
    if (!templateName)
      return NextResponse.json({ success: false, error: "Template name is required" }, { status: 400 });

    const pool = await getDbPool();
    const broadcastId = uuidv4();

    const values = recipients.map((r: any) => {
      const phone = sanitizePhone(String(r.phone || ""));
      const vars = (templateVarFields || []).map((field: string) => {
        if (field === "{{name}}") return r.name || "Recipient";
        if (field === "{{phone}}") return maskPhone(r.phone);
        return field;
      });
      return [broadcastId, r.name || "Recipient", phone, role || "General",
              templateName, templateLang || "en_US", JSON.stringify(vars)];
    });

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(",");
    const flatValues = values.flat();
    await pool.query(
      `INSERT INTO broadcast_jobs (broadcast_id, recipient_name, phone, role, template_name, template_lang, template_vars) VALUES ${placeholders}`,
      flatValues
    );

    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/broadcast/worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ broadcastId }),
    }).catch(() => {});

    return NextResponse.json({ success: true, broadcastId, queued: recipients.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Queue error:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
