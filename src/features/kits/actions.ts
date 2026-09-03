"use server";

import { requireAdmin } from "@/lib/auth/current";
import { withOrganizationContext } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import { parseQuantity } from "@/lib/quantity";

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

  return withOrganizationContext(user.organizationId, user.id, async (db) => {
    const procedures = await repos.listProcedures(db, user.organizationId);
    const procedureById = new Map(procedures.map((procedure) => [procedure.id, procedure]));
    const seenProcedures = new Set<string>();

    const items = data.items.map((item) => {
      const procedure = procedureById.get(item.procedureId);
      if (!procedure || !procedure.active) {
        throw new Error("Um dos procedimentos do kit não existe ou está inativo.");
      }
      if (seenProcedures.has(item.procedureId)) {
        throw new Error(`O procedimento ${procedure.name} foi adicionado mais de uma vez ao mesmo kit.`);
      }
      seenProcedures.add(item.procedureId);

      const quantity = parseQuantity(item.defaultQuantity);
      if (item.defaultCodeId) {
        const code = procedure.codes.find((candidate) => candidate.id === item.defaultCodeId);
        if (!code || !code.active) {
          throw new Error(`O código preferencial de ${procedure.name} não pertence ao procedimento ou está inativo.`);
        }
      }

      return {
        procedureId: item.procedureId,
        defaultCodeId: item.defaultCodeId || null,
        defaultQuantity: quantity,
        notes: item.notes?.trim() || undefined,
      };
    });

    await repos.upsertKit(db, user.organizationId, {
      id: data.id,
      name,
      description: data.description?.trim() || undefined,
      specialty: data.specialty?.trim() || undefined,
      items,
    });

    return { ok: true as const };
  });
}
