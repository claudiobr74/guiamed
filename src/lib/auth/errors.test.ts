import { describe, expect, it } from "vitest";
import { toUserFacingAuthError } from "./errors";

describe("toUserFacingAuthError", () => {
  it("não vaza stack e traduz SESSION_SECRET", () => {
    expect(toUserFacingAuthError(new Error("SESSION_SECRET é obrigatório em produção."))).toMatch(
      /SESSION_SECRET/,
    );
  });

  it("traduz Firestore ausente", () => {
    expect(toUserFacingAuthError(new Error("5 NOT_FOUND: database (default) does not exist"))).toMatch(
      /Firestore/,
    );
  });

  it("preserva credencial inválida de login", () => {
    expect(toUserFacingAuthError(new Error("E-mail ou senha inválidos."))).toBe("E-mail ou senha inválidos.");
  });
});
