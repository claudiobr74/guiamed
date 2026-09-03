"use server";

import { requireAdmin } from "@/lib/auth/current";
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

  await withOrganizationContext(user.organizationId, user.id, (db) =>
    saveKitWithTargetedCatalog(db, user.organizationId, {
      ...data,
      name,
    }),
  );

  return { ok: true as const };
}
