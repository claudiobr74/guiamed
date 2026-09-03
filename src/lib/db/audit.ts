import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";

export interface AuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(
  db: Db,
  organizationId: string,
  input: AuditLogInput,
): Promise<void> {
  await orgCollection(db, organizationId, "auditLogs").add({
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  });
}
