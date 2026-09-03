import { z } from "zod";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

function digits(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).replace(/\D/g, "") : "";
}

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function nullableText(max: number) {
  return z.preprocess(
    (value) => {
      const normalized = normalizedText(value);
      return normalized || null;
    },
    z.string().max(max).nullable(),
  );
}

function validCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const calculate = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(value[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculate(9) === Number(value[9]) && calculate(10) === Number(value[10]);
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

function validIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "Identificador inválido.");
const nullableId = z.preprocess((value) => normalizedText(value) || null, id.nullable());
const name = z.preprocess(
  normalizedText,
  z.string().min(2, "Informe um nome válido.").max(180, "O nome deve ter no máximo 180 caracteres."),
);
const phone = z.preprocess(
  (value) => digits(value) || null,
  z.string().regex(/^\d{10,11}$/, "Informe telefone com DDD e 10 ou 11 dígitos.").nullable(),
);
const email = z.preprocess(
  (value) => normalizedText(value).toLowerCase() || null,
  z.string().email("Informe um e-mail válido.").max(254).nullable(),
);
const cpf = z.preprocess(
  (value) => digits(value) || null,
  z.string().refine(validCpf, "CPF inválido.").nullable(),
);
const cnpj = z.preprocess(
  (value) => digits(value) || null,
  z.string().refine(validCnpj, "CNPJ inválido.").nullable(),
);
const uf = z.preprocess((value) => normalizedText(value).toUpperCase(), z.enum(UFS));
const nullableUf = z.preprocess(
  (value) => normalizedText(value).toUpperCase() || null,
  z.enum(UFS).nullable(),
);
const birthDate = z.preprocess(
  (value) => normalizedText(value) || null,
  z.string().refine(validIsoDate, "Data de nascimento inválida.").nullable(),
);

const patientSchema = z.object({
  id: id.optional(),
  fullName: name,
  birthDate: birthDate.optional().default(null),
  cpf: cpf.optional().default(null),
  sex: z.enum(["F", "M", "I"]).nullable().optional().default(null),
  phone: phone.optional().default(null),
  email: email.optional().default(null),
  insuranceCard: nullableText(80).optional().default(null),
  healthInsurerId: nullableId.optional().default(null),
});

const doctorSchema = z.object({
  id: id.optional(),
  name,
  crm: z.preprocess((value) => digits(value), z.string().regex(/^\d{3,10}$/, "CRM inválido.")),
  crmState: uf,
  cpf: cpf.optional().default(null),
  specialty: nullableText(120).optional().default(null),
  rqe: z.preprocess((value) => digits(value) || null, z.string().max(12).nullable()).optional().default(null),
  phone: phone.optional().default(null),
  email: email.optional().default(null),
  isDefault: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
});

const institutionSchema = z.object({
  id: id.optional(),
  name,
  kind: z.enum(["hospital", "clinic", "operator", "insurer"]),
  city: nullableText(120).optional().default(null),
  state: nullableUf.optional().default(null),
  cnpj: cnpj.optional().default(null),
  phone: phone.optional().default(null),
  active: z.boolean().optional().default(true),
});

const insurerSchema = z.object({
  id: id.optional(),
  name,
  code: nullableText(80).optional().default(null),
  active: z.boolean().optional().default(true),
});

const procedureSchema = z.object({
  id: id.optional(),
  name,
  description: nullableText(2_000).optional().default(null),
  specialty: nullableText(120).optional().default(null),
  category: nullableText(120).optional().default(null),
  synonyms: z.array(z.preprocess(normalizedText, z.string().min(1).max(180))).max(50).optional().default([]),
  active: z.boolean().optional().default(true),
});

function parseFriendly<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

export function parsePatientInput(input: unknown) {
  return parseFriendly(patientSchema, input);
}

export function parseDoctorInput(input: unknown) {
  return parseFriendly(doctorSchema, input);
}

export function parseInstitutionInput(input: unknown) {
  return parseFriendly(institutionSchema, input);
}

export function parseInsurerInput(input: unknown) {
  return parseFriendly(insurerSchema, input);
}

export function parseProcedureInput(input: unknown) {
  return parseFriendly(procedureSchema, input);
}

export const validationInternals = { validCpf, validCnpj, validIsoDate };
