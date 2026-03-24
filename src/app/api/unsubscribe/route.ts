import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

  try {
    const result = await convex.action((api as any).actions.unsubscribe?.processUnsubscribe ?? "actions/unsubscribe:processUnsubscribe", {
      contactId: contactId as any,
      campaignId: campaignId as any,
      token,
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: "Successfully unsubscribed." });
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}
