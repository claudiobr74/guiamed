import { describe, expect, it } from "vitest";
import { nextRequestRevision, RequestChangedError } from "@/lib/requests/revision";

describe("revisão otimista da guia", () => {
  it("incrementa uma revisão atual", () => expect(nextRequestRevision(3, 3)).toBe(4));
  it("trata documento legado sem revisão como zero", () => expect(nextRequestRevision(0, undefined)).toBe(1));
  it("rejeita gravação atrasada", () => expect(() => nextRequestRevision(2, 3)).toThrow(RequestChangedError));
});
