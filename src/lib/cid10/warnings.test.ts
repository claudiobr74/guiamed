import { describe, expect, it } from "vitest";
import { cidInformationalWarnings } from "@/lib/cid10/warnings";
import type { CidCode } from "@/types/domain";

const cid = {
  id: "X1",
  code: "X1",
  description: "CID sintético para teste",
  version: "test",
  active: true,
  classification: null,
  sexRestriction: "M",
  unlikelyCauseOfDeath: false,
  reference: null,
  excluded: null,
} satisfies CidCode;

describe("cidInformationalWarnings", () => {
  it("avisa incompatibilidade de sexo sem transformar em bloqueio", () => {
    expect(cidInformationalWarnings(cid, "F")).toContainEqual(expect.objectContaining({
      code: "CID_SEX_RESTRICTION",
    }));
  });

  it("não avisa restrição quando o sexo cadastrado é compatível ou não binário", () => {
    expect(cidInformationalWarnings(cid, "M")).toEqual([]);
    expect(cidInformationalWarnings(cid, "O")).toEqual([]);
    expect(cidInformationalWarnings(cid, null)).toEqual([]);
  });

  it("sinaliza nota de exclusão como revisão informativa", () => {
    expect(cidInformationalWarnings({ ...cid, sexRestriction: null, excluded: "excluir condição Y" }, "F"))
      .toContainEqual(expect.objectContaining({ code: "CID_EXCLUSION_REFERENCE" }));
  });
});
