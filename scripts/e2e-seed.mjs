import { createHash } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

const serviceAccount = JSON.parse(required("E2E_FIREBASE_SERVICE_ACCOUNT"));
const projectId = serviceAccount.project_id;
if (!projectId) throw new Error("E2E_FIREBASE_SERVICE_ACCOUNT sem project_id.");

const databaseId = required("E2E_FIRESTORE_DATABASE_ID");
const storageBucket = required("E2E_FIREBASE_STORAGE_BUCKET");
const email = required("E2E_USER_EMAIL").toLowerCase();
const password = required("E2E_USER_PASSWORD");

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId,
  storageBucket,
});
const auth = getAuth(app);
const db = getFirestore(app, databaseId);
const bucket = getStorage(app).bucket(storageBucket);

const ids = {
  organization: "e2e-guiamed",
  patient: "e2e-patient",
  doctor: "e2e-doctor",
  insurer: "e2e-insurer",
  institution: "e2e-institution",
  procedure: "e2e-procedure",
  tuss: "e2e-tuss-2026",
  ipasgo: "e2e-ipasgo-2026",
  kit: "e2e-kit",
  template: "e2e-template",
  templateVersion: "e2e-template-v1",
};

const now = new Date().toISOString();

async function ensureUser() {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    user = await auth.updateUser(user.uid, {
      email,
      password,
      displayName: "Médico E2E GuiaMed",
      disabled: false,
    });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    user = await auth.createUser({
      email,
      password,
      displayName: "Médico E2E GuiaMed",
      emailVerified: true,
    });
  }
  return user;
}

async function deleteCollection(collectionRef) {
  const snapshot = await collectionRef.get();
  if (snapshot.empty) return;
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = db.batch();
    snapshot.docs.slice(offset, offset + 400).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function buildTemplatePdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("GuiaMed - template E2E", { x: 40, y: 800, size: 14, font, color: rgb(0, 0, 0) });
  page.drawText("Paciente:", { x: 40, y: 760, size: 10, font });
  page.drawText("Medico:", { x: 40, y: 730, size: 10, font });
  page.drawText("CRM:", { x: 350, y: 730, size: 10, font });
  page.drawText("CID:", { x: 40, y: 700, size: 10, font });
  page.drawText("Procedimentos:", { x: 40, y: 650, size: 10, font });
  page.drawText("Justificativa:", { x: 40, y: 520, size: 10, font });
  return new Uint8Array(await pdf.save());
}

const user = await ensureUser();
const org = db.collection("organizations").doc(ids.organization);

await Promise.all([
  deleteCollection(org.collection("requests")),
  deleteCollection(org.collection("generatedDocuments")),
]);
await bucket.deleteFiles({ prefix: `generated-documents/${ids.organization}/` }).catch(() => undefined);

const templateBytes = await buildTemplatePdf();
const templateHash = createHash("sha256").update(templateBytes).digest("hex");
const templatePath = `pdf-templates/${ids.organization}/${templateHash}-e2e-template.pdf`;
await bucket.file(templatePath).save(Buffer.from(templateBytes), {
  resumable: false,
  contentType: "application/pdf",
  metadata: {
    metadata: {
      organizationId: ids.organization,
      bucket: "pdf-templates",
      purpose: "e2e",
    },
  },
});

await Promise.all([
  org.set({
    name: "Organização E2E GuiaMed",
    cnpj: null,
    phone: null,
    email,
    address: null,
    createdAt: now,
    updatedAt: now,
  }, { merge: true }),
  db.collection("users").doc(user.uid).set({
    organizationId: ids.organization,
    role: "admin",
    fullName: "Médico E2E GuiaMed",
    email,
    active: true,
    createdAt: now,
    updatedAt: now,
  }, { merge: true }),
  org.collection("healthInsurers").doc(ids.insurer).set({
    name: "Convênio E2E",
    code: "E2E",
    active: true,
    updatedAt: now,
  }, { merge: true }),
  org.collection("institutions").doc(ids.institution).set({
    kind: "hospital",
    name: "Hospital E2E",
    city: "Goiânia",
    state: "GO",
    cnpj: null,
    phone: null,
    active: true,
    updatedAt: now,
  }, { merge: true }),
  org.collection("doctors").doc(ids.doctor).set({
    name: "Dr. E2E GuiaMed",
    crm: "12345",
    crmState: "GO",
    cpf: null,
    specialty: "Cirurgia",
    rqe: null,
    phone: null,
    email,
    signatureFile: null,
    signatureKind: "image",
    isDefault: true,
    active: true,
    updatedAt: now,
  }, { merge: true }),
  org.collection("patients").doc(ids.patient).set({
    fullName: "Paciente E2E GuiaMed",
    birthDate: "1980-01-15",
    cpf: "00000000000",
    sex: "F",
    phone: null,
    email: null,
    insuranceCard: "E2E-0001",
    healthInsurerId: ids.insurer,
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
  }, { merge: true }),
  org.collection("procedures").doc(ids.procedure).set({
    name: "Procedimento E2E GuiaMed",
    description: "Procedimento sintético exclusivo para teste E2E.",
    specialty: "Cirurgia",
    category: "E2E",
    synonyms: ["teste e2e"],
    active: true,
    updatedAt: now,
  }, { merge: true }),
  org.collection("procedureCodes").doc(ids.tuss).set({
    procedureId: ids.procedure,
    codeSystem: "TUSS",
    code: "12345678",
    description: "Procedimento E2E TUSS",
    validFrom: "2026-01-01",
    validUntil: null,
    version: "2026.1",
    active: true,
    healthInsurerId: ids.insurer,
    defaultQuantity: 2,
    metadata: { source: "e2e" },
    updatedAt: now,
  }, { merge: true }),
  org.collection("procedureCodes").doc(ids.ipasgo).set({
    procedureId: ids.procedure,
    codeSystem: "IPASGO",
    code: "87654321",
    description: "Procedimento E2E IPASGO",
    validFrom: "2026-01-01",
    validUntil: null,
    version: "2026.1",
    active: true,
    healthInsurerId: ids.insurer,
    defaultQuantity: 2,
    metadata: { source: "e2e" },
    updatedAt: now,
  }, { merge: true }),
  org.collection("kits").doc(ids.kit).set({
    name: "Kit E2E GuiaMed",
    description: "Kit sintético para validar o fluxo clínico real.",
    specialty: "Cirurgia",
    active: true,
    items: [{
      id: `${ids.kit}_0`,
      kitId: ids.kit,
      procedureId: ids.procedure,
      procedureName: "Procedimento E2E GuiaMed",
      defaultQuantity: 2,
      defaultCodeId: ids.tuss,
      notes: "E2E",
      sortOrder: 0,
    }],
    updatedAt: now,
  }, { merge: true }),
  org.collection("templates").doc(ids.template).set({
    name: "Template E2E GuiaMed",
    institutionId: ids.institution,
    healthInsurerId: ids.insurer,
    documentType: "surgical_request",
    active: true,
    updatedAt: now,
  }, { merge: true }),
]);

await db.collection("templateVersions").doc(ids.templateVersion).set({
  organizationId: ids.organization,
  templateId: ids.template,
  version: 1,
  filePath: templatePath,
  fileHash: templateHash,
  pageCount: 1,
  pageWidth: 595,
  pageHeight: 842,
  hasAcroform: false,
  acroformFields: [],
  active: true,
  createdAt: now,
  createdBy: user.uid,
  mappings: [
    { id: "e2e-map-patient", templateVersionId: ids.templateVersion, semanticField: "patient.full_name", pdfFieldName: null, mappingKind: "overlay", page: 1, x: 100, y: 72, width: 420, height: 18, fontSize: 10, alignment: "left", multiline: false, autoShrink: true, maxCharacters: null, required: true },
    { id: "e2e-map-doctor", templateVersionId: ids.templateVersion, semanticField: "doctor.name", pdfFieldName: null, mappingKind: "overlay", page: 1, x: 100, y: 102, width: 230, height: 18, fontSize: 10, alignment: "left", multiline: false, autoShrink: true, maxCharacters: null, required: true },
    { id: "e2e-map-crm", templateVersionId: ids.templateVersion, semanticField: "doctor.crm", pdfFieldName: null, mappingKind: "overlay", page: 1, x: 390, y: 102, width: 130, height: 18, fontSize: 10, alignment: "left", multiline: false, autoShrink: true, maxCharacters: null, required: true },
    { id: "e2e-map-cid", templateVersionId: ids.templateVersion, semanticField: "request.cid", pdfFieldName: null, mappingKind: "overlay", page: 1, x: 100, y: 132, width: 420, height: 18, fontSize: 10, alignment: "left", multiline: false, autoShrink: true, maxCharacters: null, required: true },
    { id: "e2e-map-justification", templateVersionId: ids.templateVersion, semanticField: "request.clinical_justification", pdfFieldName: null, mappingKind: "overlay", page: 1, x: 40, y: 340, width: 500, height: 130, fontSize: 10, alignment: "left", multiline: true, autoShrink: true, maxCharacters: null, required: true },
  ],
  repeaters: [{
    id: "e2e-repeater",
    templateVersionId: ids.templateVersion,
    source: "procedures",
    page: 1,
    startX: 40,
    startY: 210,
    rowHeight: 20,
    maxRows: 5,
    columns: [
      { field: "name", x: 40, width: 260, fontSize: 9 },
      { field: "tuss", x: 305, width: 80, fontSize: 9 },
      { field: "ipasgo", x: 390, width: 80, fontSize: 9 },
      { field: "quantity", x: 475, width: 45, fontSize: 9 },
    ],
  }],
  updatedAt: now,
}, { merge: true });

console.log(JSON.stringify({
  ok: true,
  projectId,
  databaseId,
  storageBucket,
  organizationId: ids.organization,
  userId: user.uid,
  email,
}, null, 2));
