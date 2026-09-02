import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeSession,
  encodeSession,
  SESSION_TTL_SECONDS,
} from "./session";
import type { SessionUser } from "@/types/domain";

const user: SessionUser = {
  id: "u1",
  organizationId: "org1",
  role: "admin",
  fullName: "Ana",
  email: "ana@example.com",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("session", () => {
  it("assina e valida o cookie", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", "test-secret");
    expect(decodeSession(encodeSession(user))).toEqual(user);
  });

  it("rejeita cookie adulterado", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const token = encodeSession(user);
    expect(decodeSession(`${token}x`)).toBeNull();
  });

  it("rejeita sessão depois da validade interna", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00Z"));
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const token = encodeSession(user);

    vi.setSystemTime(
      new Date("2026-09-02T12:00:00Z").getTime() +
        (SESSION_TTL_SECONDS + 1) * 1000,
    );
    expect(decodeSession(token)).toBeNull();
  });

  it("rejeita o formato legado sem versão e expiração", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
    expect(decodeSession(`${payload}.assinatura`)).toBeNull();
  });

  it("exige SESSION_SECRET em produção para assinar", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => encodeSession(user)).toThrow(/SESSION_SECRET/);
  });

  it("não derruba a página se o cookie existir sem SESSION_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    expect(decodeSession("payload.assinatura")).toBeNull();
  });
});
