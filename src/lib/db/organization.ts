import type { Db } from "@/lib/db/client";
import { writeAuditLog } from "@/lib/db/audit";
import type { Organization, SessionUser } from "@/types/domain";
import type { OrganizationSettingsInput } from "@/lib/validation/organization";

function now() {
  return new Date().toISOString();
}

function settingsSnapshot(value: Organization | null) {
  if (!value) return null;
  return {
    name: value.name,
    cnpj: value.cnpj,
    phone: value.phone,
    email: value.email,
    address: value.address,
  };
}

export async function getOrganizationSettings(db: Db, orgId: string): Promise<Organization | null> {
  const snap = await db.collection("organizations").doc(orgId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    id: snap.id,
    name: String(data.name ?? ""),
    cnpj: (data.cnpj as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    address: (data.address as string | null) ?? null,
    createdAt: String(data.createdAt ?? now()),
    updatedAt: String(data.updatedAt ?? now()),
  };
}

export async function updateOrganizationSettings(
  db: Db,
  user: SessionUser,
  input: OrganizationSettingsInput,
): Promise<Organization> {
  const ref = db.collection("organizations").doc(user.organizationId);
  const before = await getOrganizationSettings(db, user.organizationId);
  const current = await ref.get();
  const updatedAt = now();
  await ref.set({
    name: input.name,
    cnpj: input.cnpj,
    phone: input.phone,
    email: input.email,
    address: input.address,
    createdAt: current.exists ? current.data()?.createdAt ?? updatedAt : updatedAt,
    updatedAt,
  }, { merge: true });

  const saved = await getOrganizationSettings(db, user.organizationId);
  if (!saved) throw new Error("Organização não encontrada após salvar.");
  const beforeSnapshot = settingsSnapshot(before);
  const afterSnapshot = settingsSnapshot(saved);
  const changedFields = afterSnapshot
    ? Object.keys(afterSnapshot).filter((key) => {
        const field = key as keyof typeof afterSnapshot;
        return beforeSnapshot?.[field] !== afterSnapshot[field];
      })
    : [];

  await writeAuditLog(db, user.organizationId, {
    userId: user.id,
    action: "update_organization_settings",
    entityType: "organization",
    entityId: user.organizationId,
    metadata: {
      before: beforeSnapshot,
      after: afterSnapshot,
      changedFields,
    },
  });
  return saved;
}
