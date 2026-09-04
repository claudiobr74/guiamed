"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/current";
import { writeAuditLog } from "@/lib/db/audit";
import { orgCollection, withOrganizationContext } from "@/lib/db/client";
import { upsertProcedureIndexed } from "@/lib/db/indexed-search";
import * as repos from "@/lib/db/repos";
import {
  parseInsurerInput,
  parseInstitutionInput,
  parseProcedureInput,
} from "@/lib/validation/domain";
import type { InstitutionKind } from "@/types/domain";

function institutionAuditSnapshot(data: Record<string, unknown> | null) {
  if (!data) return null;
  return {
    name: String(data.name ?? ""),
    kind: String(data.kind ?? ""),
    city: data.city == null ? null : String(data.city),
    state: data.state == null ? null : String(data.state),
    cnpj: data.cnpj == null ? null : String(data.cnpj),
    phone: data.phone == null ? null : String(data.phone),
    active: data.active !== false,
  };
}

function insurerAuditSnapshot(data: Record<string, unknown> | null) {
  if (!data) return null;
  return {
    name: String(data.name ?? ""),
    code: data.code == null ? null : String(data.code),
    active: data.active !== false,
  };
}

function procedureAuditSnapshot(data: Record<string, unknown> | null) {
  if (!data) return null;
  return {
    name: String(data.name ?? ""),
    description: data.description == null ? null : String(data.description),
    specialty: data.specialty == null ? null : String(data.specialty),
    category: data.category == null ? null : String(data.category),
    synonyms: Array.isArray(data.synonyms) ? data.synonyms.map(String) : [],
    active: data.active !== false,
  };
}

export async function saveInstitutionAction(data: {
  id?: string;
  name: string;
  kind: InstitutionKind;
  city?: string | null;
  state?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  active?: boolean;
}) {
  const user = await requireAdmin();
  const parsed = parseInstitutionInput(data);
  const saved = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const existing = parsed.id
      ? await orgCollection(db, user.organizationId, "institutions").doc(parsed.id).get()
      : null;
    const before = existing?.exists
      ? institutionAuditSnapshot((existing.data() ?? {}) as Record<string, unknown>)
      : null;
    const next = await repos.upsertInstitution(db, user.organizationId, {
      ...parsed,
      city: parsed.city ?? undefined,
      state: parsed.state ?? undefined,
      cnpj: parsed.cnpj ?? undefined,
      phone: parsed.phone ?? undefined,
    });
    await writeAuditLog(db, user.organizationId, {
      userId: user.id,
      action: before ? "update_institution" : "create_institution",
      entityType: "institution",
      entityId: next.id,
      metadata: {
        before,
        after: institutionAuditSnapshot(next as unknown as Record<string, unknown>),
      },
    });
    return next;
  });
  revalidatePath("/instituicoes");
  return saved;
}

export async function saveInsurerAction(data: {
  id?: string;
  name: string;
  code?: string | null;
  active?: boolean;
}) {
  const user = await requireAdmin();
  const parsed = parseInsurerInput(data);
  const saved = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const existing = parsed.id
      ? await orgCollection(db, user.organizationId, "healthInsurers").doc(parsed.id).get()
      : null;
    const before = existing?.exists
      ? insurerAuditSnapshot((existing.data() ?? {}) as Record<string, unknown>)
      : null;
    const next = await repos.upsertInsurer(db, user.organizationId, {
      ...parsed,
      code: parsed.code ?? undefined,
    });
    await writeAuditLog(db, user.organizationId, {
      userId: user.id,
      action: before ? "update_health_insurer" : "create_health_insurer",
      entityType: "health_insurer",
      entityId: next.id,
      metadata: {
        before,
        after: insurerAuditSnapshot(next as unknown as Record<string, unknown>),
      },
    });
    return next;
  });
  revalidatePath("/instituicoes");
  return saved;
}

export async function saveProcedureAction(data: {
  id?: string;
  name: string;
  description?: string | null;
  specialty?: string | null;
  category?: string | null;
  synonyms?: string[];
  active?: boolean;
}) {
  const user = await requireAdmin();
  const parsed = parseProcedureInput(data);
  const saved = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const existing = parsed.id
      ? await orgCollection(db, user.organizationId, "procedures").doc(parsed.id).get()
      : null;
    const before = existing?.exists
      ? procedureAuditSnapshot((existing.data() ?? {}) as Record<string, unknown>)
      : null;
    const next = await upsertProcedureIndexed(db, user.organizationId, {
      ...parsed,
      description: parsed.description ?? undefined,
      specialty: parsed.specialty ?? undefined,
      category: parsed.category ?? undefined,
    });
    await writeAuditLog(db, user.organizationId, {
      userId: user.id,
      action: before ? "update_procedure" : "create_procedure",
      entityType: "procedure",
      entityId: next.id,
      metadata: {
        before,
        after: procedureAuditSnapshot(next as unknown as Record<string, unknown>),
      },
    });
    return next;
  });
  revalidatePath("/procedimentos");
  if (parsed.id) revalidatePath(`/procedimentos/${parsed.id}`);
  return saved;
}
