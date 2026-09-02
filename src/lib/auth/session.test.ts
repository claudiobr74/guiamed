import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeSession, encodeSession } from "./session";
import type { SessionUser } from "@/types/domain";

const user: SessionUser = {
  id: "u1",
  organizationId: "org1",
  role: "admin",
  fullName: "Ana",
  email: "ana@example.com",
};

afterEach(() => {
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
