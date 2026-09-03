import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesProxyMatch } from "next/experimental/testing/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { config, proxy } from "./proxy";

describe("Next.js proxy auth barrier", () => {
  it("matches application routes but skips static assets", () => {
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "/guias" })).toBe(true);
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "/_next/static/chunk.js" })).toBe(false);
    expect(unstable_doesProxyMatch({ config, nextConfig: {}, url: "/favicon.ico" })).toBe(false);
  });

  it("redirects an unauthenticated private route to login", () => {
    const response = proxy(new NextRequest("https://guiamed.test/guias"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://guiamed.test/login");
  });

  it("lets public routes and requests with a session cookie continue", () => {
    const loginResponse = proxy(new NextRequest("https://guiamed.test/login"));
    expect(loginResponse.headers.get("x-middleware-next")).toBe("1");

    const authenticated = new NextRequest("https://guiamed.test/guias", {
      headers: { cookie: `${SESSION_COOKIE}=signed-session-placeholder` },
    });
    const authenticatedResponse = proxy(authenticated);
    expect(authenticatedResponse.headers.get("x-middleware-next")).toBe("1");
  });
});
