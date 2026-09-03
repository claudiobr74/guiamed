"use server";

import { requireAdmin } from "@/lib/auth/current";
import { withOrganizationContext } from "@/lib/db/client";
import { rebuildSearchIndexChunk } from "@/lib/db/indexed-search";

export async function rebuildSearchIndexChunkAction() {
  const user = await requireAdmin();
  return withOrganizationContext(user.organizationId, user.id, (db) =>
    rebuildSearchIndexChunk(db, user.organizationId),
  );
}
