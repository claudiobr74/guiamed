import { describe, expect, it } from "vitest";
import { isPublicPath, middlewareLoginRedirect } from "./paths";

describe("auth paths", () => {
  it("trata login, registro e recuperação como públicos", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/recuperar-senha")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/guias")).toBe(false);
  });

  it("sem cookie, manda rotas privadas para o login", () => {
    expect(middlewareLoginRedirect("/", false)).toBe("/login");
    expect(middlewareLoginRedirect("/guias", false)).toBe("/login");
  });

  it("não redireciona /login mesmo com cookie, para evitar loop", () => {
    expect(middlewareLoginRedirect("/login", true)).toBeNull();
    expect(middlewareLoginRedirect("/register", true)).toBeNull();
    expect(middlewareLoginRedirect("/", true)).toBeNull();
  });
});
