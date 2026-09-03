import { describe, expect, it } from "vitest";
import { MAX_TEMPLATE_PDF_BYTES } from "@/lib/pdf/upload-validation";
import {
  MAX_TEMPLATE_UPLOAD_CHUNKS,
  TEMPLATE_UPLOAD_CHUNK_BYTES,
  templateUploadChunkBounds,
  templateUploadChunkCount,
  templateUploadSessionExpired,
} from "@/lib/pdf/template-upload";

describe("upload particionado de template PDF", () => {
  it("mantém cada parte em até 3 MB e cobre o PDF inteiro", () => {
    const count = templateUploadChunkCount(MAX_TEMPLATE_PDF_BYTES);
    expect(count).toBe(MAX_TEMPLATE_UPLOAD_CHUNKS);

    let total = 0;
    for (let index = 0; index < count; index += 1) {
      const part = templateUploadChunkBounds(MAX_TEMPLATE_PDF_BYTES, index);
      expect(part.size).toBeGreaterThan(0);
      expect(part.size).toBeLessThanOrEqual(TEMPLATE_UPLOAD_CHUNK_BYTES);
      total += part.size;
    }
    expect(total).toBe(MAX_TEMPLATE_PDF_BYTES);
  });

  it("usa apenas uma parte para PDFs pequenos", () => {
    expect(templateUploadChunkCount(512 * 1024)).toBe(1);
    expect(templateUploadChunkBounds(512 * 1024, 0)).toEqual({
      start: 0,
      end: 512 * 1024,
      size: 512 * 1024,
    });
  });

  it("rejeita índices e tamanhos fora do contrato", () => {
    expect(() => templateUploadChunkCount(0)).toThrow();
    expect(() => templateUploadChunkCount(MAX_TEMPLATE_PDF_BYTES + 1)).toThrow();
    expect(() => templateUploadChunkBounds(1024, 1)).toThrow();
  });

  it("expira sessões por timestamp absoluto", () => {
    const now = new Date("2026-09-03T19:00:00.000Z");
    expect(templateUploadSessionExpired("2026-09-03T19:00:01.000Z", now)).toBe(false);
    expect(templateUploadSessionExpired("2026-09-03T19:00:00.000Z", now)).toBe(true);
    expect(templateUploadSessionExpired("invalid", now)).toBe(true);
  });
});
