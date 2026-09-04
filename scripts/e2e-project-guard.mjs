const PRODUCTION_PROJECT_ID = "guiamed-918ee";
const PRODUCTION_DATABASE_ID = "ai-studio-guiamedsolicitae-e090242c-1b88-48ed-bec4-66ce94a3a712";

export function assertSafeE2EProject({ projectId, databaseId, storageBucket }) {
  const project = String(projectId ?? "").trim();
  const database = String(databaseId ?? "").trim();
  const bucket = String(storageBucket ?? "").trim();

  if (!project || !database || !bucket) {
    throw new Error("Configuração E2E incompleta para validar o projeto Firebase.");
  }

  if (
    project === PRODUCTION_PROJECT_ID ||
    database === PRODUCTION_DATABASE_ID ||
    bucket === `${PRODUCTION_PROJECT_ID}.firebasestorage.app` ||
    bucket === `${PRODUCTION_PROJECT_ID}.appspot.com`
  ) {
    throw new Error("E2E recusado: a configuração aponta para o projeto Firebase de produção.");
  }

  const allowedBuckets = new Set([
    `${project}.firebasestorage.app`,
    `${project}.appspot.com`,
  ]);
  if (!allowedBuckets.has(bucket)) {
    throw new Error("E2E recusado: o bucket não corresponde ao project_id da conta de serviço.");
  }

  return true;
}
