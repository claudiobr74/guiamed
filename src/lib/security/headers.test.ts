import { describe, expect, it } from "vitest";
import nextConfig, { securityHeaders } from "../../../next.config";

describe("security headers", () => {
  it("mantém CSP restritiva para documentos clínicos", () => {
    const csp = securityHeaders.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("form-action 'self'");
  });

  it("mantém headers anti-sniffing, framing, permissões e HSTS", async () => {
    const byName = new Map(securityHeaders.map((header) => [header.key, header.value]));
    expect(byName.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byName.get("X-Frame-Options")).toBe("DENY");
    expect(byName.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(byName.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(byName.get("Permissions-Policy")).toContain("camera=()");
    expect(byName.get("Strict-Transport-Security")).toContain("max-age=31536000");

    expect(nextConfig.headers).toBeTypeOf("function");
    const routes = await nextConfig.headers?.();
    expect(routes?.[0]?.source).toBe("/(.*)");
  });

  it("mantém Server Actions abaixo do teto de payload da Vercel", () => {
    expect(nextConfig.experimental?.serverActions).toMatchObject({ bodySizeLimit: "4mb" });
  });
});
