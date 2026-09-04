import { describe, expect, it } from "vitest";
import { materializeRequestItems } from "@/lib/requests/materialize-items";
import { validateRequestForFinalization } from "@/lib/requests/finalization-validation";
import type {
  DocumentTemplate,
  Procedure,
  ProcedureCode,
  RequestItem,
  SurgicalRequest,
  TemplateVersion,
} from "@/types/domain";

const createdAt = "2026-09-02T00:00:00Z";
const TABLE_KEY = "unimed-go";
const TABLE_NAME = "Unimed Goiânia";

function code(input: Partial<ProcedureCode> & Pick<ProcedureCode, "id" | "codeSystem" | "code">): ProcedureCode {
  return {
    id: input.id,
    procedureId: input.procedureId ?? "procedure-1",
    codeSystem: input.codeSystem,
    code: input.code,
    description: input.description ?? `${input.codeSystem} oficial sintético`,
    validFrom: input.validFrom ?? "2026-01-01",
    validUntil: input.validUntil ?? null,
    version: input.version ?? "2026.1",
    active: input.active ?? true,
    tableKey: input.tableKey ?? (input.codeSystem === "TUSS" ? TABLE_KEY : null),
    tableName: input.tableName ?? (input.codeSystem === "TUSS" ? TABLE_NAME : null),
    healthInsurerId: input.healthInsurerId ?? null,
    defaultQuantity: input.defaultQuantity ?? 1,
    metadata: input.metadata ?? {},
  };
}

const codes: ProcedureCode[] = [
  code({ id: "tuss-general", codeSystem: "TUSS", code: "31403019", defaultQuantity: 2 }),
  code({ id: "tuss-insurer", codeSystem: "TUSS", code: "31403020", healthInsurerId: "insurer-1", version: "2026.2", defaultQuantity: 4 }),
  code({ id: "tuss-other-table", codeSystem: "TUSS", code: "99999999", tableKey: "outra-tabela", tableName: "Outra Tabela", version: "2026.9", defaultQuantity: 9 }),
  code({ id: "ipasgo-legacy", codeSystem: "IPASGO", code: "IPG-001", defaultQuantity: 1 }),
];

const procedures: Procedure[] = [
  {
    id: "procedure-1",
    organizationId: "org-1",
    name: "Procedimento sintético",
    description: null,
    specialty: null,
    category: null,
    active: true,
    synonyms: [],
    codes,
  },
];

const template: DocumentTemplate = {
  id: "template-1",
  organizationId: "org-1",
  name: "Guia oficial",
  institutionId: "institution-1",
  healthInsurerId: "insurer-1",
  documentType: "surgical_request",
  active: true,
};

const version: TemplateVersion = {
  id: "version-1",
  templateId: template.id,
  version: 1,
  filePath: "pdf-templates/org-1/template.pdf",
  fileHash: "hash",
  pageCount: 1,
  pageWidth: 595,
  pageHeight: 842,
  hasAcroform: false,
  acroformFields: [],
  active: true,
  createdAt,
  createdBy: "user-1",
};

function baseRequest(items: RequestItem[]): SurgicalRequest {
  return {
    id: "request-1",
    organizationId: "org-1",
    patientId: "patient-1",
    doctorId: "doctor-1",
    institutionId: "institution-1",
    healthInsurerId: "insurer-1",
    templateId: template.id,
    templateVersionId: version.id,
    tussTableKey: TABLE_KEY,
    tussTableName: TABLE_NAME,
    diagnosis: "Diagnóstico sintético",
    clinicalJustification: "Justificativa clínica revisada.",
    clinicalNotes: null,
    status: "draft",
    revision: 3,
    createdBy: "user-1",
    createdAt,
    updatedAt: createdAt,
    finalizedAt: null,
    duplicatedFromId: null,
    patient: {
      id: "patient-1",
      organizationId: "org-1",
      fullName: "Paciente Sintético",
      birthDate: null,
      cpf: null,
      sex: null,
      phone: null,
      email: null,
      insuranceCard: null,
      healthInsurerId: "insurer-1",
      healthInsurerName: "Convênio Sintético",
      createdAt,
      updatedAt: createdAt,
    },
    doctor: {
      id: "doctor-1",
      organizationId: "org-1",
      name: "Médico Sintético",
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
    institution: {
      id: "institution-1",
      organizationId: "org-1",
      kind: "hospital",
      name: "Hospital Sintético",
      cnpj: null,
      city: "Goiânia",
      state: "GO",
      phone: null,
      active: true,
    },
    items,
    cids: [
      {
        id: "cid-item-1",
        requestId: "request-1",
        cidCodeId: "cid-1",
        codeSnapshot: "M50.1",
        descriptionSnapshot: "Transtorno sintético de disco cervical",
        sortOrder: 0,
      },
    ],
  };
}

describe("fluxo clínico integrado", () => {
  it("materializa somente a Tabela TUSS escolhida e passa pelos gates de finalização", () => {
    const clientItem: RequestItem = {
      id: "item-1",
      requestId: "client-request",
      procedureId: "procedure-1",
      procedureName: "NOME ADULTERADO",
      tussCodeId: null,
      ipasgoCodeId: "ipasgo-legacy",
      tussCodeSnapshot: "FAKE",
      ipasgoCodeSnapshot: "FAKE",
      quantity: 4,
      laterality: null,
      notes: null,
      sortOrder: 99,
    };

    const items = materializeRequestItems({
      requestId: "request-1",
      items: [clientItem],
      procedures,
      codes,
      healthInsurerId: "insurer-1",
      tussTableKey: TABLE_KEY,
      at: new Date("2026-09-02T12:00:00Z"),
    });

    expect(items[0]).toMatchObject({
      procedureName: "Procedimento sintético",
      tussCodeId: "tuss-insurer",
      tussCodeSnapshot: "31403020",
      ipasgoCodeId: null,
      ipasgoCodeSnapshot: null,
      quantity: 4,
      sortOrder: 0,
    });

    const request = baseRequest(items);
    const issues = validateRequestForFinalization({
      request,
      template,
      version,
      mappings: [
        {
          id: "mapping-cid",
          templateVersionId: version.id,
          semanticField: "request.cid",
          pdfFieldName: null,
          mappingKind: "overlay",
          page: 1,
          x: 0,
          y: 0,
          width: 100,
          height: 20,
          fontSize: 10,
          alignment: "left",
          multiline: false,
          autoShrink: true,
          maxCharacters: null,
          required: true,
        },
      ],
      repeaters: [
        {
          id: "procedures",
          templateVersionId: version.id,
          source: "procedures",
          page: 1,
          startX: 0,
          startY: 100,
          rowHeight: 15,
          maxRows: 10,
          columns: [
            { field: "tussCode", x: 0, width: 80 },
          ],
        },
      ],
    });

    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("rejeita código específico de outro convênio mesmo quando o cliente envia o id", () => {
    const wrongInsurerCode = code({
      id: "tuss-other-insurer",
      codeSystem: "TUSS",
      code: "31403999",
      healthInsurerId: "insurer-2",
    });
    const maliciousItem: RequestItem = {
      id: "item-1",
      requestId: "request-1",
      procedureId: "procedure-1",
      procedureName: "Procedimento sintético",
      tussCodeId: wrongInsurerCode.id,
      ipasgoCodeId: null,
      tussCodeSnapshot: wrongInsurerCode.code,
      ipasgoCodeSnapshot: null,
      quantity: 1,
      laterality: null,
      notes: null,
      sortOrder: 0,
    };

    expect(() =>
      materializeRequestItems({
        requestId: "request-1",
        items: [maliciousItem],
        procedures,
        codes: [...codes, wrongInsurerCode],
        healthInsurerId: "insurer-1",
        tussTableKey: TABLE_KEY,
        at: new Date("2026-09-02T12:00:00Z"),
      }),
    ).toThrow(/convênio selecionado/);
  });
});
