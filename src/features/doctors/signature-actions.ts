"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/current";
import { orgCollection, withOrganizationContext } from "@/lib/db/client";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { MAX_SIGNATURE_BYTES, validateSignatureImage } from "@/lib/signature-image";
import { deleteObject, putObject } from "@/lib/storage";

function validateDoctorId(doctorId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(doctorId)) throw new Error("Médico inválido.");
}

export async function uploadDoctorSignatureAction(doctorId: string, formData: FormData) {
  const user = await requireAdmin();
  validateDoctorId(doctorId);
  const file = formData.get("signature");
  if (!(file instanceof File)) throw new Error("Selecione uma imagem PNG ou JPEG.");
  if (file.size <= 0) throw new Error("A imagem de assinatura está vazia.");
  if (file.size > MAX_SIGNATURE_BYTES) throw new Error("A imagem de assinatura deve ter no máximo 2 MB.");

  const result = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    await assertRateLimit(db, user.organizationId, {
      actorId: user.id,
      action: "upload_doctor_signature",
      limit: 10,
      windowMs: 60_000,
    });

    const doctorRef = orgCollection(db, user.organizationId, "doctors").doc(doctorId);
    const doctor = await doctorRef.get();
    if (!doctor.exists) throw new Error("Médico não encontrado nesta organização.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = validateSignatureImage(bytes, { size: file.size, type: file.type });
    const stored = await putObject(
      "signatures",
      user.organizationId,
      `doctor-${doctorId}.${info.extension}`,
      bytes,
    );
    const previousFile = typeof doctor.data()?.signatureFile === "string" ? String(doctor.data()?.signatureFile) : null;
    const updatedAt = new Date().toISOString();

    try {
      await db.runTransaction(async (transaction) => {
        const latest = await transaction.get(doctorRef);
        if (!latest.exists) throw new Error("Médico não encontrado nesta organização.");
        transaction.set(
          doctorRef,
          {
            signatureFile: stored.filePath,
            signatureKind: "image",
            updatedAt,
          },
          { merge: true },
        );
        transaction.set(orgCollection(db, user.organizationId, "auditLogs").doc(), {
          userId: user.id,
          action: "upload_signature",
          entityType: "doctor",
          entityId: doctorId,
          metadata: {
            mimeType: info.mimeType,
            width: info.width,
            height: info.height,
            sizeBytes: file.size,
          },
          createdAt: updatedAt,
        });
      });
    } catch (error) {
      await deleteObject(stored.filePath, user.organizationId).catch((cleanupError) => {
        console.error("Falha ao remover assinatura órfã", cleanupError);
      });
      throw error;
    }

    if (previousFile && previousFile !== stored.filePath) {
      await deleteObject(previousFile, user.organizationId).catch((cleanupError) => {
        console.error("Falha ao remover assinatura anterior", cleanupError);
      });
    }

    return { ok: true as const, width: info.width, height: info.height };
  });

  revalidatePath(`/medicos/${doctorId}`);
  return result;
}

export async function removeDoctorSignatureAction(doctorId: string) {
  const user = await requireAdmin();
  validateDoctorId(doctorId);

  const previousFile = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const doctorRef = orgCollection(db, user.organizationId, "doctors").doc(doctorId);
    const timestamp = new Date().toISOString();
    let filePath: string | null = null;
    await db.runTransaction(async (transaction) => {
      const doctor = await transaction.get(doctorRef);
      if (!doctor.exists) throw new Error("Médico não encontrado nesta organização.");
      filePath = typeof doctor.data()?.signatureFile === "string" ? String(doctor.data()?.signatureFile) : null;
      transaction.set(doctorRef, { signatureFile: null, updatedAt: timestamp }, { merge: true });
      transaction.set(orgCollection(db, user.organizationId, "auditLogs").doc(), {
        userId: user.id,
        action: "remove_signature",
        entityType: "doctor",
        entityId: doctorId,
        metadata: {},
        createdAt: timestamp,
      });
    });
    return filePath;
  });

  if (previousFile) {
    await deleteObject(previousFile, user.organizationId).catch((cleanupError) => {
      console.error("Falha ao remover arquivo de assinatura", cleanupError);
    });
  }
  revalidatePath(`/medicos/${doctorId}`);
  return { ok: true as const };
}
