export const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "guiamed-918ee";

export const FIREBASE_AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${FIREBASE_PROJECT_ID}.firebaseapp.com`;

export const FIREBASE_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? `${FIREBASE_PROJECT_ID}.appspot.com`;

/** apiKey Web pública do app no projeto guiamed-918ee (não é a conta de serviço). */
const FIREBASE_WEB_API_KEY_DEFAULT = "AIzaSyAKihHLhd2aL9sapkJZHty1zgPpZQRdW7k";

export function firebaseWebApiKey(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || FIREBASE_WEB_API_KEY_DEFAULT;
}
