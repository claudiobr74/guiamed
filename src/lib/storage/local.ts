import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "data", "storage");

export type StorageBucket = "pdf-templates" | "generated-documents" | "signatures";

export async function putObject(
  bucket: StorageBucket,
  organizationId: string,
  filename: string,
  bytes: Uint8Array,
): Promise<{ filePath: string; fileHash: string }> {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const relative = path.posix.join(bucket, organizationId, `${hash}-${filename}`);
  const full = path.join(ROOT, relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return { filePath: relative, fileHash: hash };
}

export async function getObject(filePath: string): Promise<Uint8Array> {
  const full = path.join(ROOT, filePath);
  const buf = await readFile(full);
  return new Uint8Array(buf);
}

export function publicFileUrl(filePath: string): string {
  return `/api/files/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}
