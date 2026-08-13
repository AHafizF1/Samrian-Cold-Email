import { NextResponse } from "next/server";

import { getAuthProvider } from "@/server/auth";

export async function GET() {
  const session = await getAuthProvider().getSession();

  return NextResponse.json(session);
}
