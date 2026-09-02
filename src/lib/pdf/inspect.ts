import { PDFDocument } from "pdf-lib";

export async function inspectPdf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
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
  return {
    pageCount: pages.length,
    pageWidth: first ? first.getWidth() : null,
    pageHeight: first ? first.getHeight() : null,
    hasAcroform,
    acroformFields,
  };
}
