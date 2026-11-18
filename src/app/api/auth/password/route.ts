import { NextRequest, NextResponse } from "next/server";
import { verifyAppPassword, updateAppPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body.current_password || "").trim();
    const newPassword = String(body.new_password || "").trim();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Current PIN and new PIN/password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 4 || newPassword.length > 64) {
      return NextResponse.json(
        { success: false, error: "New PIN/password must be between 4 and 64 characters." },
        { status: 400 }
      );
    }

    const ok = await verifyAppPassword(currentPassword);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Current PIN/password is incorrect." },
        { status: 401 }
      );
    }

    await updateAppPassword(newPassword);
    return NextResponse.json({
      success: true,
      message: "Access PIN / password updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
