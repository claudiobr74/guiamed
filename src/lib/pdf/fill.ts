import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { OverflowError, assertProcedureOverflow } from "@/lib/overflow";
import { clipText, topLeftToPdfLib } from "@/lib/pdf/coords";
import type { FieldMapping, PdfRepeater, SurgicalRequest } from "@/types/domain";

export interface FillPdfInput {
  templateBytes: Uint8Array;
  request: SurgicalRequest;
  mappings: FieldMapping[];
  repeaters: PdfRepeater[];
  signatureBytes?: Uint8Array | null;
}

export interface FillPdfResult {
  bytes: Uint8Array;
}

function getSemanticValue(request: SurgicalRequest, semantic: string): string {
  const procedure = /^procedures\[(\d+)\]\.([a-zA-Z_]+)$/.exec(semantic);
  if (procedure) {
    const index = Number(procedure[1]);
    const key = procedure[2];
    const item = request.items[index];
    if (!item) return "";
    if (key === "name") return item.procedureName;
    if (key === "tuss") return item.tussCodeSnapshot ?? "";
    if (key === "ipasgo") return item.ipasgoCodeSnapshot ?? "";
    if (key === "quantity") return String(item.quantity);
    if (key === "laterality") return item.laterality ?? "";
    if (key === "notes") return item.notes ?? "";
    return "";
  }
  switch (semantic) {
    case "patient.full_name":
      return request.patient?.fullName ?? "";
    case "patient.birth_date":
      return request.patient?.birthDate ?? "";
    case "patient.cpf":
      return request.patient?.cpf ?? "";
    case "patient.sex":
      return request.patient?.sex ?? "";
    case "patient.phone":
      return request.patient?.phone ?? "";
    case "patient.email":
      return request.patient?.email ?? "";
    case "patient.insurance_card":
      return request.patient?.insuranceCard ?? "";
    case "doctor.name":
      return request.doctor?.name ?? "";
    case "doctor.crm":
      return request.doctor?.crm ?? "";
    case "doctor.crm_state":
      return request.doctor?.crmState ?? "";
    case "doctor.specialty":
      return request.doctor?.specialty ?? "";
    case "doctor.rqe":
      return request.doctor?.rqe ?? "";
    case "institution.name":
      return request.institution?.name ?? "";
    case "health_insurer.name":
      return request.healthInsurer?.name ?? "";
    case "request.diagnosis":
      return request.diagnosis ?? "";
    case "request.clinical_justification":
      return request.clinicalJustification ?? "";
    case "request.cid":
      return request.cids.map((c) => c.codeSnapshot).join(", ");
    case "request.created_at":
      return request.createdAt;
    default:
      return "";
  }
}

function widthAt(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(text, size);
}

function fitMeasuredFontSize(input: {
  font: PDFFont;
  text: string;
  maxWidth: number;
  fontSize: number;
  autoShrink: boolean;
  minSize?: number;
}): number {
  if (!input.autoShrink || !input.text) return input.fontSize;
  const width = widthAt(input.font, input.text, input.fontSize);
  if (width <= input.maxWidth) return input.fontSize;
  const scaled = input.fontSize * (input.maxWidth / Math.max(width, 1));
  return Math.max(input.minSize ?? 6, scaled);
}

function clipLineToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (widthAt(font, text, size) <= maxWidth) return text;
  const ellipsis = "...";
  if (widthAt(font, ellipsis, size) > maxWidth) return "";
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, mid)}${ellipsis}`;
    if (widthAt(font, candidate, size) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${text.slice(0, low).trimEnd()}${ellipsis}`;
}

function wrapLines(text: string, maxWidth: number, fontSize: number, font: PDFFont): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.trim().split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (widthAt(font, next, fontSize) <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      if (widthAt(font, word, fontSize) <= maxWidth) {
        current = word;
      } else {
        lines.push(clipLineToWidth(word, font, fontSize, maxWidth));
        current = "";
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function alignedX(mapping: FieldMapping, lineWidth: number): number {
  if (mapping.alignment === "center") return mapping.x + Math.max(0, (mapping.width - lineWidth) / 2);
  if (mapping.alignment === "right") return mapping.x + Math.max(0, mapping.width - lineWidth);
  return mapping.x;
}

function drawMappedText(
  page: PDFPage,
  font: PDFFont,
  mapping: FieldMapping,
  text: string,
): void {
  const value = clipText(text, mapping.maxCharacters);
  if (!value) return;
  const pageHeight = page.getHeight();
  const origin = topLeftToPdfLib({
    x: mapping.x,
    y: mapping.y,
    height: mapping.height,
    pageHeightPt: pageHeight,
  });
  const size = fitMeasuredFontSize({
    font,
    text: mapping.multiline ? value.split(/\r?\n/).reduce((longest, line) => widthAt(font, line, mapping.fontSize) > widthAt(font, longest, mapping.fontSize) ? line : longest, "") : value,
    maxWidth: mapping.width,
    fontSize: mapping.fontSize,
    autoShrink: mapping.autoShrink,
  });
  const rawLines = mapping.multiline ? wrapLines(value, mapping.width, size, font) : [clipLineToWidth(value, font, size, mapping.width)];
  const lineHeight = size + 2;
  const maxLines = Math.max(1, Math.floor(mapping.height / lineHeight));
  const lines = rawLines.slice(0, maxLines);

  lines.forEach((line, i) => {
    if (!line) return;
    const y = origin.y + mapping.height - lineHeight * (i + 1);
    if (y < origin.y) return;
    const lineWidth = widthAt(font, line, size);
    page.drawText(line, {
      x: alignedX(mapping, lineWidth),
      y,
      size,
      font,
      color: rgb(0.06, 0.09, 0.16),
    });
  });
}

export function validateRequestForPdf(request: SurgicalRequest, mappings: FieldMapping[]): string[] {
  const errors: string[] = [];
  const required = mappings.filter((m) => m.required);
  for (const mapping of required) {
    if (!getSemanticValue(request, mapping.semanticField).trim()) {
      errors.push(
        `Não foi possível gerar o PDF porque o campo ${mapping.semanticField} está vazio.`,
      );
    }
  }
  if (request.doctor && !request.doctor.crm) {
    errors.push("Não foi possível gerar o PDF porque o campo CRM do médico está vazio.");
  }
  return errors;
}

export async function fillPdf(input: FillPdfInput): Promise<FillPdfResult> {
  const maxRows = input.repeaters.length
    ? Math.max(...input.repeaters.map((r) => r.maxRows))
    : null;
  assertProcedureOverflow(input.request.items.length, maxRows);

  const pdf = await PDFDocument.load(input.templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();

  for (const mapping of input.mappings) {
    const value = getSemanticValue(input.request, mapping.semanticField);
    if (mapping.mappingKind === "acroform" && mapping.pdfFieldName) {
      try {
        const field = form.getTextField(mapping.pdfFieldName);
        field.setText(value);
        try {
          field.setFontSize(mapping.fontSize);
        } catch {
          /* alguns campos AcroForm não aceitam tamanho fixo */
        }
      } catch {
        const page = pdf.getPage(Math.max(0, mapping.page - 1));
        drawMappedText(page, font, mapping, value);
      }
    } else if (mapping.semanticField === "signature.image" && input.signatureBytes) {
      const page = pdf.getPage(Math.max(0, mapping.page - 1));
      const origin = topLeftToPdfLib({
        x: mapping.x,
        y: mapping.y,
        height: mapping.height,
        pageHeightPt: page.getHeight(),
      });
      try {
        const img = await pdf.embedPng(input.signatureBytes);
        page.drawImage(img, {
          x: origin.x,
          y: origin.y,
          width: mapping.width,
          height: mapping.height,
        });
      } catch {
        const jpg = await pdf.embedJpg(input.signatureBytes);
        page.drawImage(jpg, {
          x: origin.x,
          y: origin.y,
          width: mapping.width,
          height: mapping.height,
        });
      }
    } else {
      const page = pdf.getPage(Math.max(0, mapping.page - 1));
      drawMappedText(page, font, mapping, value);
    }
  }

  for (const repeater of input.repeaters) {
    if (input.request.items.length > repeater.maxRows) {
      throw new OverflowError(repeater.maxRows, input.request.items.length);
    }
    const page = pdf.getPage(Math.max(0, repeater.page - 1));
    input.request.items.forEach((item, index) => {
      const y = repeater.startY + index * repeater.rowHeight;
      for (const column of repeater.columns) {
        const semantic = `procedures[${index}].${column.field}`;
        const mapping: FieldMapping = {
          id: `tmp-${index}-${column.field}`,
          templateVersionId: repeater.templateVersionId,
          semanticField: semantic,
          pdfFieldName: null,
          mappingKind: "overlay",
          page: repeater.page,
          x: column.x,
          y,
          width: column.width,
          height: repeater.rowHeight - 2,
          fontSize: column.fontSize ?? 9,
          alignment: "left",
          multiline: false,
          autoShrink: true,
          maxCharacters: null,
          required: false,
        };
        drawMappedText(page, font, mapping, getSemanticValue(input.request, semantic));
      }
    });
  }

  try {
    form.updateFieldAppearances(font);
  } catch {
    // overlay-only PDFs may not have a form
  }

  const bytes = await pdf.save();
  return { bytes };
}

export { OverflowError };
