import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionUser } from "@/types/domain";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const SESSION_VERSION = 1;
const CLOCK_SKEW_SECONDS = 60;

interface SessionEnvelope {
  version: number;
  issuedAt: number;
  expiresAt: number;
  user: SessionUser;
}

function secret(): string {
  const value = process.env.SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!value) {
      throw new Error("SESSION_SECRET é obrigatório em produção.");
    }
    return value;
  }
  return value || "guiamed-dev-session-secret-change-me";
}

function decodeSecret(): string | null {
  const value = process.env.SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    return value || null;
  }
  return value || "guiamed-dev-session-secret-change-me";
}

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<SessionUser>;
  return (
    typeof user.id === "string" &&
    Boolean(user.id) &&
    typeof user.organizationId === "string" &&
    Boolean(user.organizationId) &&
    (user.role === "admin" || user.role === "doctor") &&
    typeof user.fullName === "string" &&
    typeof user.email === "string"
  );
}

export function encodeSession(user: SessionUser): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const envelope: SessionEnvelope = {
    version: SESSION_VERSION,
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_SECONDS,
    user,
  };
  const payload = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function decodeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const key = decodeSecret();
  if (!key) return null;

  try {
    const [payload, sig, extra] = token.split(".");
    if (!payload || !sig || extra) return null;

    const expected = createHmac("sha256", key).update(payload).digest();
    const received = Buffer.from(sig, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<SessionEnvelope>;
    const now = Math.floor(Date.now() / 1000);
    const issuedAt = decoded.issuedAt;
    const expiresAt = decoded.expiresAt;

    if (
      decoded.version !== SESSION_VERSION ||
      typeof issuedAt !== "number" ||
      !Number.isInteger(issuedAt) ||
      typeof expiresAt !== "number" ||
      !Number.isInteger(expiresAt) ||
      issuedAt > now + CLOCK_SKEW_SECONDS ||
      expiresAt <= now ||
      expiresAt - issuedAt > SESSION_TTL_SECONDS ||
      !isSessionUser(decoded.user)
    ) {
      return null;
    }

    return decoded.user;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
