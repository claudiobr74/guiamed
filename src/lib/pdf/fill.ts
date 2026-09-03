import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFForm,
  type PDFPage,
} from "pdf-lib";
import { OverflowError, assertProcedureOverflow, maxRowsFromRepeaters } from "@/lib/overflow";
import { topLeftToPdfLib } from "@/lib/pdf/coords";
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

export class PdfTextOverflowError extends Error {
  readonly code = "PDF_TEXT_OVERFLOW";
  readonly semanticField: string;

  constructor(semanticField: string) {
    const message = semanticField === "request.clinical_justification"
      ? "A justificativa clínica excede o espaço disponível neste template."
      : semanticField.startsWith("procedures[")
        ? "Um dos campos de procedimento excede o espaço disponível neste template."
        : `O conteúdo do campo ${semanticField} excede o espaço disponível neste template.`;
    super(message);
    this.name = "PdfTextOverflowError";
    this.semanticField = semanticField;
  }
}

export class PdfFontEncodingError extends Error {
  readonly code = "PDF_FONT_UNSUPPORTED_CHARACTER";
  readonly semanticField: string;

  constructor(semanticField: string) {
    super(
      `O campo ${semanticField} contém um caractere que a fonte deste template não suporta.`,
    );
    this.name = "PdfFontEncodingError";
    this.semanticField = semanticField;
  }
}

export class PdfAcroFormError extends Error {
  readonly code = "PDF_ACROFORM_INVALID_MAPPING";
  readonly pdfFieldName: string;

  constructor(pdfFieldName: string, message: string) {
    super(message);
    this.name = "PdfAcroFormError";
    this.pdfFieldName = pdfFieldName;
  }
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

function assertFontSupportsText(font: PDFFont, text: string, semanticField: string): void {
  try {
    font.encodeText(text);
  } catch {
    throw new PdfFontEncodingError(semanticField);
  }
}

function splitWordToWidth(
  word: string,
  maxWidth: number,
  fontSize: number,
  font: PDFFont,
): string[] | null {
  const chunks: string[] = [];
  let current = "";
  for (const character of Array.from(word)) {
    if (widthAt(font, character, fontSize) > maxWidth) return null;
    const candidate = `${current}${character}`;
    if (current && widthAt(font, candidate, fontSize) > maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  font: PDFFont,
): string[] | null {
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
        const chunks = splitWordToWidth(word, maxWidth, fontSize, font);
        if (!chunks) return null;
        lines.push(...chunks.slice(0, -1));
        current = chunks.at(-1) ?? "";
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function mappedTextLayout(
  font: PDFFont,
  mapping: FieldMapping,
  text: string,
): { fontSize: number; lineHeight: number; lines: string[] } {
  if (
    mapping.maxCharacters !== null &&
    Array.from(text).length > mapping.maxCharacters
  ) {
    throw new PdfTextOverflowError(mapping.semanticField);
  }
  const normalized = mapping.multiline ? text : text.replace(/\r?\n/g, " ");
  assertFontSupportsText(font, normalized.replace(/\r?\n/g, " "), mapping.semanticField);
  const minimumSize = mapping.autoShrink ? Math.min(6, mapping.fontSize) : mapping.fontSize;
  const sizes: number[] = [];
  for (let size = mapping.fontSize; size >= minimumSize; size -= 0.5) {
    sizes.push(Math.max(minimumSize, size));
  }
  if (sizes.at(-1) !== minimumSize) sizes.push(minimumSize);

  for (const fontSize of sizes) {
    const lines = mapping.multiline
      ? wrapLines(normalized, mapping.width, fontSize, font)
      : [normalized];
    if (!lines || lines.some((line) => widthAt(font, line, fontSize) > mapping.width)) {
      continue;
    }
    const lineHeight = fontSize + 2;
    if (lines.length * lineHeight <= mapping.height) {
      return { fontSize, lineHeight, lines };
    }
  }

  throw new PdfTextOverflowError(mapping.semanticField);
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
  if (!text) return;
  const pageHeight = page.getHeight();
  const origin = topLeftToPdfLib({
    x: mapping.x,
    y: mapping.y,
    height: mapping.height,
    pageHeightPt: pageHeight,
  });
  const layout = mappedTextLayout(font, mapping, text);

  layout.lines.forEach((line, i) => {
    if (!line) return;
    const y = origin.y + mapping.height - layout.lineHeight * (i + 1);
    const lineWidth = widthAt(font, line, layout.fontSize);
    page.drawText(line, {
      x: alignedX(mapping, lineWidth),
      y,
      size: layout.fontSize,
      font,
      color: rgb(0.06, 0.09, 0.16),
    });
  });
}

const CHECKED_VALUES = new Set(["1", "true", "sim", "yes", "x"]);
const UNCHECKED_VALUES = new Set(["", "0", "false", "não", "nao", "no"]);

function selectExactOption(
  pdfFieldName: string,
  value: string,
  options: string[],
): string {
  const option = options.find((candidate) => candidate === value);
  if (!option) {
    throw new PdfAcroFormError(
      pdfFieldName,
      `O valor destinado ao campo ${pdfFieldName} não corresponde a uma opção permitida no PDF oficial.`,
    );
  }
  return option;
}

function validateAcroFormTextLayout(
  field: PDFTextField | PDFDropdown | PDFOptionList,
  font: PDFFont,
  mapping: FieldMapping,
  value: string,
  multiline: boolean,
): void {
  const rectangles = field.acroField.getWidgets().map((widget) => widget.getRectangle());
  if (rectangles.length === 0) {
    throw new PdfAcroFormError(
      mapping.pdfFieldName ?? "campo",
      `O campo AcroForm ${mapping.pdfFieldName ?? "informado"} não possui uma área visível no PDF oficial.`,
    );
  }
  const width = Math.min(...rectangles.map((rectangle) => rectangle.width));
  const height = Math.min(...rectangles.map((rectangle) => rectangle.height));
  mappedTextLayout(font, {
    ...mapping,
    width: Math.max(1, width - 2),
    height: Math.max(1, height - 2),
    multiline,
  }, value);
}

function fillAcroFormField(
  form: PDFForm,
  font: PDFFont,
  mapping: FieldMapping,
  value: string,
): void {
  const pdfFieldName = mapping.pdfFieldName;
  if (!pdfFieldName) return;

  let field;
  try {
    field = form.getField(pdfFieldName);
  } catch {
    throw new PdfAcroFormError(
      pdfFieldName,
      `O campo AcroForm ${pdfFieldName} não existe nesta versão do template.`,
    );
  }

  if (field instanceof PDFTextField) {
    const maximumLength = field.getMaxLength();
    if (maximumLength !== undefined && Array.from(value).length > maximumLength) {
      throw new PdfTextOverflowError(mapping.semanticField);
    }
    validateAcroFormTextLayout(field, font, mapping, value, field.isMultiline());
    field.setText(value);
    try {
      field.setFontSize(mapping.fontSize);
    } catch {
      // O valor permanece preenchido com o tamanho nativo quando o PDF não expõe /DA.
    }
    return;
  }

  if (field instanceof PDFCheckBox) {
    const normalized = value.trim().toLocaleLowerCase("pt-BR");
    if (CHECKED_VALUES.has(normalized)) field.check();
    else if (UNCHECKED_VALUES.has(normalized)) field.uncheck();
    else {
      throw new PdfAcroFormError(
        pdfFieldName,
        `O campo ${pdfFieldName} é uma caixa de seleção, mas o valor mapeado não é booleano.`,
      );
    }
    return;
  }

  if (field instanceof PDFRadioGroup) {
    if (!value) field.clear();
    else field.select(selectExactOption(pdfFieldName, value, field.getOptions()));
    return;
  }

  if (field instanceof PDFDropdown) {
    validateAcroFormTextLayout(field, font, mapping, value, false);
    if (!value) field.clear();
    else field.select(selectExactOption(pdfFieldName, value, field.getOptions()));
    try {
      field.setFontSize(mapping.fontSize);
    } catch {
      // O valor permanece selecionado com o tamanho nativo quando o PDF não expõe /DA.
    }
    return;
  }

  if (field instanceof PDFOptionList) {
    validateAcroFormTextLayout(field, font, mapping, value, false);
    if (!value) field.clear();
    else field.select(selectExactOption(pdfFieldName, value, field.getOptions()));
    return;
  }

  throw new PdfAcroFormError(
    pdfFieldName,
    `O tipo do campo AcroForm ${pdfFieldName} ainda não é suportado pelo GuiaMed.`,
  );
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
  const maxRows = maxRowsFromRepeaters(input.repeaters);
  assertProcedureOverflow(input.request.items.length, maxRows);

  const pdf = await PDFDocument.load(input.templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();
  let changedAcroForm = false;

  for (const mapping of input.mappings) {
    const value = getSemanticValue(input.request, mapping.semanticField);
    if (mapping.mappingKind === "acroform" && mapping.pdfFieldName) {
      fillAcroFormField(form, font, mapping, value);
      changedAcroForm = true;
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

  let itemOffset = 0;
  for (const repeater of input.repeaters) {
    const page = pdf.getPage(Math.max(0, repeater.page - 1));
    const repeaterItems = input.request.items.slice(itemOffset, itemOffset + repeater.maxRows);
    repeaterItems.forEach((item, repeaterIndex) => {
      const itemIndex = itemOffset + repeaterIndex;
      const y = repeater.startY + repeaterIndex * repeater.rowHeight;
      for (const column of repeater.columns) {
        const semantic = `procedures[${itemIndex}].${column.field}`;
        const mapping: FieldMapping = {
          id: `tmp-${itemIndex}-${column.field}`,
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
    itemOffset += repeater.maxRows;
  }

  if (changedAcroForm) {
    try {
      form.updateFieldAppearances(font);
    } catch {
      throw new PdfAcroFormError(
        "appearance",
        "Não foi possível atualizar a aparência dos campos AcroForm no PDF oficial.",
      );
    }
  }

  const bytes = await pdf.save();
  return { bytes };
}

export { OverflowError };
