import { NextResponse } from "next/server";

import { buildHealth } from "@/server/health";

export async function GET() {
  const health = await buildHealth();
  return NextResponse.json(health, { status: health.status === "ok" ? 200 : 503 });
}
