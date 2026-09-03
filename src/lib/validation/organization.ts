import { z } from "zod";

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function digits(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).replace(/\D/g, "") : "";
}

function validCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const digit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((total, number, index) => total + Number(number) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(value.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(value[12]) && second === Number(value[13]);
}

const schema = z.object({
  name: z.preprocess(
    normalizedText,
    z.string().min(2, "Informe o nome da clínica ou organização.").max(180),
  ),
  cnpj: z.preprocess(
    (value) => digits(value) || null,
    z.string().refine(validCnpj, "CNPJ inválido.").nullable(),
  ),
  phone: z.preprocess(
    (value) => digits(value) || null,
    z.string().regex(/^\d{10,11}$/, "Informe telefone com DDD e 10 ou 11 dígitos.").nullable(),
  ),
  email: z.preprocess(
    (value) => normalizedText(value).toLowerCase() || null,
    z.string().email("Informe um e-mail válido.").max(254).nullable(),
  ),
  address: z.preprocess(
    (value) => normalizedText(value) || null,
    z.string().max(500, "O endereço deve ter no máximo 500 caracteres.").nullable(),
  ),
});

export type OrganizationSettingsInput = z.infer<typeof schema>;

export function parseOrganizationSettings(input: unknown): OrganizationSettingsInput {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}
