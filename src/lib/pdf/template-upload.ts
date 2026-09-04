import { MAX_TEMPLATE_PDF_BYTES } from "@/lib/pdf/upload-validation";

/**
 * Mantém cada Server Action bem abaixo do teto de 4,5 MB da Vercel.
 * O limite da action fica em 4 MB; cada payload binário tem no máximo 3 MB.
 */
export const TEMPLATE_UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024;
export const TEMPLATE_UPLOAD_SESSION_TTL_MS = 15 * 60 * 1000;
export const MAX_TEMPLATE_UPLOAD_CHUNKS = Math.ceil(
  MAX_TEMPLATE_PDF_BYTES / TEMPLATE_UPLOAD_CHUNK_BYTES,
);

export function templateUploadChunkCount(size: number): number {
  if (!Number.isInteger(size) || size <= 0 || size > MAX_TEMPLATE_PDF_BYTES) {
    throw new Error("Tamanho de PDF inválido para upload.");
  }
  return Math.ceil(size / TEMPLATE_UPLOAD_CHUNK_BYTES);
}

export function templateUploadChunkBounds(
  size: number,
  index: number,
): { start: number; end: number; size: number } {
  const count = templateUploadChunkCount(size);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error("Parte de upload inválida.");
  }
  const start = index * TEMPLATE_UPLOAD_CHUNK_BYTES;
  const end = Math.min(start + TEMPLATE_UPLOAD_CHUNK_BYTES, size);
  return { start, end, size: end - start };
}

export function templateUploadSessionExpired(
  expiresAt: string,
  now = new Date(),
): boolean {
  const expires = Date.parse(expiresAt);
  return !Number.isFinite(expires) || expires <= now.getTime();
}
