import { describe, expect, it } from "vitest";
import { maskCpfForList } from "@/lib/personal-data";

describe("minimização de dados pessoais", () => {
  it("mascara CPF integral nas listagens", () => {
    expect(maskCpfForList("123.456.789-09")).toBe("***.***.***-09");
    expect(maskCpfForList("12345678909")).toBe("***.***.***-09");
  });

  it("não tenta exibir identificador malformado", () => {
    expect(maskCpfForList("123")).toBe("CPF protegido");
    expect(maskCpfForList(null)).toBe("—");
  });
});
