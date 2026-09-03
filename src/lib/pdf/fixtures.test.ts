import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fillPdf } from "@/lib/pdf/fill";
import type { FieldMapping, PdfRepeater, SurgicalRequest } from "@/types/domain";

const OUTPUT_DIR = process.env.PDF_FIXTURE_OUTPUT_DIR?.trim() || null;
const SYNTHETIC_SIGNATURE = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAlgAAAC0CAYAAABIf1IMAAAIO0lEQVR42u3d227cNhRA0ajI//+y8lTHcDweSaSoc1kLCNA+tBlzOOQ2Jcvbvu/7LwAApvnPEAAACCwAAIEFACCwAAAQWAAAAgsAQGABACCwAAAEFgCAwAIAQGABAAgsAACBBQAgsAAAEFgAAAILAEBgAQAgsAAABBYAgMACAEBgAQAILAAAgQUAgMACABBYAAACCwBAYAEAILAAAAQWAIDAAgBAYAEACCwAAIEFAIDAAgAQWAAAAgsAAIEFACCwAAAEFgCAwAIAQGABAAgsAACBBQCAwAIAEFgAAAILAACBBQAgsAAABFYf27b9+O8AQF+/DcH1uBJVAMB3nGDdEF4AgMBCRAEAAgsAQGCVcOT0ygkXACCwAAAE1jOcTAEAAuvBuBJjvJsT5giAwOKFfd8NAofjatu2jz8iC0Bg2Rx/iCuRxR3zCwCBhY0T8wAAgTW2OTq1YmZciTA6fA7McwQWpwkuVsUYZI4r8xyBxZTTK4uJ+XNm/pgvdPgMmOcILAsDJ8fJuB0bByeedP8MWCsQWBzeGLttmh49MDZ/Xs0X40fFuPpuvpvrCCyLw1BAWUTMn7Pzx5yhYlyJLAQWDAZA10Xz7Nftfiy6xNVPc95cR2A13iCPnj50uEzo0QPnubSMuBJZCCwejBJ6xrn7segSVyILgWWROLVBGqPegXDn12nTuT5mxi5mXIksBJZwuKRqkF0do84L5pm54H6se+apsYsZVyILgdXczFiqumh0/6XXM08+RdbY+/B5jF79M3HiSmQhsGyQFtODY9TtUuEdX5d5d8/78DXAiBFXIguBRdtNctYi12mxvGOzseHMmVfGMF5ciSwEVqPF+a5AqrRYnPkRbHPHHLpjHNwXWCeuRBYCCwH669qPYFdaKFd8He7Huj7++75//DGGeeJKZCGwnEAMb5CdI6LyQrniu3kb/blfpP0usmzcseJKZCGwnEC0DYzuT7VffWnQ/VjHY+jqZWsbd6y4ElkILCcQ7QJ0xjNuMi+S0V63B7n+nWdXL1vbuGPGlchCYDmBKBdsqxavDjf8r/j/V99srp5aXQkxG3esuBJZCKxUAVJxg6y++M66d8iG8u9YObVaP/ZHxl1ciSwEVsjFq/Jr7vpU8m7zZWVkGbdYkSWuRBYC61ZdTmlmfbCrP5X8ynf8NqZrY+CS4NyxPxO54uqZz4QxplVgISJGvuOnd6hnGtf/78sSV8+8J8aYVoFVNSTu/PF5m7xYGB0L4xVrXns/fEOBwOKmoOy8QBy9VOjS4LXv2D+Pj0uC8TZ07wcIrGWx0XnBMSbfj4dLg+MbvI38mffgp3H3noDAWhYSHb+D7TQmszcaG5Rxyjb+7gcCgWUjCBKXXRbisz9VaIMie2QBAmtJYLg0aEyg4zcRgMDihgXV/UXnNyAbFQAC60BMdNswj0RV14h493WLKwAEFoITAASWmJjt6q+E6ezrc5z85BUAAuuHTdMGeT3Iuo+DcQFAYB0MLZumuAIAgSUmfK0AILAQYQCAwBJXAIDAQkQBQG2/DUGe0Nq2TXgBQALbbscGAJjKJUIAgMlcIgQ++I0BkJuLUnE4wQIAEFgAALG5RAh8cHkBYA4nWAAAAgsAQGABAAgsAAAEFgCAwAIAEFgAAAgsAACBBQAgsAAAEFgAAAILAEBgAQAILAAABBYAgMACABBYAAAILAAAgQUAILAAABBYAAACCwBAYAEAILAAAAQWAIDAAgAQWAAACCwAAIEFACCwAAAQWAAAAgsAQGABACCwAAAEFgCAwAIAQGABAAgsAACBBQAgsAAAEFgAAAILAEBgAQAgsAAABBYAgMACAEBgAQAs8Qef0+yplp9g+gAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function syntheticRequest(itemCount = 3): SurgicalRequest {
  const timestamp = "2026-09-03T12:00:00.000Z";
  return {
    id: "fixture-request",
    organizationId: "fixture-org",
    patientId: "fixture-patient",
    doctorId: "fixture-doctor",
    institutionId: "fixture-institution",
    healthInsurerId: "fixture-insurer",
    templateId: "fixture-template",
    templateVersionId: "fixture-version",
    diagnosis: "Dor lombar com indicação cirúrgica eletiva",
    clinicalJustification: "Paciente sintético para validação visual. Indicação baseada exclusivamente em dados fictícios e destinada ao teste automatizado do GuiaMed.",
    clinicalNotes: null,
    status: "draft",
    revision: 1,
    createdBy: "fixture-user",
    createdAt: timestamp,
    updatedAt: timestamp,
    finalizedAt: null,
    duplicatedFromId: null,
    patient: {
      id: "fixture-patient",
      organizationId: "fixture-org",
      fullName: "João D’Ávila – Paciente Sintético ≥ 18",
      birthDate: "1980-04-15",
      cpf: "000.000.000-00",
      sex: "F",
      phone: "(00) 00000-0000",
      email: "sintetico@example.invalid",
      insuranceCard: "TESTE-0001",
      healthInsurerId: "fixture-insurer",
      healthInsurerName: "Operadora Sintética",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    doctor: {
      id: "fixture-doctor",
      organizationId: "fixture-org",
      name: "Dra. Médica Sintética",
      crm: "00000",
      crmState: "GO",
      cpf: null,
      specialty: "Especialidade de Teste",
      rqe: "0000",
      phone: null,
      email: null,
      signatureFile: null,
      signatureKind: "image",
      isDefault: true,
      active: true,
    },
    institution: {
      id: "fixture-institution",
      organizationId: "fixture-org",
      kind: "hospital",
      name: "Hospital Sintético de Testes",
      cnpj: null,
      city: "Goiânia",
      state: "GO",
      phone: null,
      active: true,
    },
    healthInsurer: {
      id: "fixture-insurer",
      organizationId: "fixture-org",
      name: "Operadora Sintética",
      code: "TESTE",
      active: true,
    },
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: `fixture-item-${index + 1}`,
      requestId: "fixture-request",
      procedureId: `fixture-procedure-${index + 1}`,
      procedureName: `Procedimento Sintético ${index + 1} – revisão ≥ ${index + 1}`,
      tussCodeId: `fixture-tuss-${index + 1}`,
      ipasgoCodeId: `fixture-ipasgo-${index + 1}`,
      tussCodeSnapshot: `3000000${index + 1}`,
      ipasgoCodeSnapshot: `9000000${index + 1}`,
      quantity: index + 1,
      laterality: index % 2 === 0 ? "Direita" : "Esquerda",
      notes: "Item fictício",
      sortOrder: index,
    })),
    cids: [{
      id: "fixture-cid",
      requestId: "fixture-request",
      cidCodeId: "M54.5",
      codeSnapshot: "M54.5",
      descriptionSnapshot: "Dor lombar baixa — fixture sintética",
      sortOrder: 0,
    }],
  };
}

function mapping(
  semanticField: string,
  y: number,
  overrides: Partial<FieldMapping> = {},
): FieldMapping {
  return {
    id: `fixture-${semanticField}-${y}`,
    templateVersionId: "fixture-version",
    semanticField,
    pdfFieldName: null,
    mappingKind: "overlay",
    page: 1,
    x: 150,
    y,
    width: 360,
    height: 22,
    fontSize: 10,
    alignment: "left",
    multiline: false,
    autoShrink: true,
    maxCharacters: null,
    required: false,
    ...overrides,
  };
}

async function baseTemplate(title: string, pages = 1): Promise<PDFDocument> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index += 1) {
    const page = pdf.addPage([595, 842]);
    page.drawText(`${title} - pagina ${index + 1}/${pages}`, {
      x: 36,
      y: 805,
      size: 14,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText("FIXTURE 100% SINTETICA - NAO UTILIZAR COMO DOCUMENTO CLINICO", {
      x: 36,
      y: 785,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  }
  return pdf;
}

async function writeFixture(name: string, bytes: Uint8Array): Promise<void> {
  if (!OUTPUT_DIR) return;
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, name), bytes);
}

async function writeManifest(): Promise<void> {
  if (!OUTPUT_DIR) return;
  const manifest = {
    syntheticOnly: true,
    generatedAt: new Date().toISOString(),
    fixtures: [
      {
        file: "01-overlay-unicode.pdf",
        inspect: ["Unicode/acentos", "alinhamento", "multiline sem truncamento", "CID e dados sintéticos"],
      },
      {
        file: "02-acroform-controls.pdf",
        inspect: ["TextField Unicode", "checkbox marcado", "radio F selecionado", "dropdown GO selecionado"],
      },
      {
        file: "03-signature-image.pdf",
        inspect: ["PNG sintético dentro da caixa de assinatura", "proporção e posicionamento"],
      },
      {
        file: "04-multipage-repeaters.pdf",
        inspect: ["5 procedimentos na página 1", "2 procedimentos na página 2", "TUSS/IPASGO/quantidade sem sobreposição"],
      },
    ],
  };
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
}

describe("fixtures PDF sintéticas para inspeção visual", () => {
  it("gera overlay Unicode representativo sem dados reais", async () => {
    const pdf = await baseTemplate("GuiaMed Overlay Unicode");
    const page = pdf.getPage(0);
    const labelFont = await pdf.embedFont(StandardFonts.Helvetica);
    [
      ["Paciente", 730],
      ["Medico", 690],
      ["CID-10", 650],
      ["Diagnostico", 610],
      ["Justificativa", 555],
    ].forEach(([label, y]) => page.drawText(String(label), { x: 36, y: Number(y), size: 9, font: labelFont }));

    const templateBytes = await pdf.save();
    const result = await fillPdf({
      templateBytes,
      request: syntheticRequest(),
      mappings: [
        mapping("patient.full_name", 92),
        mapping("doctor.name", 132),
        mapping("request.cid", 172),
        mapping("request.diagnosis", 212),
        mapping("request.clinical_justification", 252, { height: 90, multiline: true, fontSize: 10 }),
      ],
      repeaters: [],
    });

    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(1);
    expect(result.bytes.byteLength).toBeGreaterThan(templateBytes.byteLength);
    await writeFixture("01-overlay-unicode.pdf", result.bytes);
    await writeManifest();
  });

  it("gera AcroForm com texto Unicode e controles determinísticos", async () => {
    const pdf = await baseTemplate("GuiaMed AcroForm");
    const page = pdf.getPage(0);
    const form = pdf.getForm();
    const text = form.createTextField("patient_name");
    text.addToPage(page, { x: 150, y: 690, width: 360, height: 24 });
    const checkbox = form.createCheckBox("confirmado");
    checkbox.addToPage(page, { x: 150, y: 640, width: 18, height: 18 });
    const radio = form.createRadioGroup("sexo");
    radio.addOptionToPage("F", page, { x: 150, y: 590, width: 18, height: 18 });
    radio.addOptionToPage("M", page, { x: 190, y: 590, width: 18, height: 18 });
    const dropdown = form.createDropdown("uf_crm");
    dropdown.setOptions(["GO", "SP", "DF"]);
    dropdown.addToPage(page, { x: 150, y: 540, width: 100, height: 22 });

    const labelFont = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("Paciente", { x: 36, y: 697, size: 9, font: labelFont });
    page.drawText("Diagnostico confirmado", { x: 36, y: 645, size: 9, font: labelFont });
    page.drawText("Sexo F/M", { x: 36, y: 595, size: 9, font: labelFont });
    page.drawText("UF CRM", { x: 36, y: 545, size: 9, font: labelFont });

    const request = syntheticRequest();
    request.diagnosis = "sim";
    const result = await fillPdf({
      templateBytes: await pdf.save(),
      request,
      mappings: [
        mapping("patient.full_name", 0, { mappingKind: "acroform", pdfFieldName: "patient_name" }),
        mapping("request.diagnosis", 0, { mappingKind: "acroform", pdfFieldName: "confirmado" }),
        mapping("patient.sex", 0, { mappingKind: "acroform", pdfFieldName: "sexo" }),
        mapping("doctor.crm_state", 0, { mappingKind: "acroform", pdfFieldName: "uf_crm" }),
      ],
      repeaters: [],
    });

    const out = await PDFDocument.load(result.bytes);
    const outForm = out.getForm();
    expect(outForm.getTextField("patient_name").getText()).toContain("João");
    expect(outForm.getCheckBox("confirmado").isChecked()).toBe(true);
    expect(outForm.getRadioGroup("sexo").getSelected()).toBe("F");
    expect(outForm.getDropdown("uf_crm").getSelected()).toEqual(["GO"]);
    await writeFixture("02-acroform-controls.pdf", result.bytes);
  });

  it("gera fixture de assinatura por imagem sintética", async () => {
    const pdf = await baseTemplate("GuiaMed Assinatura Sintetica");
    const page = pdf.getPage(0);
    const labelFont = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("Assinatura sintetica", { x: 70, y: 315, size: 9, font: labelFont });
    page.drawRectangle({ x: 70, y: 160, width: 420, height: 140, borderWidth: 1, borderColor: rgb(0.6, 0.6, 0.6) });
    const templateBytes = await pdf.save();
    const result = await fillPdf({
      templateBytes,
      request: syntheticRequest(),
      mappings: [mapping("signature.image", 542, { x: 80, width: 400, height: 120 })],
      repeaters: [],
      signatureBytes: SYNTHETIC_SIGNATURE,
    });

    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(1);
    expect(result.bytes.byteLength).toBeGreaterThan(templateBytes.byteLength);
    await writeFixture("03-signature-image.pdf", result.bytes);
  });

  it("gera continuação multipágina de procedimentos sem falso overflow", async () => {
    const pdf = await baseTemplate("GuiaMed Repeater Multipagina", 2);
    const labelFont = await pdf.embedFont(StandardFonts.Helvetica);
    for (const page of pdf.getPages()) {
      page.drawText("Procedimento", { x: 40, y: 710, size: 8, font: labelFont });
      page.drawText("TUSS", { x: 300, y: 710, size: 8, font: labelFont });
      page.drawText("IPASGO", { x: 385, y: 710, size: 8, font: labelFont });
      page.drawText("Qtd", { x: 480, y: 710, size: 8, font: labelFont });
    }

    const repeaters: PdfRepeater[] = [1, 2].map((page) => ({
      id: `fixture-repeater-${page}`,
      templateVersionId: "fixture-version",
      source: "procedures",
      page,
      startX: 40,
      startY: 145,
      rowHeight: 42,
      maxRows: 5,
      columns: [
        { field: "name", x: 40, width: 245, fontSize: 9 },
        { field: "tuss", x: 300, width: 75, fontSize: 9 },
        { field: "ipasgo", x: 385, width: 85, fontSize: 9 },
        { field: "quantity", x: 485, width: 40, fontSize: 9 },
      ],
    }));

    const result = await fillPdf({
      templateBytes: await pdf.save(),
      request: syntheticRequest(7),
      mappings: [],
      repeaters,
    });

    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(2);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    await writeFixture("04-multipage-repeaters.pdf", result.bytes);
  });
});
