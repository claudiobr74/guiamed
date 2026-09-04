import { afterEach, describe, expect, it, vi } from "vitest";
import { firebaseStorageBucketNames, firebaseWebApiKey, firestoreDatabaseId } from "./config";

describe("firebase config", () => {
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

  it("prefere bucket Firebase moderno e mantém fallback legado", () => {
    expect(firebaseStorageBucketNames("guiamed-918ee", "")).toEqual([
      "guiamed-918ee.firebasestorage.app",
      "guiamed-918ee.appspot.com",
    ]);
  });

  it("tenta primeiro um bucket explicitamente configurado sem duplicar candidatos", () => {
    expect(firebaseStorageBucketNames("guiamed-918ee", "custom-bucket.example")).toEqual([
      "custom-bucket.example",
      "guiamed-918ee.firebasestorage.app",
      "guiamed-918ee.appspot.com",
    ]);
  });
});
