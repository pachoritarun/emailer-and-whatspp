import { NextResponse, NextRequest } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET() {
  const token = process.env.WHATSAPP_TOKEN;
  const businessId = process.env.WHATSAPP_BUSINESS_ID;

  let templates: { name: string; language: string; body: string; variableCount: number }[] = [];

  // 1. Fetch templates from local database (Always fetch)
  try {
    const pool = await getDbPool();
    const [rows] = await pool.query(
      `SELECT name, language, body, variable_count as variableCount FROM local_templates ORDER BY created_at DESC`
    ) as any[];
    if (rows && rows.length > 0) {
      templates = [...rows];
    }
  } catch (dbErr) {
    console.error("Failed to fetch local templates from DB:", dbErr);
  }

  // 2. Try to fetch templates from Meta Cloud API
  if (token && businessId && businessId !== "545945169133023") {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${businessId}/message_templates?fields=name,status,language,components&access_token=${token}&limit=100`,
        { next: { revalidate: 0 } }
      );
      const data = await res.json();
      if (data && data.data) {
        const metaTemplates = data.data
          .filter((t: any) => t.status === "APPROVED")
          .map((t: any) => {
            const bodyComp = t.components?.find((c: any) => c.type === "BODY");
            const bodyText = bodyComp?.text || "";
            const varMatches = bodyText.match(/\\{\\{\\d+\\}\\}/g) || [];
            return {
              name: t.name,
              language: t.language,
              body: bodyText,
              variableCount: varMatches.length,
            };
          });

        const localNames = new Set(templates.map((t) => t.name));
        for (const mt of metaTemplates) {
          if (!localNames.has(mt.name)) {
            templates.push(mt);
          }
        }
      }
    } catch (metaErr) {
      console.warn("Failed to fetch templates from Meta (falling back to local):", metaErr);
    }
  }

  return NextResponse.json({ success: true, templates });
}

export async function POST(req: NextRequest) {
  try {
    const { name, language, body, variableCount } = await req.json();
    if (!name) return NextResponse.json({ success: false, error: "Template name is required" }, { status: 400 });

    const pool = await getDbPool();
    await pool.query(
      `INSERT INTO local_templates (name, language, body, variable_count) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE language = VALUES(language), body = VALUES(body), variable_count = VALUES(variable_count)`,
      [name.trim(), language || "en_US", body || "", variableCount || 0]
    );

    return NextResponse.json({ success: true, message: "Template saved successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) return NextResponse.json({ success: false, error: "Missing template name" }, { status: 400 });

    const pool = await getDbPool();
    await pool.query(`DELETE FROM local_templates WHERE name = ?`, [name]);

    return NextResponse.json({ success: true, message: "Template deleted successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
