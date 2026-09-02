export const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "guiamed-918ee";

export const FIREBASE_AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${FIREBASE_PROJECT_ID}.firebaseapp.com`;

export const FIREBASE_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${FIREBASE_PROJECT_ID}.appspot.com`;

export function firebaseWebApiKey(): string {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) {
    throw new Error(
      "Configure NEXT_PUBLIC_FIREBASE_API_KEY com a chave Web do projeto Firebase guiamed-918ee (Console > Configurações do projeto).",
    );
  }
  return key;
}
