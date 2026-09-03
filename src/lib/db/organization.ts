import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import type { Organization, SessionUser } from "@/types/domain";
import type { OrganizationSettingsInput } from "@/lib/validation/organization";

function now() {
  return new Date().toISOString();
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
  await orgCollection(db, user.organizationId, "auditLogs").add({
    userId: user.id,
    action: "update",
    entityType: "organization",
    entityId: user.organizationId,
    metadata: {},
    createdAt: updatedAt,
  });
  const saved = await getOrganizationSettings(db, user.organizationId);
  if (!saved) throw new Error("Organização não encontrada após salvar.");
  return saved;
}
