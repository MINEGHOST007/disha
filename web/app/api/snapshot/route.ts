import { NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/lib/disha/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getDashboardSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
