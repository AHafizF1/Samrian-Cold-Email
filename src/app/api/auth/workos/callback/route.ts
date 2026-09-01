import { handleAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";

const callback = handleAuth({ returnPathname: "/dashboard" });

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  if (!url.searchParams.has("code") || !url.searchParams.has("state")) {
    return NextResponse.json({ error: "Invalid authentication callback" }, { status: 400 });
  }

  return callback(request);
}
