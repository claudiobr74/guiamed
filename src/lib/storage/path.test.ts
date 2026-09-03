import { describe, expect, it } from "vitest";
import {
  authenticatedFileUrl,
  authorizedStoragePath,
  buildStoragePath,
  requireAuthorizedStoragePath,
  safeStorageFilename,
} from "./path";

describe("storage path", () => {
  it("autoriza somente o segmento exato da organização", () => {
    expect(
      authorizedStoragePath(
        ["generated-documents", "org-1", "hash-guia.pdf"],
        "org-1",
      ),
    ).toBe("generated-documents/org-1/hash-guia.pdf");
    expect(
      authorizedStoragePath(
        ["generated-documents", "prefix-org-1-suffix", "hash-guia.pdf"],
        "org-1",
      ),
    ).toBeNull();
  });

  it("rejeita bucket desconhecido e traversal", () => {
    expect(authorizedStoragePath(["public", "org-1", "arquivo.pdf"], "org-1")).toBeNull();
    expect(
      authorizedStoragePath(["pdf-templates", "org-1", "..", "arquivo.pdf"], "org-1"),
    ).toBeNull();
    expect(
      authorizedStoragePath(["pdf-templates", "org-1", "pasta/arquivo.pdf"], "org-1"),
    ).toBeNull();
  });

  it("rejeita nome de upload que possa escapar da organização", () => {
    expect(() => safeStorageFilename("../../arquivo.pdf")).toThrow(/Nome de arquivo/);
    expect(() => safeStorageFilename("pasta\\arquivo.pdf")).toThrow(/Nome de arquivo/);
    expect(buildStoragePath("pdf-templates", "org-1", "guia oficial.pdf")).toBe(
      "pdf-templates/org-1/guia oficial.pdf",
    );
  });

  it("bloqueia leitura interna cross-org", () => {
    expect(() =>
      requireAuthorizedStoragePath(
        "generated-documents/org-2/hash-guia.pdf",
        "org-1",
      ),
    ).toThrow(/Acesso negado/);
  });

  it("gera URL interna autenticada com segmentos codificados", () => {
    expect(
      authenticatedFileUrl("generated-documents/org-1/guia final 01.pdf"),
    ).toBe("/api/files/generated-documents/org-1/guia%20final%2001.pdf");
    expect(() => authenticatedFileUrl("generated-documents/org-1/../segredo.pdf")).toThrow(
      /Caminho de arquivo inválido/,
    );
  });
});
