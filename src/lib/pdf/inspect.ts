import { PDFDocument } from "pdf-lib";
import { validateInspectedPdf, validatePdfSignature } from "@/lib/pdf/upload-validation";

export async function inspectPdf(bytes: Uint8Array) {
  validatePdfSignature(bytes);
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes);
  } catch {
    throw new Error("Não foi possível abrir o PDF. Verifique se o arquivo é válido e não está corrompido ou protegido.");
  }
  const pages = pdf.getPages();
  const first = pages[0];
  let hasAcroform = false;
  const acroformFields: Array<{ name: string; type: string; page: number | null }> = [];
  try {
    const form = pdf.getForm();
    const fields = form.getFields();
    hasAcroform = fields.length > 0;
    for (const field of fields) {
      acroformFields.push({
        name: field.getName(),
        type: field.constructor.name,
        page: null,
      });
    }
  } catch {
    hasAcroform = false;
  }
  const meta = {
    pageCount: pages.length,
    pageWidth: first ? first.getWidth() : null,
    pageHeight: first ? first.getHeight() : null,
    hasAcroform,
    acroformFields,
  };
  validateInspectedPdf(meta);
  return meta;
}
