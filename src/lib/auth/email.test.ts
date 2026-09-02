import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("remove espaços e força minúsculas", () => {
    expect(normalizeEmail("  Claudiomacedo74@Yahoo.com.br ")).toBe("claudiomacedo74@yahoo.com.br");
  });
});
