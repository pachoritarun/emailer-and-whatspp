import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.WHATSAPP_TOKEN;
  const businessId = process.env.WHATSAPP_BUSINESS_ID;

  if (!token) {
    return NextResponse.json({ success: false, error: "WhatsApp credentials not configured in .env.local" }, { status: 500 });
  }
  if (!businessId) {
    return NextResponse.json({
      success: false,
      error: "WHATSAPP_BUSINESS_ID not set in .env.local",
      hint: "Find it in Meta Business Manager > Business Settings > WhatsApp Accounts."
    }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${businessId}/message_templates?fields=name,status,language,components&access_token=${token}&limit=100`
    );
    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ success: false, error: data.error.message }, { status: 400 });
    }
    const templates = (data.data || [])
      .filter((t: any) => t.status === "APPROVED")
      .map((t: any) => {
        const bodyComp = t.components?.find((c: any) => c.type === "BODY");
        const bodyText = bodyComp?.text || "";
        const varMatches = bodyText.match(/\{\{\d+\}\}/g) || [];
        return { name: t.name, language: t.language, body: bodyText, variableCount: varMatches.length };
      });
    return NextResponse.json({ success: true, templates });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Template fetch error:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
