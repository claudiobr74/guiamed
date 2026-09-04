"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current";
import { orgCollection, withOrganizationContext } from "@/lib/db/client";
import { getTussCodeTable } from "@/lib/db/code-tables";

export async function setRequestTussTableAction(requestId: string, tableKey: string | null) {
  const user = await requireUser();
  const id = requestId.trim();
  if (!id) throw new Error("Solicitação inválida.");

  const selectedKey = tableKey?.trim() || null;
  const table = selectedKey
    ? await withOrganizationContext(user.organizationId, user.id, (db) =>
        getTussCodeTable(db, user.organizationId, selectedKey),
      )
    : null;
  if (selectedKey && !table) throw new Error("Tabela TUSS não encontrada ou inativa.");

  const result = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const ref = orgCollection(db, user.organizationId, "requests").doc(id);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("Solicitação não encontrada.");
      const data = snapshot.data() ?? {};
      if (data.status !== "draft") throw new Error("Documento finalizado não pode ser alterado.");

      const currentKey = String(data.tussTableKey ?? "") || null;
      if (currentKey === (table?.key ?? null)) {
        return { ok: true as const, revision: Number(data.revision ?? 0) };
      }

      const items = Array.isArray(data.items)
        ? data.items.map((raw) => {
            const item = raw as Record<string, unknown>;
            return {
              ...item,
              tussCodeId: null,
              tussCodeSnapshot: null,
              tussDescriptionSnapshot: null,
              tussVersionSnapshot: null,
              ipasgoCodeId: null,
              ipasgoCodeSnapshot: null,
              ipasgoDescriptionSnapshot: null,
              ipasgoVersionSnapshot: null,
            };
          })
        : [];
      const revision = Number(data.revision ?? 0) + 1;
      transaction.set(ref, {
        tussTableKey: table?.key ?? null,
        tussTableName: table?.name ?? null,
        items,
        revision,
        updatedAt: new Date().toISOString(),
        reviewValidationRevision: null,
        reviewValidatedAt: null,
        reviewValidatedBy: null,
      }, { merge: true });
      return { ok: true as const, revision };
    });
  });

  revalidatePath(`/guias/${id}`);
  return result;
}
