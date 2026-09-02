import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { firebaseBucket, hasFirebaseAdminCredentials } from "@/lib/firebase/admin";
import {
  buildStoragePath,
  requireAuthorizedStoragePath,
  type StorageBucket,
} from "@/lib/storage/path";

export type { StorageBucket } from "@/lib/storage/path";

const LOCAL_ROOT = path.join(process.cwd(), "data", "storage");

function contentTypeFor(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export async function putObject(
  bucket: StorageBucket,
  organizationId: string,
  filename: string,
  bytes: Uint8Array,
): Promise<{ filePath: string; fileHash: string }> {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const relative = buildStoragePath(bucket, organizationId, `${hash}-${filename}`);
  if (hasFirebaseAdminCredentials()) {
    await firebaseBucket()
      .file(relative)
      .save(Buffer.from(bytes), {
        resumable: false,
        private: true,
        contentType: contentTypeFor(filename),
        metadata: {
          metadata: {
            organizationId,
            bucket,
          },
        },
      });
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("Firebase Storage exige credencial Admin em produção (projeto guiamed-918ee).");
  } else {
    const full = path.join(LOCAL_ROOT, relative);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }
  return { filePath: relative, fileHash: hash };
}

export async function getObject(
  filePath: string,
  organizationId: string,
): Promise<Uint8Array> {
  const authorizedPath = requireAuthorizedStoragePath(filePath, organizationId);
  if (hasFirebaseAdminCredentials()) {
    const [buf] = await firebaseBucket().file(authorizedPath).download();
    return new Uint8Array(buf);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Firebase Storage exige credencial Admin em produção (projeto guiamed-918ee).");
  }
  const full = path.join(LOCAL_ROOT, authorizedPath);
  const buf = await readFile(full);
  return new Uint8Array(buf);
}

export async function deleteObject(
  filePath: string,
  organizationId: string,
): Promise<void> {
  const authorizedPath = requireAuthorizedStoragePath(filePath, organizationId);
  if (hasFirebaseAdminCredentials()) {
    await firebaseBucket().file(authorizedPath).delete({ ignoreNotFound: true });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Firebase Storage exige credencial Admin em produção (projeto guiamed-918ee).");
  }
  try {
    await unlink(path.join(LOCAL_ROOT, authorizedPath));
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
}

export function publicFileUrl(filePath: string): string {
  return `/api/files/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function fileContentType(filePath: string): string {
  return contentTypeFor(filePath);
}
