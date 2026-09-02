import { describe, expect, it } from "vitest";
import { changeQuantity, defaultQuantity, parseQuantity, QuantityError } from "@/lib/quantity";

describe("quantidade", () => {
  it("padrão = 1", () => {
    expect(defaultQuantity()).toBe(1);
    expect(parseQuantity(undefined)).toBe(1);
  });

  it("permite edição", () => {
    expect(parseQuantity(6)).toBe(6);
    expect(changeQuantity(1, 5)).toBe(6);
  });

  it("zero inválido", () => {
    expect(() => parseQuantity(0)).toThrow(QuantityError);
  });

  it("negativo inválido", () => {
    expect(() => parseQuantity(-1)).toThrow(QuantityError);
  });
});
