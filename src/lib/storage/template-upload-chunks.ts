import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { hasFirebaseAdminCredentials, withFirebaseBucket } from "@/lib/firebase/admin";

const LOCAL_ROOT = path.join(process.cwd(), "data", "storage");
const TEMP_PREFIX = "template-upload-chunks";

function safeId(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error(`${label} inválido para upload.`);
  }
  return normalized;
}

export function templateUploadChunkPath(
  organizationId: string,
  sessionId: string,
  index: number,
): string {
  if (!Number.isInteger(index) || index < 0) throw new Error("Parte de upload inválida.");
  return [
    TEMP_PREFIX,
    safeId(organizationId, "Organização"),
    safeId(sessionId, "Sessão"),
    `${index}.part`,
  ].join("/");
}

export async function putTemplateUploadChunk(
  organizationId: string,
  sessionId: string,
  index: number,
  bytes: Uint8Array,
): Promise<string> {
  const filePath = templateUploadChunkPath(organizationId, sessionId, index);
  if (hasFirebaseAdminCredentials()) {
    await withFirebaseBucket((bucket) =>
      bucket.file(filePath).save(Buffer.from(bytes), {
        resumable: false,
        private: true,
        contentType: "application/octet-stream",
        metadata: {
          metadata: {
            organizationId,
            uploadSessionId: sessionId,
            chunkIndex: String(index),
          },
        },
      }),
    );
    return filePath;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Firebase Storage não está configurado para uploads privados.");
  }
  const full = path.join(LOCAL_ROOT, filePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return filePath;
}

export async function getTemplateUploadChunk(
  organizationId: string,
  sessionId: string,
  index: number,
): Promise<Uint8Array> {
  const filePath = templateUploadChunkPath(organizationId, sessionId, index);
  if (hasFirebaseAdminCredentials()) {
    return withFirebaseBucket(async (bucket) => {
      const [buffer] = await bucket.file(filePath).download();
      return new Uint8Array(buffer);
    });
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Firebase Storage não está configurado para uploads privados.");
  }
  const buffer = await readFile(path.join(LOCAL_ROOT, filePath));
  return new Uint8Array(buffer);
}

export async function deleteTemplateUploadChunks(
  organizationId: string,
  sessionId: string,
  count: number,
): Promise<void> {
  if (!Number.isInteger(count) || count < 0) return;
  await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const filePath = templateUploadChunkPath(organizationId, sessionId, index);
      if (hasFirebaseAdminCredentials()) {
        await withFirebaseBucket((bucket) =>
          bucket.file(filePath).delete({ ignoreNotFound: true }).then(() => undefined),
        );
        return;
      }
      if (process.env.NODE_ENV === "production") return;
      try {
        await unlink(path.join(LOCAL_ROOT, filePath));
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
        if (code !== "ENOENT") throw error;
      }
    }),
  );
}
