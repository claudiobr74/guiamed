import { afterEach, describe, expect, it, vi } from "vitest";
import { firebaseWebApiKey } from "./config";

describe("firebaseWebApiKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa a chave Web pública do guiamed-918ee quando a env não está no deploy", () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "");
    expect(firebaseWebApiKey()).toMatch(/^AIza/);
  });
});
