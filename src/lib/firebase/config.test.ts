import { afterEach, describe, expect, it, vi } from "vitest";
import { firebaseWebApiKey, firestoreDatabaseId } from "./config";

describe("firebaseWebApiKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa a chave Web pública do guiamed-918ee quando a env não está no deploy", () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "");
    expect(firebaseWebApiKey()).toMatch(/^AIza/);
  });

  it("aponta para o Firestore Native existente quando FIRESTORE_DATABASE_ID não está definido", () => {
    vi.stubEnv("FIRESTORE_DATABASE_ID", "");
    expect(firestoreDatabaseId()).toMatch(/^ai-studio-/);
  });
});
