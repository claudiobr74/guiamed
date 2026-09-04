import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { listProceduresByIds } from "@/lib/db/procedure-lookup";
import { parseQuantity } from "@/lib/quantity";

export interface TargetedKitInput {
  id?: string;
  name: string;
  description?: string;
  specialty?: string;
  items: Array<{
    procedureId: string;
    defaultQuantity: number;
    defaultCodeId?: string | null;
    notes?: string;
  }>;
}

export interface SavedKitMutation {
  id: string;
  created: boolean;
}

export async function saveKitWithTargetedCatalog(
  db: Db,
  orgId: string,
  data: TargetedKitInput,
): Promise<SavedKitMutation> {
  const ids = [...new Set(data.items.map((item) => item.procedureId).filter(Boolean))];
  const procedures = await listProceduresByIds(db, orgId, ids);
  const procedureById = new Map(procedures.map((procedure) => [procedure.id, procedure]));
  const seen = new Set<string>();

  const kitId = data.id ?? orgCollection(db, orgId, "kits").doc().id;
  const kitRef = orgCollection(db, orgId, "kits").doc(kitId);
  const previous = await kitRef.get();
  const items = data.items.map((item, index) => {
    const procedure = procedureById.get(item.procedureId);
    if (!procedure?.active) {
      throw new Error("Um dos procedimentos do kit não existe ou está inativo.");
    }
    if (seen.has(item.procedureId)) {
      throw new Error(`O procedimento ${procedure.name} foi adicionado mais de uma vez ao mesmo kit.`);
    }
    seen.add(item.procedureId);

    const quantity = parseQuantity(item.defaultQuantity);
    if (item.defaultCodeId) {
      const code = procedure.codes.find((candidate) => candidate.id === item.defaultCodeId);
      if (!code?.active) {
        throw new Error(`O código preferencial de ${procedure.name} não pertence ao procedimento ou está inativo.`);
      }
    }

    return {
      id: `${kitId}_${index}`,
      kitId,
      procedureId: procedure.id,
      procedureName: procedure.name,
      defaultQuantity: quantity,
      defaultCodeId: item.defaultCodeId ?? null,
      notes: item.notes?.trim() || null,
      sortOrder: index,
    };
  });

  await kitRef.set(
    {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      specialty: data.specialty?.trim() || null,
      active: true,
      items,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return { id: kitId, created: !previous.exists };
}
