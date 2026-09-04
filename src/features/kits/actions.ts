"use server";

import { requireAdmin } from "@/lib/auth/current";
import { writeAuditLog } from "@/lib/db/audit";
import { withOrganizationContext } from "@/lib/db/client";
import { saveKitWithTargetedCatalog } from "@/lib/db/kit-write";

export async function saveKitDetailedAction(data: {
  id?: string;
  name: string;
  description?: string;
  specialty?: string;
  items: Array<{
    procedureId: string;
    defaultCodeId: string | null;
    defaultQuantity: number;
    notes?: string;
  }>;
}) {
  const user = await requireAdmin();
  const name = data.name.trim();
  if (!name) throw new Error("Informe o nome do kit.");
  if (data.items.length === 0) throw new Error("Adicione ao menos um procedimento ao kit.");

  const saved = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const mutation = await saveKitWithTargetedCatalog(db, user.organizationId, {
      ...data,
      name,
    });
    await writeAuditLog(db, user.organizationId, {
      userId: user.id,
      action: mutation.created ? "create_kit" : "update_kit",
      entityType: "procedure_kit",
      entityId: mutation.id,
      metadata: {
        name,
        specialty: data.specialty?.trim() || null,
        itemCount: data.items.length,
        procedureIds: data.items.map((item) => item.procedureId),
      },
    });
    return mutation;
  });

  return { ok: true as const, id: saved.id };
}
