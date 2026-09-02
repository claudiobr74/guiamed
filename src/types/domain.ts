export type UserRole = "admin" | "doctor";
export type RequestStatus = "draft" | "finalized" | "cancelled";
export type InstitutionKind = "hospital" | "clinic" | "operator" | "insurer";
export type Sex = "F" | "M" | "I";
export type MappingKind = "overlay" | "acroform";
export type TextAlignment = "left" | "center" | "right";
export type ImportFormat = "csv" | "xlsx" | "json";
export type SignatureKind = "image" | "icp_brasil_placeholder";

export interface Organization {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  organizationId: string;
  role: UserRole;
  fullName: string;
  email: string;
  active: boolean;
}

export interface Patient {
  id: string;
  organizationId: string;
  fullName: string;
  birthDate: string | null;
  cpf: string | null;
  sex: Sex | null;
  phone: string | null;
  email: string | null;
  insuranceCard: string | null;
  healthInsurerId: string | null;
  healthInsurerName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  organizationId: string;
  name: string;
  crm: string;
  crmState: string;
  cpf: string | null;
  specialty: string | null;
  rqe: string | null;
  phone: string | null;
  email: string | null;
  signatureFile: string | null;
  signatureKind: SignatureKind;
  isDefault: boolean;
  active: boolean;
}

export interface Institution {
  id: string;
  organizationId: string;
  kind: InstitutionKind;
  name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  active: boolean;
}

export interface HealthInsurer {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  active: boolean;
}

export interface Procedure {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  specialty: string | null;
  category: string | null;
  active: boolean;
  synonyms: string[];
  codes: ProcedureCode[];
}

export interface ProcedureCode {
  id: string;
  procedureId: string | null;
  codeSystem: string;
  code: string;
  description: string;
  validFrom: string | null;
  validUntil: string | null;
  version: string;
  active: boolean;
  /** Operadora específica, quando o código não for geral. */
  healthInsurerId: string | null;
  /** Quantidade sugerida ao incluir este código. Legado sem campo equivale a 1. */
  defaultQuantity: number;
  metadata: Record<string, string | number | boolean | null>;
}

export interface CidCode {
  id: string;
  code: string;
  description: string;
  version: string;
  active: boolean;
  classification: "+" | "*" | null;
  sexRestriction: "F" | "M" | null;
  unlikelyCauseOfDeath: boolean;
  reference: string | null;
  excluded: string | null;
}

export interface ProcedureKit {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  specialty: string | null;
  active: boolean;
  items: ProcedureKitItem[];
}

export interface ProcedureKitItem {
  id: string;
  kitId: string;
  procedureId: string;
  procedureName: string;
  defaultQuantity: number;
  defaultCodeId: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface DocumentTemplate {
  id: string;
  organizationId: string;
  name: string;
  institutionId: string | null;
  healthInsurerId: string | null;
  documentType: string;
  active: boolean;
  currentVersion?: TemplateVersion | null;
  versions?: TemplateVersion[];
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  filePath: string;
  fileHash: string;
  pageCount: number;
  pageWidth: number | null;
  pageHeight: number | null;
  hasAcroform: boolean;
  acroformFields: AcroFormField[];
  active: boolean;
  createdAt: string;
  createdBy: string | null;
}

export interface AcroFormField {
  name: string;
  type: string;
  page: number | null;
}

export interface FieldMapping {
  id: string;
  templateVersionId: string;
  semanticField: string;
  pdfFieldName: string | null;
  mappingKind: MappingKind;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  alignment: TextAlignment;
  multiline: boolean;
  autoShrink: boolean;
  maxCharacters: number | null;
  required: boolean;
}

export interface RepeaterColumn {
  field: string;
  x: number;
  width: number;
  fontSize?: number;
}

export interface PdfRepeater {
  id: string;
  templateVersionId: string;
  source: "procedures";
  page: number;
  startX: number;
  startY: number;
  rowHeight: number;
  maxRows: number;
  columns: RepeaterColumn[];
}

export interface RequestItem {
  id: string;
  requestId: string;
  procedureId: string | null;
  procedureName: string;
  tussCodeId: string | null;
  ipasgoCodeId: string | null;
  tussCodeSnapshot: string | null;
  ipasgoCodeSnapshot: string | null;
  tussDescriptionSnapshot?: string | null;
  ipasgoDescriptionSnapshot?: string | null;
  tussVersionSnapshot?: string | null;
  ipasgoVersionSnapshot?: string | null;
  quantity: number;
  laterality: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface RequestCid {
  id: string;
  requestId: string;
  cidCodeId: string | null;
  codeSnapshot: string;
  descriptionSnapshot: string;
  sortOrder: number;
}

export interface SurgicalRequest {
  id: string;
  organizationId: string;
  patientId: string | null;
  doctorId: string | null;
  institutionId: string | null;
  healthInsurerId: string | null;
  templateId: string | null;
  templateVersionId: string | null;
  diagnosis: string | null;
  clinicalJustification: string | null;
  clinicalNotes: string | null;
  status: RequestStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  duplicatedFromId: string | null;
  patient?: Patient | null;
  doctor?: Doctor | null;
  institution?: Institution | null;
  healthInsurer?: HealthInsurer | null;
  template?: DocumentTemplate | null;
  items: RequestItem[];
  cids: RequestCid[];
}

export interface GeneratedDocument {
  id: string;
  requestId: string;
  templateVersionId: string;
  filePath: string;
  fileHash: string;
  createdAt: string;
  createdBy: string | null;
}

export interface SessionUser {
  id: string;
  organizationId: string;
  role: UserRole;
  fullName: string;
  email: string;
}

export const CODE_NOT_FOUND = "Código não localizado na base.";
export const DEFAULT_PROCEDURE_QUANTITY = 1;
