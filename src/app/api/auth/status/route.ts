import { NextRequest, NextResponse } from "next/server";
import { extractClientIp } from "@/lib/auth";
import { getAuthAttemptState, MAX_AUTH_ATTEMPTS } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-edge";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const { valid } = await verifySessionToken(token);
    const ip = extractClientIp(req);
    const state = await getAuthAttemptState(ip);

    return NextResponse.json({
      success: true,
      authenticated: valid,
      locked: state.isLocked,
      remainingAttempts: state.remainingAttempts,
      maxAttempts: MAX_AUTH_ATTEMPTS,
      retryAfterSeconds: state.retryAfterSeconds,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}
