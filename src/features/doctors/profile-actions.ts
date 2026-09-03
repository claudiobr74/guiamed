"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/current";
import { writeAuditLog } from "@/lib/db/audit";
import { withOrganizationContext } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import { parseDoctorInput } from "@/lib/validation/domain";
import type { Doctor } from "@/types/domain";

function doctorAuditSnapshot(doctor: Doctor | null) {
  if (!doctor) return null;
  return {
    name: doctor.name,
    crm: doctor.crm,
    crmState: doctor.crmState,
    specialty: doctor.specialty,
    rqe: doctor.rqe,
    active: doctor.active,
    isDefault: doctor.isDefault,
    hasSignature: Boolean(doctor.signatureFile),
  };
}

function changedFields(
  before: ReturnType<typeof doctorAuditSnapshot>,
  after: ReturnType<typeof doctorAuditSnapshot>,
): string[] {
  if (!after) return [];
  if (!before) return Object.keys(after);
  return Object.keys(after).filter((key) => {
    const field = key as keyof NonNullable<typeof after>;
    return before[field] !== after[field];
  });
}

export async function saveDoctorAction(
  data: Partial<Doctor> & { name: string; crm: string; crmState: string; id?: string },
) {
  const user = await requireAdmin();
  const parsed = parseDoctorInput(data);
  const saved = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const existing = parsed.id ? await repos.getDoctor(db, user.organizationId, parsed.id) : null;
    if (parsed.id && !existing) throw new Error("Médico não encontrado nesta organização.");

    const previousDefaultDoctorIds = parsed.isDefault
      ? (await repos.listDoctors(db, user.organizationId))
          .filter((doctor) => doctor.isDefault && doctor.id !== parsed.id)
          .map((doctor) => doctor.id)
      : [];

    const next = await repos.upsertDoctor(db, user.organizationId, {
      ...parsed,
      signatureFile: existing?.signatureFile ?? null,
      signatureKind: existing?.signatureKind ?? "image",
    });
    const before = doctorAuditSnapshot(existing);
    const after = doctorAuditSnapshot(next);
    await writeAuditLog(db, user.organizationId, {
      userId: user.id,
      action: before ? "update_doctor" : "create_doctor",
      entityType: "doctor",
      entityId: next.id,
      metadata: {
        before,
        after,
        changedFields: changedFields(before, after),
        replacedDefaultDoctorIds: previousDefaultDoctorIds,
      },
    });
    return next;
  });

  revalidatePath("/medicos");
  if (parsed.id) revalidatePath(`/medicos/${parsed.id}`);
  return saved;
}
