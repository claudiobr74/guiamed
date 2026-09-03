import { describe, expect, it } from "vitest";
import { MAX_SIGNATURE_BYTES, validateSignatureImage } from "@/lib/signature-image";

function png(width = 600, height = 180) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function jpeg(width = 600, height = 180) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0,
    0x00, 0x11,
    0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03,
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x00,
    0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

describe("validateSignatureImage", () => {
  it("aceita PNG real pelo cabeçalho e dimensões", () => {
    const bytes = png();
    expect(validateSignatureImage(bytes, { size: bytes.length, type: "image/png" })).toMatchObject({
      kind: "png",
      extension: "png",
      width: 600,
      height: 180,
    });
  });

  it("aceita JPEG e identifica dimensões no SOF", () => {
    const bytes = jpeg();
    expect(validateSignatureImage(bytes, { size: bytes.length, type: "image/jpeg" })).toMatchObject({
      kind: "jpeg",
      extension: "jpg",
      width: 600,
      height: 180,
    });
  });

  it("rejeita MIME incompatível com o conteúdo", () => {
    const bytes = png();
    expect(() => validateSignatureImage(bytes, { size: bytes.length, type: "image/jpeg" })).toThrow(/não corresponde/);
  });

  it("rejeita arquivo sem assinatura PNG/JPEG", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(() => validateSignatureImage(bytes, { size: bytes.length, type: "image/png" })).toThrow(/PNG ou JPEG/);
  });

  it("rejeita dimensões excessivas", () => {
    const bytes = png(5000, 3000);
    expect(() => validateSignatureImage(bytes, { size: bytes.length, type: "image/png" })).toThrow(/no máximo/);
  });

  it("rejeita metadado de tamanho acima do limite antes de aceitar conteúdo", () => {
    const bytes = png();
    expect(() => validateSignatureImage(bytes, { size: MAX_SIGNATURE_BYTES + 1, type: "image/png" })).toThrow(/2 MB/);
  });
});
