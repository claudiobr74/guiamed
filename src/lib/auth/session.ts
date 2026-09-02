import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionUser } from "@/types/domain";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

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

export function encodeSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function decodeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
    if (!user.id || !user.organizationId || !user.role) return null;
    return user;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
