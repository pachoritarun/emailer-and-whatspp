import { NextResponse, NextRequest } from "next/server";
import { getDbPool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const broadcastId = searchParams.get("id");
  if (!broadcastId) return NextResponse.json({ error: "Missing broadcast id" }, { status: 400 });

  try {
    const pool = await getDbPool();
    const [rows] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(status = 'sent') as sent,
        SUM(status = 'failed') as failed,
        SUM(status = 'pending') as pending
       FROM broadcast_jobs WHERE broadcast_id = ?`,
      [broadcastId]
    ) as any[];
    return NextResponse.json({ success: true, ...rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
