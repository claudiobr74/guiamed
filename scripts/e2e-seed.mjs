import { assertSafeE2EProject } from "./e2e-project-guard.mjs";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

const serviceAccount = JSON.parse(required("E2E_FIREBASE_SERVICE_ACCOUNT"));
const projectId = serviceAccount.project_id;
if (!projectId) throw new Error("E2E_FIREBASE_SERVICE_ACCOUNT sem project_id.");

assertSafeE2EProject({
  projectId,
  databaseId: required("E2E_FIRESTORE_DATABASE_ID"),
  storageBucket: required("E2E_FIREBASE_STORAGE_BUCKET"),
});

await import("./e2e-seed-impl.mjs");
