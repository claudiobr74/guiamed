"use server";

import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/current";
import { writeAuditLog } from "@/lib/db/audit";
import { orgCollection, withOrganizationContext, type Db } from "@/lib/db/client";
import { getExistingCodesForImportRows } from "@/lib/db/import-lookup";
import { insertCodesIdempotentWithStatus } from "@/lib/db/import-write";
import { indexImportedProcedureCodes } from "@/lib/db/indexed-search";
import { parseCodeImportBytes, normalizeCodeImportRows, type CodeImportFormat } from "@/lib/import-file-parser";
import {
  CODE_IMPORT_CHUNK_BYTES,
  CODE_IMPORT_SESSION_TTL_MS,
  codeImportChunkBounds,
  codeImportChunkCount,
  codeImportSessionExpired,
  safeCodeImportFileError,
  validateCodeImportFileMetadata,
} from "@/lib/import-file-validation";
import { buildImportPreview, type ImportPreviewAnalysis } from "@/lib/import-preview";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { safeStorageFilename } from "@/lib/storage/path";
import {
  deleteCodeImportChunks,
  getCodeImportChunk,
  putCodeImportChunk,
} from "@/lib/storage/code-import-chunks";

type ImportSessionStatus = "uploading" | "ready" | "importing" | "completed" | "failed" | "cancelled";

type CodeImportSession = {
  id: string;
  fileName: string;
  fileSize: number;
  codeSystem: "TUSS" | "IPASGO";
  version: string;
  chunkSize: number;
  chunkCount: number;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  status: ImportSessionStatus;
  batchId?: string | null;
};

type ImportIssue = { row: number; field: string; message: string };
type ActionFailure = { ok: false; issues: ImportIssue[] };

type PreviewSuccess = {
  ok: true;
  filename: string;
  sizeBytes: number;
  codeSystem: string;
  version: string;
} & ImportPreviewAnalysis;

function fileFailure(error: unknown): ActionFailure {
  return {
    ok: false,
    issues: [{ row: 1, field: "file", message: safeCodeImportFileError(error) }],
  };
}

function logImportError(operation: string, error: unknown, sessionId?: string) {
  console.error("Falha na importação de tabela médica", {
    operation,
    sessionId: sessionId ?? null,
    error: error instanceof Error ? error.message : String(error),
  });
}

function mapSession(id: string, data: FirebaseFirestore.DocumentData): CodeImportSession {
  return {
    id,
    fileName: String(data.fileName ?? ""),
    fileSize: Number(data.fileSize ?? 0),
    codeSystem: String(data.codeSystem ?? "TUSS") === "IPASGO" ? "IPASGO" : "TUSS",
    version: String(data.version ?? ""),
    chunkSize: Number(data.chunkSize ?? CODE_IMPORT_CHUNK_BYTES),
    chunkCount: Number(data.chunkCount ?? 0),
    createdBy: String(data.createdBy ?? ""),
    createdAt: String(data.createdAt ?? ""),
    expiresAt: String(data.expiresAt ?? ""),
    status: String(data.status ?? "uploading") as ImportSessionStatus,
    batchId: (data.batchId as string | null | undefined) ?? null,
  };
}

async function getOwnedSession(
  db: Db,
  organizationId: string,
  userId: string,
  sessionId: string,
) {
  const ref = orgCollection(db, organizationId, "codeImportSessions").doc(sessionId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Upload da tabela não foi encontrado.");
  const session = mapSession(snapshot.id, snapshot.data() ?? {});
  if (session.createdBy !== userId) throw new Error("Upload da tabela não foi encontrado.");
  return { ref, session };
}

async function assembleBytes(
  organizationId: string,
  sessionId: string,
  session: CodeImportSession,
): Promise<Uint8Array> {
  const chunks = await Promise.all(
    Array.from({ length: session.chunkCount }, (_, index) =>
      getCodeImportChunk(organizationId, sessionId, index),
    ),
  );
  let total = 0;
  chunks.forEach((chunk, index) => {
    const expected = codeImportChunkBounds(session.fileSize, index);
    if (chunk.byteLength !== expected.size) throw new Error("Parte de importação possui tamanho inesperado.");
    total += chunk.byteLength;
  });
  if (total !== session.fileSize) throw new Error("O arquivo de tabela recebido está incompleto.");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function parseSession(session: CodeImportSession, bytes: Uint8Array) {
  validateCodeImportFileMetadata({ name: session.fileName, size: bytes.byteLength });
  const parsed = await parseCodeImportBytes(session.fileName, bytes);
  const validated = normalizeCodeImportRows(parsed.rows, session.version, session.codeSystem);
  if (validated.rows.length === 0) {
    throw new Error(
      "Não encontramos códigos TUSS/IPASGO nesta planilha. Confira se há uma coluna de código e outra de descrição.",
    );
  }
  return { ...parsed, validated };
}

export async function startCodeImportUploadAction(input: {
  fileName: string;
  fileSize: number;
  codeSystem: string;
  version: string;
}): Promise<
  | { ok: true; sessionId: string; chunkSize: number; chunkCount: number }
  | ActionFailure
> {
  try {
    const user = await requireAdmin();
    const fileName = safeStorageFilename(input.fileName);
    validateCodeImportFileMetadata({ name: fileName, size: input.fileSize });
    const codeSystem = input.codeSystem.trim().toUpperCase();
    if (codeSystem !== "TUSS" && codeSystem !== "IPASGO") throw new Error("O arquivo deve informar TUSS ou IPASGO.");
    const version = input.version.trim();
    if (!version) throw new Error("O arquivo deve informar a versão da tabela.");
    const chunkCount = codeImportChunkCount(input.fileSize);
    const sessionId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + CODE_IMPORT_SESSION_TTL_MS);

    await withOrganizationContext(user.organizationId, user.id, async (db) => {
      await assertRateLimit(db, user.organizationId, {
        actorId: user.id,
        action: "upload_procedure_code_import",
        limit: 10,
        windowMs: 60_000,
      });
      await orgCollection(db, user.organizationId, "codeImportSessions").doc(sessionId).set({
        fileName,
        fileSize: input.fileSize,
        codeSystem,
        version,
        chunkSize: CODE_IMPORT_CHUNK_BYTES,
        chunkCount,
        createdBy: user.id,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: "uploading",
      });
    });

    return { ok: true, sessionId, chunkSize: CODE_IMPORT_CHUNK_BYTES, chunkCount };
  } catch (error) {
    logImportError("start", error);
    return fileFailure(error);
  }
}

export async function uploadCodeImportChunkAction(
  sessionId: string,
  index: number,
  formData: FormData,
): Promise<{ ok: true } | ActionFailure> {
  try {
    const user = await requireAdmin();
    const chunk = formData.get("chunk");
    if (!(chunk instanceof File)) throw new Error("Parte de importação ausente.");
    if (chunk.size <= 0 || chunk.size > CODE_IMPORT_CHUNK_BYTES) {
      throw new Error("Parte de importação excede o limite permitido.");
    }
    const bytes = new Uint8Array(await chunk.arrayBuffer());
    await withOrganizationContext(user.organizationId, user.id, async (db) => {
      const { session, ref } = await getOwnedSession(db, user.organizationId, user.id, sessionId);
      if (session.status !== "uploading") throw new Error("Upload da tabela não está mais ativo.");
      if (codeImportSessionExpired(session.expiresAt)) throw new Error("Upload da tabela expirou. Envie o arquivo novamente.");
      const expected = codeImportChunkBounds(session.fileSize, index);
      if (bytes.byteLength !== expected.size) throw new Error("Parte de importação possui tamanho inesperado.");
      await putCodeImportChunk(user.organizationId, sessionId, index, bytes);
      await ref.set({
        lastChunkAt: new Date().toISOString(),
        [`receivedChunks.${index}`]: bytes.byteLength,
      }, { merge: true });
    });
    return { ok: true };
  } catch (error) {
    logImportError("chunk", error, sessionId);
    return fileFailure(error);
  }
}

export async function previewCodeImportUploadAction(sessionId: string): Promise<PreviewSuccess | ActionFailure> {
  try {
    const user = await requireAdmin();
    const { session, ref } = await withOrganizationContext(user.organizationId, user.id, (db) =>
      getOwnedSession(db, user.organizationId, user.id, sessionId),
    );
    if (session.status !== "uploading" && session.status !== "ready") {
      throw new Error("Upload da tabela não está disponível para preview.");
    }
    if (codeImportSessionExpired(session.expiresAt)) throw new Error("Upload da tabela expirou. Envie o arquivo novamente.");

    const bytes = await assembleBytes(user.organizationId, sessionId, session);
    const { validated } = await parseSession(session, bytes);
    const existing = await withOrganizationContext(user.organizationId, user.id, (db) =>
      getExistingCodesForImportRows(db, user.organizationId, validated.rows),
    );
    const analysis = buildImportPreview(validated.rows, validated.issues, existing);
    await ref.set({
      status: "ready",
      previewedAt: new Date().toISOString(),
      validRowCount: analysis.validRowCount,
      canImport: analysis.canImport,
    }, { merge: true });

    return {
      ok: true,
      filename: session.fileName,
      sizeBytes: session.fileSize,
      codeSystem: session.codeSystem,
      version: session.version || validated.rows[0]?.version || "1",
      ...analysis,
    };
  } catch (error) {
    logImportError("preview", error, sessionId);
    return fileFailure(error);
  }
}

export async function completeCodeImportUploadAction(
  sessionId: string,
): Promise<{ ok: true; inserted: number; updated: number; batchId: string } | ActionFailure> {
  let cleanup: { organizationId: string; chunkCount: number } | null = null;
  try {
    const user = await requireAdmin();
    const session = await withOrganizationContext(user.organizationId, user.id, async (db) => {
      const ref = orgCollection(db, user.organizationId, "codeImportSessions").doc(sessionId);
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error("Upload da tabela não foi encontrado.");
        const current = mapSession(snapshot.id, snapshot.data() ?? {});
        if (current.createdBy !== user.id) throw new Error("Upload da tabela não foi encontrado.");
        if (current.status === "completed" && current.batchId) return current;
        if (current.status !== "ready") throw new Error("Revise o preview antes de confirmar a importação.");
        if (codeImportSessionExpired(current.expiresAt)) throw new Error("Upload da tabela expirou. Envie o arquivo novamente.");
        transaction.set(ref, { status: "importing", importingAt: new Date().toISOString() }, { merge: true });
        return { ...current, status: "importing" as const };
      });
    });

    if (session.status === "completed" && session.batchId) {
      return { ok: true, inserted: 0, updated: 0, batchId: session.batchId };
    }
    cleanup = { organizationId: user.organizationId, chunkCount: session.chunkCount };

    const bytes = await assembleBytes(user.organizationId, sessionId, session);
    const { format, validated } = await parseSession(session, bytes);
    if (validated.issues.length > 0) return { ok: false, issues: validated.issues };

    const result = await withOrganizationContext(user.organizationId, user.id, async (db) => {
      const importedVersion = session.version || validated.rows[0]?.version || "1";
      const imported = await insertCodesIdempotentWithStatus(db, user.organizationId, user.id, {
        codeSystem: session.codeSystem,
        version: importedVersion,
        sourceFilename: session.fileName,
        sourceFormat: format as CodeImportFormat,
        rows: validated.rows,
      });
      await indexImportedProcedureCodes(db, user.organizationId, validated.rows);
      await writeAuditLog(db, user.organizationId, {
        userId: user.id,
        action: "import_procedure_codes",
        entityType: "import_batch",
        entityId: imported.batchId,
        metadata: {
          codeSystem: session.codeSystem,
          version: importedVersion,
          sourceFilename: session.fileName,
          sourceFormat: format,
          rowCount: validated.rows.length,
          inserted: imported.inserted,
          updated: imported.updated,
          uploadMode: "chunked",
        },
      });
      await orgCollection(db, user.organizationId, "codeImportSessions").doc(sessionId).set({
        status: "completed",
        batchId: imported.batchId,
        completedAt: new Date().toISOString(),
      }, { merge: true });
      return imported;
    });

    await deleteCodeImportChunks(user.organizationId, sessionId, session.chunkCount).catch((error) =>
      logImportError("cleanup_completed", error, sessionId),
    );
    return { ok: true, ...result };
  } catch (error) {
    logImportError("complete", error, sessionId);
    if (cleanup) {
      await deleteCodeImportChunks(cleanup.organizationId, sessionId, cleanup.chunkCount).catch((cleanupError) =>
        logImportError("cleanup_failed", cleanupError, sessionId),
      );
      try {
        const user = await requireAdmin();
        await withOrganizationContext(user.organizationId, user.id, async (db) => {
          await orgCollection(db, user.organizationId, "codeImportSessions").doc(sessionId).set({
            status: "failed",
            failedAt: new Date().toISOString(),
          }, { merge: true });
        });
      } catch (statusError) {
        logImportError("mark_failed", statusError, sessionId);
      }
    }
    return fileFailure(error);
  }
}

export async function cancelCodeImportUploadAction(sessionId: string): Promise<{ ok: true }> {
  try {
    const user = await requireAdmin();
    const session = await withOrganizationContext(user.organizationId, user.id, async (db) => {
      const { session, ref } = await getOwnedSession(db, user.organizationId, user.id, sessionId);
      if (session.status !== "completed") {
        await ref.set({ status: "cancelled", cancelledAt: new Date().toISOString() }, { merge: true });
      }
      return session;
    });
    if (session.status !== "completed") {
      await deleteCodeImportChunks(user.organizationId, sessionId, session.chunkCount).catch((error) =>
        logImportError("cancel_cleanup", error, sessionId),
      );
    }
  } catch (error) {
    logImportError("cancel", error, sessionId);
  }
  return { ok: true };
}
