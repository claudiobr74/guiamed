import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const guardUrl = pathToFileURL(path.join(process.cwd(), "scripts", "e2e-project-guard.mjs")).href;

function runGuard(projectId: string, databaseId: string, storageBucket: string) {
  const source = `
    import { assertSafeE2EProject } from ${JSON.stringify(guardUrl)};
    assertSafeE2EProject(${JSON.stringify({ projectId, databaseId, storageBucket })});
  `;
  return spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    cwd: process.cwd(),
    encoding: "utf-8",
  });
}

describe("E2E Firebase project guard", () => {
  it("permite um projeto sintético coerente", () => {
    const result = runGuard(
      "guiamed-e2e-test",
      "e2e-database",
      "guiamed-e2e-test.firebasestorage.app",
    );
    expect(result.status).toBe(0);
  });

  it("recusa o projeto Firebase de produção", () => {
    const result = runGuard(
      "guiamed-918ee",
      "e2e-database",
      "guiamed-918ee.firebasestorage.app",
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("projeto Firebase de produção");
  });

  it("recusa bucket pertencente a outro projeto", () => {
    const result = runGuard(
      "guiamed-e2e-test",
      "e2e-database",
      "outro-projeto.firebasestorage.app",
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("bucket não corresponde");
  });
});
