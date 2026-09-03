export const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "guiamed-918ee";

export const FIREBASE_AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${FIREBASE_PROJECT_ID}.firebaseapp.com`;

/**
 * Buckets padrão provisionados pelo Firebase desde 30/10/2024 usam
 * PROJECT_ID.firebasestorage.app. Mantemos compatibilidade explícita com o
 * formato legado PROJECT_ID.appspot.com para projetos/buckets antigos.
 */
export const FIREBASE_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
  `${FIREBASE_PROJECT_ID}.firebasestorage.app`;

export function firebaseStorageBucketNames(
  projectId = FIREBASE_PROJECT_ID,
  configured = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || "",
): string[] {
  return [...new Set([
    configured,
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ].filter(Boolean))];
}

/**
 * O projeto guiamed-918ee ainda não tem o banco `(default)`.
 * A conta Admin não consegue criá-lo (falta Owner). O Firestore Native
 * existente é o banco nomeado do AI Studio.
 */
const FIRESTORE_DATABASE_ID_DEFAULT =
  "ai-studio-guiamedsolicitae-e090242c-1b88-48ed-bec4-66ce94a3a712";

export function firestoreDatabaseId(): string {
  return process.env.FIRESTORE_DATABASE_ID?.trim() || FIRESTORE_DATABASE_ID_DEFAULT;
}

/** apiKey Web pública do app no projeto guiamed-918ee (não é a conta de serviço). */
const FIREBASE_WEB_API_KEY_DEFAULT = "AIzaSyAKihHLhd2aL9sapkJZHty1zgPpZQRdW7k";

export function firebaseWebApiKey(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || FIREBASE_WEB_API_KEY_DEFAULT;
}
