import { NextResponse } from "next/server";
import { unsubscribeContact } from "@/server/modules/unsubscribe";
import { errorReporter } from "@/server/observability/runtime";
import { BodyError, boundRequest } from "@/server/http/body";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId");
  const campaignId = searchParams.get("c");
  const token = searchParams.get("t");
  if (!contactId || !campaignId || !token) {
    return NextResponse.json(
      { success: false, message: "Missing required parameters." },
      { status: 400 }
    );
  }

  const action = `/api/unsubscribe?${new URLSearchParams({
    contactId,
    c: campaignId,
    t: token,
  })}`;
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Confirm unsubscribe</title><body><main><h1>Confirm unsubscribe</h1><p>Stop future campaign emails to this address?</p><form method="post" action="${escapeHtml(action)}"><button type="submit">Unsubscribe</button></form></main></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}

export async function POST(request: Request) {
  let body: string;
  try {
    request = await boundRequest(request, 1024, "text");
    body = await request.text();
  } catch (error) {
    if (error instanceof BodyError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
  if (body && !body.includes("List-Unsubscribe=One-Click")) {
    return NextResponse.json(
      { success: false, message: "Invalid one-click unsubscribe request." },
      { status: 400 }
    );
  }
  return handleUnsubscribe(request);
}

async function handleUnsubscribe(request: Request) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId");
  const campaignId = searchParams.get("c");
  const token = searchParams.get("t");

  if (!contactId || !campaignId || !token) {
    return NextResponse.json(
      { success: false, message: "Missing required parameters." },
      { status: 400 }
    );
  }

  try {
    const result = await unsubscribeContact({ contactId, campaignId, token });

    if (result.success) {
      return NextResponse.json({ success: true, message: "Successfully unsubscribed." });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error) {
    errorReporter.capture(error, { route: "/api/unsubscribe", action: "unsubscribe" });
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
