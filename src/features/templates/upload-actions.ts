"use server";

import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/current";
import { orgCollection, withOrganizationContext, type Db } from "@/lib/db/client";
import {
  createTemplateVersionTransactional,
  validateTemplateVersionTargets,
} from "@/lib/db/template-version-write";
import { inspectPdf } from "@/lib/pdf/inspect";
import {
  TEMPLATE_UPLOAD_CHUNK_BYTES,
  TEMPLATE_UPLOAD_SESSION_TTL_MS,
  templateUploadChunkBounds,
  templateUploadChunkCount,
  templateUploadSessionExpired,
} from "@/lib/pdf/template-upload";
import { validatePdfUploadMetadata } from "@/lib/pdf/upload-validation";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { deleteObject, putObject } from "@/lib/storage";
import { safeStorageFilename } from "@/lib/storage/path";
import {
  deleteTemplateUploadChunks,
  getTemplateUploadChunk,
  putTemplateUploadChunk,
} from "@/lib/storage/template-upload-chunks";

type UploadSessionStatus = "uploading" | "assembling" | "completed" | "failed" | "cancelled";

type TemplateUploadSession = {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  templateId: string | null;
  institutionId: string | null;
  healthInsurerId: string | null;
  chunkSize: number;
  chunkCount: number;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  status: UploadSessionStatus;
  templateVersionId?: string | null;
};

type ActionFailure = { ok: false; error: string };

function safeUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const safePrefixes = [
    "O PDF ",
    "O arquivo ",
    "PDF ",
    "Template ",
    "Instituição ",
    "Convênio/operadora ",
    "Parte de upload ",
    "Tamanho de PDF ",
    "Limite ",
    "Muitas tentativas",
  ];
  if (safePrefixes.some((prefix) => message.startsWith(prefix))) return message;
  if (message.includes("Firebase Storage")) {
    return "Não foi possível acessar o armazenamento privado do Firebase. Verifique a configuração do Storage na Vercel.";
  }
  return "Não foi possível enviar o PDF. Tente novamente.";
}

function logUploadError(operation: string, error: unknown, sessionId?: string) {
  console.error("Falha no upload de template PDF", {
    operation,
    sessionId: sessionId ?? null,
    error: error instanceof Error ? error.message : String(error),
  });
}

function mapSession(id: string, data: FirebaseFirestore.DocumentData): TemplateUploadSession {
  return {
    id,
    name: String(data.name ?? ""),
    fileName: String(data.fileName ?? ""),
    fileType: String(data.fileType ?? "application/pdf"),
    fileSize: Number(data.fileSize ?? 0),
    templateId: (data.templateId as string | null | undefined) ?? null,
    institutionId: (data.institutionId as string | null | undefined) ?? null,
    healthInsurerId: (data.healthInsurerId as string | null | undefined) ?? null,
    chunkSize: Number(data.chunkSize ?? TEMPLATE_UPLOAD_CHUNK_BYTES),
    chunkCount: Number(data.chunkCount ?? 0),
    createdBy: String(data.createdBy ?? ""),
    createdAt: String(data.createdAt ?? ""),
    expiresAt: String(data.expiresAt ?? ""),
    status: String(data.status ?? "uploading") as UploadSessionStatus,
    templateVersionId: (data.templateVersionId as string | null | undefined) ?? null,
  };
}

async function getOwnedUploadSession(
  db: Db,
  organizationId: string,
  userId: string,
  sessionId: string,
): Promise<{ session: TemplateUploadSession; ref: FirebaseFirestore.DocumentReference }> {
  const ref = orgCollection(db, organizationId, "templateUploadSessions").doc(sessionId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Upload de PDF não encontrado.");
  const session = mapSession(snapshot.id, snapshot.data() ?? {});
  if (session.createdBy !== userId) throw new Error("Upload de PDF não encontrado.");
  return { session, ref };
}

export async function startTemplateUploadAction(input: {
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  templateId?: string | null;
  institutionId?: string | null;
  healthInsurerId?: string | null;
}): Promise<
  | {
      ok: true;
      sessionId: string;
      chunkSize: number;
      chunkCount: number;
    }
  | ActionFailure
> {
  try {
    const user = await requireAdmin();
    const fileName = safeStorageFilename(input.fileName);
    validatePdfUploadMetadata({ name: fileName, type: input.fileType, size: input.fileSize });
    const chunkCount = templateUploadChunkCount(input.fileSize);
    const name = input.name.trim() || fileName;
    const templateId = input.templateId?.trim() || null;
    const institutionId = input.institutionId?.trim() || null;
    const healthInsurerId = input.healthInsurerId?.trim() || null;
    const sessionId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + TEMPLATE_UPLOAD_SESSION_TTL_MS);

    await withOrganizationContext(user.organizationId, user.id, async (db) => {
      await Promise.all([
        assertRateLimit(db, user.organizationId, {
          actorId: user.id,
          action: "upload_pdf_template",
          limit: 10,
          windowMs: 60_000,
        }),
        validateTemplateVersionTargets(db, user.organizationId, {
          templateId: templateId ?? undefined,
          institutionId,
          healthInsurerId,
        }),
      ]);

      await orgCollection(db, user.organizationId, "templateUploadSessions").doc(sessionId).set({
        name,
        fileName,
        fileType: input.fileType || "application/pdf",
        fileSize: input.fileSize,
        templateId,
        institutionId,
        healthInsurerId,
        chunkSize: TEMPLATE_UPLOAD_CHUNK_BYTES,
        chunkCount,
        createdBy: user.id,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: "uploading",
      });
    });

    return { ok: true, sessionId, chunkSize: TEMPLATE_UPLOAD_CHUNK_BYTES, chunkCount };
  } catch (error) {
    logUploadError("start", error);
    return { ok: false, error: safeUploadError(error) };
  }
}

export async function uploadTemplateChunkAction(
  sessionId: string,
  index: number,
  formData: FormData,
): Promise<{ ok: true } | ActionFailure> {
  try {
    const user = await requireAdmin();
    const chunk = formData.get("chunk");
    if (!(chunk instanceof File)) throw new Error("Parte de upload ausente.");
    if (chunk.size <= 0 || chunk.size > TEMPLATE_UPLOAD_CHUNK_BYTES) {
      throw new Error("Parte de upload excede o limite permitido.");
    }

    const bytes = new Uint8Array(await chunk.arrayBuffer());
    await withOrganizationContext(user.organizationId, user.id, async (db) => {
      const { session, ref } = await getOwnedUploadSession(db, user.organizationId, user.id, sessionId);
      if (session.status !== "uploading") throw new Error("Upload de PDF não está mais ativo.");
      if (templateUploadSessionExpired(session.expiresAt)) throw new Error("Upload de PDF expirou. Envie o arquivo novamente.");
      const expected = templateUploadChunkBounds(session.fileSize, index);
      if (bytes.byteLength !== expected.size) throw new Error("Parte de upload possui tamanho inesperado.");

      await putTemplateUploadChunk(user.organizationId, sessionId, index, bytes);
      await ref.set(
        {
          lastChunkAt: new Date().toISOString(),
          [`receivedChunks.${index}`]: bytes.byteLength,
        },
        { merge: true },
      );
    });
    return { ok: true };
  } catch (error) {
    logUploadError("chunk", error, sessionId);
    return { ok: false, error: safeUploadError(error) };
  }
}

export async function completeTemplateUploadAction(
  sessionId: string,
): Promise<{ ok: true; versionId: string } | ActionFailure> {
  let storedPath: string | null = null;
  let cleanup: { organizationId: string; chunkCount: number } | null = null;
  try {
    const user = await requireAdmin();
    const session = await withOrganizationContext(user.organizationId, user.id, async (db) => {
      const ref = orgCollection(db, user.organizationId, "templateUploadSessions").doc(sessionId);
      let resolved: TemplateUploadSession | null = null;
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error("Upload de PDF não encontrado.");
        const current = mapSession(snapshot.id, snapshot.data() ?? {});
        if (current.createdBy !== user.id) throw new Error("Upload de PDF não encontrado.");
        if (current.status === "completed" && current.templateVersionId) {
          resolved = current;
          return;
        }
        if (current.status !== "uploading") throw new Error("Upload de PDF não está mais ativo.");
        if (templateUploadSessionExpired(current.expiresAt)) throw new Error("Upload de PDF expirou. Envie o arquivo novamente.");
        transaction.set(ref, { status: "assembling", assemblingAt: new Date().toISOString() }, { merge: true });
        resolved = { ...current, status: "assembling" };
      });
      if (!resolved) throw new Error("Upload de PDF não encontrado.");
      return resolved;
    });

    if (session.status === "completed" && session.templateVersionId) {
      return { ok: true, versionId: session.templateVersionId };
    }
    cleanup = { organizationId: user.organizationId, chunkCount: session.chunkCount };

    const chunks = await Promise.all(
      Array.from({ length: session.chunkCount }, (_, index) =>
        getTemplateUploadChunk(user.organizationId, sessionId, index),
      ),
    );
    let total = 0;
    chunks.forEach((chunk, index) => {
      const expected = templateUploadChunkBounds(session.fileSize, index);
      if (chunk.byteLength !== expected.size) throw new Error("Parte de upload possui tamanho inesperado.");
      total += chunk.byteLength;
    });
    if (total !== session.fileSize) throw new Error("O PDF recebido está incompleto.");

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    validatePdfUploadMetadata({ name: session.fileName, type: session.fileType, size: bytes.byteLength });
    const meta = await inspectPdf(bytes);
    const stored = await putObject("pdf-templates", user.organizationId, session.fileName, bytes);
    storedPath = stored.filePath;

    const created = await withOrganizationContext(user.organizationId, user.id, (db) =>
      createTemplateVersionTransactional(db, user.organizationId, user.id, {
        templateId: session.templateId ?? undefined,
        name: session.name,
        institutionId: session.institutionId,
        healthInsurerId: session.healthInsurerId,
        filePath: stored.filePath,
        fileHash: stored.fileHash,
        pageCount: meta.pageCount,
        pageWidth: meta.pageWidth,
        pageHeight: meta.pageHeight,
        hasAcroform: meta.hasAcroform,
        acroformFields: meta.acroformFields,
        auditMetadata: {
          fileName: session.fileName,
          acroformFieldCount: meta.acroformFields.length,
          uploadMode: "chunked",
        },
      }),
    );

    await withOrganizationContext(user.organizationId, user.id, async (db) => {
      await orgCollection(db, user.organizationId, "templateUploadSessions").doc(sessionId).set(
        {
          status: "completed",
          templateVersionId: created.versionId,
          completedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    });
    await deleteTemplateUploadChunks(user.organizationId, sessionId, session.chunkCount).catch((error) =>
      logUploadError("cleanup_completed", error, sessionId),
    );
    return { ok: true, versionId: created.versionId };
  } catch (error) {
    logUploadError("complete", error, sessionId);
    if (storedPath && cleanup) {
      await deleteObject(storedPath, cleanup.organizationId).catch((cleanupError) =>
        logUploadError("cleanup_final", cleanupError, sessionId),
      );
    }
    if (cleanup) {
      await deleteTemplateUploadChunks(cleanup.organizationId, sessionId, cleanup.chunkCount).catch((cleanupError) =>
        logUploadError("cleanup_chunks", cleanupError, sessionId),
      );
      try {
        const user = await requireAdmin();
        await withOrganizationContext(user.organizationId, user.id, async (db) => {
          await orgCollection(db, user.organizationId, "templateUploadSessions").doc(sessionId).set(
            { status: "failed", failedAt: new Date().toISOString() },
            { merge: true },
          );
        });
      } catch (statusError) {
        logUploadError("mark_failed", statusError, sessionId);
      }
    }
    return { ok: false, error: safeUploadError(error) };
  }
}

export async function cancelTemplateUploadAction(sessionId: string): Promise<{ ok: true }> {
  try {
    const user = await requireAdmin();
    const session = await withOrganizationContext(user.organizationId, user.id, async (db) => {
      const { session, ref } = await getOwnedUploadSession(db, user.organizationId, user.id, sessionId);
      if (session.status !== "completed") {
        await ref.set({ status: "cancelled", cancelledAt: new Date().toISOString() }, { merge: true });
      }
      return session;
    });
    if (session.status !== "completed") {
      await deleteTemplateUploadChunks(user.organizationId, sessionId, session.chunkCount).catch((error) =>
        logUploadError("cancel_cleanup", error, sessionId),
      );
    }
  } catch (error) {
    logUploadError("cancel", error, sessionId);
  }
  return { ok: true };
}
