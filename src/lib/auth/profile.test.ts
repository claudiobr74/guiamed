import { describe, expect, it } from "vitest";
import { activeProfileToSession } from "./profile";

describe("activeProfileToSession", () => {
  it("aceita apenas perfil ativo com organização e papel válidos", () => {
    expect(
      activeProfileToSession("u1", {
        organizationId: "org1",
        role: "doctor",
        fullName: "  Ana  ",
        email: "ANA@EXAMPLE.COM",
        active: true,
      }),
    ).toEqual({
      id: "u1",
      organizationId: "org1",
      role: "doctor",
      fullName: "Ana",
      email: "ana@example.com",
    });
  });

  it("não cria sessão para perfil ausente", () => {
    expect(activeProfileToSession("u1", undefined)).toBeNull();
  });

  it("não reativa perfil inativo ou sem active explícito", () => {
    expect(
      activeProfileToSession("u1", {
        organizationId: "org1",
        role: "admin",
        active: false,
      }),
    ).toBeNull();
    expect(
      activeProfileToSession("u1", {
        organizationId: "org1",
        role: "admin",
      }),
    ).toBeNull();
  });

  it("rejeita papel ou organização inválidos", () => {
    expect(
      activeProfileToSession("u1", {
        organizationId: "",
        role: "admin",
        active: true,
      }),
    ).toBeNull();
    expect(
      activeProfileToSession("u1", {
        organizationId: "org1",
        role: "owner",
        active: true,
      }),
    ).toBeNull();
  });
});
