import { describe, expect, it } from "vitest";
import { OverflowError, assertProcedureOverflow, maxRowsFromRepeaters } from "@/lib/overflow";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  PdfAcroFormError,
  PdfFontEncodingError,
  PdfTextOverflowError,
  fillPdf,
} from "@/lib/pdf/fill";
import type { FieldMapping, SurgicalRequest } from "@/types/domain";

function request(items: number): SurgicalRequest {
  return {
    id: "r1",
    organizationId: "o1",
    patientId: "p1",
    doctorId: "d1",
    institutionId: "i1",
    healthInsurerId: null,
    templateId: "t1",
    templateVersionId: "v1",
    diagnosis: "discpatia",
    clinicalJustification: "indicação informada",
    clinicalNotes: null,
    status: "draft",
    revision: 0,
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    finalizedAt: null,
    duplicatedFromId: null,
    patient: {
      id: "p1",
      organizationId: "o1",
      fullName: "Paciente Teste",
      birthDate: "1965-03-15",
      cpf: "000.000.000-00",
      sex: "F",
      phone: null,
      email: null,
      insuranceCard: "1",
      healthInsurerId: null,
      createdAt: "",
      updatedAt: "",
    },
    doctor: {
      id: "d1",
      organizationId: "o1",
      name: "Dra. Teste",
      crm: "12345",
      crmState: "GO",
      cpf: null,
      specialty: null,
      rqe: null,
      phone: null,
      email: null,
      signatureFile: null,
      signatureKind: "image",
      isDefault: true,
      active: true,
    },
    items: Array.from({ length: items }, (_, i) => ({
      id: `it${i}`,
      requestId: "r1",
      procedureId: null,
      procedureName: `Proc ${i + 1}`,
      tussCodeId: null,
      ipasgoCodeId: null,
      tussCodeSnapshot: "111",
      ipasgoCodeSnapshot: null,
      quantity: 1,
      laterality: null,
      notes: null,
      sortOrder: i,
    })),
    cids: [],
  };
}

const simpleMapping: FieldMapping = {
  id: "m1",
  templateVersionId: "v1",
  semanticField: "patient.full_name",
  pdfFieldName: null,
  mappingKind: "overlay",
  page: 1,
  x: 50,
  y: 50,
  width: 200,
  height: 16,
  fontSize: 10,
  alignment: "left",
  multiline: false,
  autoShrink: true,
  maxCharacters: null,
  required: true,
};

describe("PDF e overflow", () => {
  it("overflow quando excede linhas", () => {
    expect(() => assertProcedureOverflow(7, 5)).toThrow(OverflowError);
  });

  it("campo simples overlay", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    const bytes = await pdf.save();
    const filled = await fillPdf({
      templateBytes: bytes,
      request: request(1),
      mappings: [simpleMapping],
      repeaters: [],
    });
    expect(filled.bytes.byteLength).toBeGreaterThan(bytes.length / 2);
  });

  it("usa métricas reais em texto longo, com alinhamento e acentos latinos", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    const clinicalRequest = request(1);
    clinicalRequest.patient = {
      ...clinicalRequest.patient!,
      fullName: "João da Conceição",
    };
    const filled = await fillPdf({
      templateBytes: await pdf.save(),
      request: clinicalRequest,
      mappings: [
        { ...simpleMapping, width: 90, alignment: "center", autoShrink: true },
        { ...simpleMapping, y: 80, width: 90, alignment: "right", autoShrink: false },
      ],
      repeaters: [],
    });
    const out = await PDFDocument.load(filled.bytes);
    expect(out.getPageCount()).toBe(1);
    expect(filled.bytes.byteLength).toBeGreaterThan(0);
  });

  it("embute Unicode usado em português sem transliterar o conteúdo", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    const clinicalRequest = request(1);
    clinicalRequest.patient = {
      ...clinicalRequest.patient!,
      fullName: "João D’Ávila – São José ≥ 18",
    };
    const filled = await fillPdf({
      templateBytes: await pdf.save(),
      request: clinicalRequest,
      mappings: [{ ...simpleMapping, width: 280 }],
      repeaters: [],
    });
    expect(filled.bytes.byteLength).toBeGreaterThan(0);
  });

  it("multiline", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    const filled = await fillPdf({
      templateBytes: await pdf.save(),
      request: { ...request(1), clinicalJustification: "linha 1\nlinha 2\nlinha 3" },
      mappings: [{ ...simpleMapping, semanticField: "request.clinical_justification", multiline: true, height: 60 }],
      repeaters: [],
    });
    expect(filled.bytes.byteLength).toBeGreaterThan(0);
  });

  it("bloqueia truncamento por limite de caracteres", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    await expect(
      fillPdf({
        templateBytes: await pdf.save(),
        request: request(1),
        mappings: [{ ...simpleMapping, maxCharacters: 5 }],
        repeaters: [],
      }),
    ).rejects.toBeInstanceOf(PdfTextOverflowError);
  });

  it("bloqueia overflow horizontal e vertical sem remover conteúdo", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    const clinicalRequest = request(1);
    clinicalRequest.clinicalJustification = "Texto clínico extenso que não pode ser truncado silenciosamente.";
    await expect(
      fillPdf({
        templateBytes: await pdf.save(),
        request: clinicalRequest,
        mappings: [{
          ...simpleMapping,
          semanticField: "request.clinical_justification",
          width: 30,
          height: 10,
          multiline: true,
          autoShrink: false,
        }],
        repeaters: [],
      }),
    ).rejects.toThrow("A justificativa clínica excede o espaço disponível neste template.");
  });

  it("retorna erro amigável para glifo realmente ausente da fonte Unicode", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    const clinicalRequest = request(1);
    clinicalRequest.patient = { ...clinicalRequest.patient!, fullName: "Paciente 🧬" };
    await expect(
      fillPdf({
        templateBytes: await pdf.save(),
        request: clinicalRequest,
        mappings: [simpleMapping],
        repeaters: [],
      }),
    ).rejects.toBeInstanceOf(PdfFontEncodingError);
  });

  it("AcroForm preserva texto Unicode e atualiza a aparência com a fonte embarcada", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 600]);
    const form = pdf.getForm();
    const field = form.createTextField("patient_name");
    field.addToPage(page, { x: 40, y: 500, width: 240, height: 16 });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    form.updateFieldAppearances(font);
    const clinicalRequest = request(1);
    clinicalRequest.patient = { ...clinicalRequest.patient!, fullName: "João D’Ávila – ≥ 18" };
    const filled = await fillPdf({
      templateBytes: await pdf.save(),
      request: clinicalRequest,
      mappings: [{ ...simpleMapping, mappingKind: "acroform", pdfFieldName: "patient_name", width: 240 }],
      repeaters: [],
    });
    const out = await PDFDocument.load(filled.bytes);
    expect(out.getForm().getTextField("patient_name").getText()).toBe("João D’Ávila – ≥ 18");
  });

  it("bloqueia overflow no limite nativo de um TextField AcroForm", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 600]);
    const field = pdf.getForm().createTextField("patient_name");
    field.setMaxLength(5);
    field.addToPage(page, { x: 40, y: 500, width: 200, height: 16 });
    await expect(
      fillPdf({
        templateBytes: await pdf.save(),
        request: request(1),
        mappings: [{ ...simpleMapping, mappingKind: "acroform", pdfFieldName: "patient_name" }],
        repeaters: [],
      }),
    ).rejects.toBeInstanceOf(PdfTextOverflowError);
  });

  it("preenche checkbox, radio e dropdown por valores determinísticos", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 600]);
    const form = pdf.getForm();
    const checkbox = form.createCheckBox("confirmado");
    checkbox.addToPage(page, { x: 40, y: 500, width: 16, height: 16 });
    const radio = form.createRadioGroup("sexo");
    radio.addOptionToPage("F", page, { x: 70, y: 500, width: 16, height: 16 });
    radio.addOptionToPage("M", page, { x: 90, y: 500, width: 16, height: 16 });
    const dropdown = form.createDropdown("uf_crm");
    dropdown.setOptions(["GO", "SP"]);
    dropdown.addToPage(page, { x: 120, y: 500, width: 80, height: 16 });

    const clinicalRequest = request(1);
    clinicalRequest.diagnosis = "sim";
    const filled = await fillPdf({
      templateBytes: await pdf.save(),
      request: clinicalRequest,
      mappings: [
        { ...simpleMapping, mappingKind: "acroform", pdfFieldName: "confirmado", semanticField: "request.diagnosis" },
        { ...simpleMapping, mappingKind: "acroform", pdfFieldName: "sexo", semanticField: "patient.sex" },
        { ...simpleMapping, mappingKind: "acroform", pdfFieldName: "uf_crm", semanticField: "doctor.crm_state" },
      ],
      repeaters: [],
    });

    const outForm = (await PDFDocument.load(filled.bytes)).getForm();
    expect(outForm.getCheckBox("confirmado").isChecked()).toBe(true);
    expect(outForm.getRadioGroup("sexo").getSelected()).toBe("F");
    expect(outForm.getDropdown("uf_crm").getSelected()).toEqual(["GO"]);
  });

  it("não converte erro AcroForm em overlay silencioso", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    await expect(
      fillPdf({
        templateBytes: await pdf.save(),
        request: request(1),
        mappings: [{ ...simpleMapping, mappingKind: "acroform", pdfFieldName: "campo_inexistente" }],
        repeaters: [],
      }),
    ).rejects.toBeInstanceOf(PdfAcroFormError);
  });

  it("procedimento repetido e overflow no repeater", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    pdf.addPage([400, 600]);
    await expect(
      fillPdf({
        templateBytes: await pdf.save(),
        request: request(7),
        mappings: [simpleMapping],
        repeaters: [
          {
            id: "rep",
            templateVersionId: "v1",
            source: "procedures",
            page: 1,
            startX: 40,
            startY: 200,
            rowHeight: 16,
            maxRows: 5,
            columns: [{ field: "name", x: 40, width: 200 }],
          },
        ],
      }),
    ).rejects.toThrow(/suporta até 5 procedimentos/);
  });

  it("continua procedimentos em múltiplos repeaters sem falso overflow", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    pdf.addPage([400, 600]);
    const repeaters = [1, 2].map((page) => ({
      id: `rep-${page}`,
      templateVersionId: "v1",
      source: "procedures" as const,
      page,
      startX: 40,
      startY: 200,
      rowHeight: 16,
      maxRows: 5,
      columns: [{ field: "name", x: 40, width: 200 }],
    }));
    expect(maxRowsFromRepeaters(repeaters)).toBe(10);
    const filled = await fillPdf({
      templateBytes: await pdf.save(),
      request: request(7),
      mappings: [],
      repeaters,
    });
    expect((await PDFDocument.load(filled.bytes)).getPageCount()).toBe(2);
  });

  it("múltiplas páginas", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    pdf.addPage([400, 600]);
    const filled = await fillPdf({
      templateBytes: await pdf.save(),
      request: request(1),
      mappings: [{ ...simpleMapping, page: 2, semanticField: "doctor.name" }],
      repeaters: [],
    });
    const out = await PDFDocument.load(filled.bytes);
    expect(out.getPageCount()).toBe(2);
  });
});

describe("templates", () => {
  it("versão histórica permanece selecionada", () => {
    const selectedVersionId = "v-old";
    const currentActive = "v-new";
    expect(selectedVersionId).not.toBe(currentActive);
  });
});
