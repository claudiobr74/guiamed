import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { firebaseBucket, hasFirebaseAdminCredentials } from "@/lib/firebase/admin";

const LOCAL_ROOT = path.join(process.cwd(), "data", "storage");

export type StorageBucket = "pdf-templates" | "generated-documents" | "signatures";

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
  const relative = path.posix.join(bucket, organizationId, `${hash}-${filename}`);
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
  } else {
    const full = path.join(LOCAL_ROOT, relative);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }
  return { filePath: relative, fileHash: hash };
}

export async function getObject(filePath: string): Promise<Uint8Array> {
  if (hasFirebaseAdminCredentials()) {
    const [buf] = await firebaseBucket().file(filePath).download();
    return new Uint8Array(buf);
  }
  const full = path.join(LOCAL_ROOT, filePath);
  const buf = await readFile(full);
  return new Uint8Array(buf);
}

export function publicFileUrl(filePath: string): string {
  return `/api/files/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function fileContentType(filePath: string): string {
  return contentTypeFor(filePath);
}
