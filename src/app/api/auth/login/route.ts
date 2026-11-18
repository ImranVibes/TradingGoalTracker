import { NextRequest, NextResponse } from "next/server";
import { extractClientIp, verifyAppPassword } from "@/lib/auth";
import {
  getAuthAttemptState,
  recordFailedAuthAttempt,
  resetAuthAttempts,
  MAX_AUTH_ATTEMPTS,
} from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
} from "@/lib/auth-edge";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ip = extractClientIp(req);
    const attemptState = await getAuthAttemptState(ip);

    if (attemptState.isLocked) {
      const mins = Math.ceil(attemptState.retryAfterSeconds / 60);
      return NextResponse.json(
        {
          success: false,
          locked: true,
          remainingAttempts: 0,
          maxAttempts: MAX_AUTH_ATTEMPTS,
          retryAfterSeconds: attemptState.retryAfterSeconds,
          error: `Too many failed attempts. Locked for ${mins} minute(s).`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(attemptState.retryAfterSeconds) },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const password = String(body.password ?? body.pin ?? "").trim();

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          remainingAttempts: attemptState.remainingAttempts,
          maxAttempts: MAX_AUTH_ATTEMPTS,
          error: "Please enter your access PIN / password.",
        },
        { status: 400 }
      );
    }

    const isValid = await verifyAppPassword(password);

    if (!isValid) {
      const updated = await recordFailedAuthAttempt(ip);
      if (updated.isLocked) {
        const mins = Math.ceil(updated.retryAfterSeconds / 60);
        return NextResponse.json(
          {
            success: false,
            locked: true,
            remainingAttempts: 0,
            maxAttempts: MAX_AUTH_ATTEMPTS,
            retryAfterSeconds: updated.retryAfterSeconds,
            error: `5 failed attempts reached. Access locked for ${mins} minutes.`,
          },
          {
            status: 429,
            headers: { "Retry-After": String(updated.retryAfterSeconds) },
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          locked: false,
          remainingAttempts: updated.remainingAttempts,
          maxAttempts: MAX_AUTH_ATTEMPTS,
          retryAfterSeconds: 0,
          error: `Incorrect PIN. ${updated.remainingAttempts} ${
            updated.remainingAttempts === 1 ? "attempt" : "attempts"
          } remaining.`,
        },
        { status: 401 }
      );
    }

    // Success: reset brute-force counter & issue HttpOnly signed session cookie
    await resetAuthAttempts(ip);

    const now = Date.now();
    const token = await signSessionToken({
      sub: "owner",
      iat: now,
      exp: now + SESSION_MAX_AGE_SECONDS * 1000,
    });

    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" ||
      req.url.startsWith("https://");

    const res = NextResponse.json({
      success: true,
      message: "Unlocked successfully.",
    });

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return res;
  } catch (error: any) {
    console.error("[API auth/login POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication service error" },
      { status: 500 }
    );
  }
}
