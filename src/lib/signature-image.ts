export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
export const MAX_SIGNATURE_WIDTH = 4_000;
export const MAX_SIGNATURE_HEIGHT = 2_000;

export type SignatureImageKind = "png" | "jpeg";

export interface SignatureImageInfo {
  kind: SignatureImageKind;
  mimeType: "image/png" | "image/jpeg";
  extension: "png" | "jpg";
  width: number;
  height: number;
}

function pngInfo(bytes: Uint8Array): SignatureImageInfo | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { kind: "png", mimeType: "image/png", extension: "png", width, height };
}

function jpegInfo(bytes: Uint8Array): SignatureImageInfo | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    const isSof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isSof) {
      if (length < 7) break;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return { kind: "jpeg", mimeType: "image/jpeg", extension: "jpg", width, height };
    }
    offset += length;
  }
  return null;
}

export function validateSignatureImage(
  bytes: Uint8Array,
  metadata: { size: number; type: string },
): SignatureImageInfo {
  if (metadata.size <= 0 || bytes.length <= 0) throw new Error("A imagem de assinatura está vazia.");
  if (metadata.size > MAX_SIGNATURE_BYTES || bytes.length > MAX_SIGNATURE_BYTES) {
    throw new Error("A imagem de assinatura deve ter no máximo 2 MB.");
  }

  const info = pngInfo(bytes) ?? jpegInfo(bytes);
  if (!info) throw new Error("A assinatura deve ser uma imagem PNG ou JPEG válida.");
  const declared = metadata.type.trim().toLowerCase();
  if (declared && declared !== info.mimeType) {
    throw new Error("O tipo declarado do arquivo não corresponde ao conteúdo da imagem.");
  }
  if (info.width < 10 || info.height < 10) throw new Error("A imagem de assinatura possui dimensões inválidas.");
  if (info.width > MAX_SIGNATURE_WIDTH || info.height > MAX_SIGNATURE_HEIGHT) {
    throw new Error(`A assinatura deve ter no máximo ${MAX_SIGNATURE_WIDTH}×${MAX_SIGNATURE_HEIGHT} pixels.`);
  }
  return info;
}
