import { z } from "zod";
import type { FieldMapping, PdfRepeater, TemplateVersion } from "@/types/domain";

const coordinate = z.number().finite().min(0, "A coordenada não pode ser negativa.").max(5_000);
const dimension = z.number().finite().positive("A dimensão deve ser maior que zero.").max(5_000);

const fieldMappingSchema = z.object({
  semanticField: z.string().trim().min(1, "Selecione um campo semântico.").max(120),
  pdfFieldName: z.string().trim().min(1).max(240).nullable(),
  mappingKind: z.enum(["overlay", "acroform"]),
  page: z.number().int().min(1),
  x: coordinate,
  y: coordinate,
  width: dimension,
  height: dimension,
  fontSize: z.number().finite().min(4).max(72),
  alignment: z.enum(["left", "center", "right"]),
  multiline: z.boolean(),
  autoShrink: z.boolean(),
  maxCharacters: z.number().int().positive().max(20_000).nullable(),
  required: z.boolean(),
}).superRefine((mapping, context) => {
  if (mapping.mappingKind === "acroform" && !mapping.pdfFieldName) {
    context.addIssue({
      code: "custom",
      path: ["pdfFieldName"],
      message: "O nome do campo AcroForm é obrigatório.",
    });
  }
});

const repeaterColumnSchema = z.object({
  field: z.enum(["name", "tuss", "ipasgo", "quantity", "laterality", "notes"]),
  x: coordinate,
  width: dimension,
  fontSize: z.number().finite().min(4).max(72).optional(),
});

const repeaterSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  templateVersionId: z.string().trim().min(1).max(240),
  source: z.literal("procedures"),
  page: z.number().int().min(1),
  startX: coordinate,
  startY: coordinate,
  rowHeight: dimension,
  maxRows: z.number().int().min(1).max(100),
  columns: z.array(repeaterColumnSchema).min(1, "Adicione ao menos uma coluna ao repeater.").max(20),
});

const SUPPORTED_ACROFORM_TYPES = new Set([
  "PDFTextField",
  "PDFCheckBox",
  "PDFRadioGroup",
  "PDFDropdown",
  "PDFOptionList",
]);

function assertWithinTemplate(
  version: TemplateVersion,
  input: { page: number; x: number; y: number; width: number; height: number },
): void {
  if (input.page > version.pageCount) {
    throw new Error(`A página ${input.page} não existe nesta versão do template.`);
  }
  if (version.pageWidth !== null && input.x + input.width > version.pageWidth + 0.01) {
    throw new Error("O campo ultrapassa a largura da página do PDF.");
  }
  if (version.pageHeight !== null && input.y + input.height > version.pageHeight + 0.01) {
    throw new Error("O campo ultrapassa a altura da página do PDF.");
  }
}

function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export function validateMappingsForTemplate(
  input: unknown,
  version: TemplateVersion,
): Array<Omit<FieldMapping, "id" | "templateVersionId">> {
  const result = z.array(fieldMappingSchema).max(300).safeParse(input);
  if (!result.success) {
    throw new Error(`Mapeamento de PDF inválido: ${firstIssueMessage(result.error)}`);
  }
  for (const mapping of result.data) {
    assertWithinTemplate(version, mapping);
    if (mapping.mappingKind === "acroform") {
      const field = version.acroformFields.find(
        (candidate) => candidate.name === mapping.pdfFieldName,
      );
      if (!field) {
        throw new Error(
          `O campo AcroForm ${mapping.pdfFieldName} não existe nesta versão do template.`,
        );
      }
      if (!SUPPORTED_ACROFORM_TYPES.has(field.type)) {
        throw new Error(
          `O tipo ${field.type} do campo AcroForm ${field.name} ainda não é suportado.`,
        );
      }
    }
  }
  return result.data;
}

export function validateRepeaterForTemplate(
  input: unknown,
  version: TemplateVersion,
): Omit<PdfRepeater, "id"> & { id?: string } {
  const result = repeaterSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Região repetidora inválida: ${firstIssueMessage(result.error)}`);
  }
  const repeater = result.data;
  if (repeater.templateVersionId !== version.id) {
    throw new Error("A região repetidora não pertence a esta versão do template.");
  }
  if (repeater.page > version.pageCount) {
    throw new Error(`A página ${repeater.page} não existe nesta versão do template.`);
  }
  if (
    version.pageHeight !== null &&
    repeater.startY + repeater.rowHeight * repeater.maxRows > version.pageHeight + 0.01
  ) {
    throw new Error("As linhas da região repetidora ultrapassam a altura da página do PDF.");
  }
  const pageWidth = version.pageWidth;
  if (
    pageWidth !== null &&
    repeater.columns.some((column) => column.x + column.width > pageWidth + 0.01)
  ) {
    throw new Error("Uma coluna da região repetidora ultrapassa a largura da página do PDF.");
  }
  return repeater;
}
