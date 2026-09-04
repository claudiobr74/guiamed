import { describe, expect, it } from "vitest";
import {
  parseDoctorInput,
  parseInstitutionInput,
  parsePatientInput,
  validationInternals,
} from "@/lib/validation/domain";

describe("validação e normalização de domínio", () => {
  it("normaliza paciente e valida CPF, telefone, e-mail e data", () => {
    expect(parsePatientInput({
      fullName: "  Maria   Teste  ",
      cpf: "529.982.247-25",
      birthDate: "1990-02-28",
      phone: "(62) 99999-0000",
      email: " TESTE@EXAMPLE.COM ",
      sex: "F",
    })).toMatchObject({
      fullName: "Maria Teste",
      cpf: "52998224725",
      birthDate: "1990-02-28",
      phone: "62999990000",
      email: "teste@example.com",
      sex: "F",
    });
  });

  it("rejeita CPF e datas estruturalmente inválidos", () => {
    expect(() => parsePatientInput({ fullName: "Paciente", cpf: "111.111.111-11" })).toThrow(/CPF/);
    expect(() => parsePatientInput({ fullName: "Paciente", birthDate: "2026-02-31" })).toThrow(/Data/);
  });

  it("normaliza CRM e UF do médico", () => {
    expect(parseDoctorInput({ name: "Dr. Teste", crm: "12.345", crmState: "go" })).toMatchObject({
      crm: "12345",
      crmState: "GO",
      active: true,
    });
  });

  it("valida CNPJ e normaliza instituição", () => {
    expect(parseInstitutionInput({
      name: "Hospital Teste",
      kind: "hospital",
      cnpj: "11.222.333/0001-81",
      state: "go",
      phone: "62 3333-4444",
    })).toMatchObject({
      cnpj: "11222333000181",
      state: "GO",
      phone: "6233334444",
    });
    expect(() => parseInstitutionInput({ name: "Hospital", kind: "hospital", cnpj: "11.111.111/1111-11" })).toThrow(/CNPJ/);
  });

  it("mantém validadores de dígito verificável determinísticos", () => {
    expect(validationInternals.validCpf("52998224725")).toBe(true);
    expect(validationInternals.validCnpj("11222333000181")).toBe(true);
    expect(validationInternals.validIsoDate("2024-02-29")).toBe(true);
    expect(validationInternals.validIsoDate("2023-02-29")).toBe(false);
  });
});
