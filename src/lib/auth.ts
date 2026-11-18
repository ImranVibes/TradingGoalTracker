import crypto from "crypto";
import { NextRequest } from "next/server";
import { getStoredPasswordHash, setStoredPasswordHash } from "./db";

const DEFAULT_PIN = process.env.APP_PASSWORD || "8989";

export function hashPassword(password: string, existingSalt?: string): { salt: string; hash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return { salt, hash };
}

export function timingSafeHexCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function verifyAppPassword(candidate: string): Promise<boolean> {
  const clean = String(candidate || "").trim();
  if (!clean) return false;

  const stored = await getStoredPasswordHash();
  if (stored) {
    const computed = hashPassword(clean, stored.salt);
    return timingSafeHexCompare(computed.hash, stored.hash);
  }

  // Constant-time comparison against default PIN (8989 or APP_PASSWORD env)
  const expectedHash = crypto.createHash("sha256").update(DEFAULT_PIN).digest();
  const candidateHash = crypto.createHash("sha256").update(clean).digest();
  return crypto.timingSafeEqual(expectedHash, candidateHash);
}

export async function updateAppPassword(newPassword: string): Promise<void> {
  const { salt, hash } = hashPassword(newPassword.trim());
  await setStoredPasswordHash(salt, hash);
}

export function extractClientIp(req: NextRequest): string {
  // Prioritize Cloudflare real client IP, then reverse proxy x-forwarded-for, then x-real-ip
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) return cfIp.trim().slice(0, 64);

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 64);
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim().slice(0, 64);

  return "unknown_client";
}
