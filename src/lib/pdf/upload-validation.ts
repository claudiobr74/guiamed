export const MAX_TEMPLATE_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_TEMPLATE_PDF_PAGES = 50;

export function validatePdfUploadMetadata(input: {
  name: string;
  type?: string | null;
  size: number;
}): void {
  const name = input.name.trim().toLowerCase();
  const type = input.type?.trim().toLowerCase() ?? "";
  if (!name.endsWith(".pdf") && type !== "application/pdf") {
    throw new Error("O arquivo deve ser um PDF.");
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    throw new Error("O PDF está vazio.");
  }
  if (input.size > MAX_TEMPLATE_PDF_BYTES) {
    throw new Error(`O PDF excede o limite de ${MAX_TEMPLATE_PDF_BYTES / 1024 / 1024} MB.`);
  }
}

export function validatePdfSignature(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) throw new Error("O PDF está vazio.");
  // Leitores PDF toleram alguns bytes antes do cabeçalho; procure no primeiro KB.
  const prefix = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.length, 1024)));
  if (!prefix.includes("%PDF-")) {
    throw new Error("O arquivo não possui uma assinatura PDF válida.");
  }
}

export function validateInspectedPdf(meta: { pageCount: number; pageWidth: number | null; pageHeight: number | null }): void {
  if (!Number.isInteger(meta.pageCount) || meta.pageCount < 1) {
    throw new Error("O PDF não possui páginas válidas.");
  }
  if (meta.pageCount > MAX_TEMPLATE_PDF_PAGES) {
    throw new Error(`O PDF excede o limite de ${MAX_TEMPLATE_PDF_PAGES} páginas por template.`);
  }
  if (!(meta.pageWidth && meta.pageWidth > 0) || !(meta.pageHeight && meta.pageHeight > 0)) {
    throw new Error("Não foi possível identificar dimensões válidas no PDF.");
  }
}
