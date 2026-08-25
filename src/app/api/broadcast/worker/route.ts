import { NextResponse, NextRequest } from "next/server";
import { getDbPool } from "@/lib/db";

const BATCH = 5;
const DELAY_MS = 500;

function sanitizePhone(phone: string): string {
  let cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length === 10) cleaned = "91" + cleaned;
  return cleaned;
}

async function sendTemplateMessage(phone: string, templateName: string, lang: string, vars: string[]) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) throw new Error("WhatsApp credentials not set");

  const components: any[] = [];
  if (vars && vars.length > 0) {
    components.push({
      type: "body",
      parameters: vars.map((v: string) => ({ type: "text", text: String(v) })),
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: sanitizePhone(phone),
    type: "template",
    template: {
      name: templateName,
      language: { code: lang || "en_US" },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

export async function POST(req: NextRequest) {
  const { broadcastId } = await req.json();
  if (!broadcastId) return NextResponse.json({ error: "No broadcastId" }, { status: 400 });

  const pool = await getDbPool();

  (async () => {
    try {
      while (true) {
        const [rows] = await pool.query(
          `SELECT id, recipient_name, phone, template_name, template_lang, template_vars
           FROM broadcast_jobs
           WHERE broadcast_id = ? AND status = 'pending'
           LIMIT ?`,
          [broadcastId, BATCH]
        ) as any[];
        if (!rows || rows.length === 0) break;

        for (const job of rows) {
          try {
            const vars: string[] = JSON.parse(job.template_vars || "[]");
            await sendTemplateMessage(job.phone, job.template_name, job.template_lang, vars);
            await pool.query(
              `UPDATE broadcast_jobs SET status='sent', processed_at=NOW() WHERE id=?`,
              [job.id]
            );
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error";
            await pool.query(
              `UPDATE broadcast_jobs SET status='failed', error_msg=?, processed_at=NOW() WHERE id=?`,
              [msg, job.id]
            );
          }
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      }
      console.log(`Broadcast ${broadcastId} completed.`);
    } catch (err) {
      console.error("Worker error:", err);
    }
  })();

  return NextResponse.json({ success: true, message: "Worker started", broadcastId });
}
