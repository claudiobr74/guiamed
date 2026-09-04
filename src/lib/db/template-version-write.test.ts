import { describe, expect, it } from "vitest";
import { nextTemplateVersionNumber } from "@/lib/db/template-version-write";

describe("nextTemplateVersionNumber", () => {
  it("inicia em 1 para template novo", () => {
    expect(nextTemplateVersionNumber(undefined, [])).toBe(1);
  });

  it("migra versões legadas sem contador", () => {
    expect(nextTemplateVersionNumber(undefined, [{ version: 1 }, { version: 4 }, { version: 3 }])).toBe(5);
  });

  it("usa o contador transacional quando ele está à frente do legado", () => {
    expect(nextTemplateVersionNumber(7, [{ version: 5 }, { version: 6 }])).toBe(8);
  });

  it("ignora valores de versão inválidos", () => {
    expect(nextTemplateVersionNumber("inválido", [{ version: -1 }, { version: "2" }, { version: null }])).toBe(3);
  });
});
