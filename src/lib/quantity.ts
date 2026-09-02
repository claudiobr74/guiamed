import { DEFAULT_PROCEDURE_QUANTITY } from "@/types/domain";

export class QuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuantityError";
  }
}

export function defaultQuantity(): number {
  return DEFAULT_PROCEDURE_QUANTITY;
}

export function parseQuantity(value: unknown): number {
  if (value === "" || value === null || value === undefined) {
    return defaultQuantity();
  }
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(n)) {
    throw new QuantityError("A quantidade deve ser um número inteiro.");
  }
  if (n <= 0) {
    throw new QuantityError("A quantidade deve ser maior que zero.");
  }
  return n;
}

export function changeQuantity(current: number, delta: number): number {
  return parseQuantity(current + delta);
}
