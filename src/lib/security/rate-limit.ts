import { createHash } from "node:crypto";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";

export interface RateLimitInput {
  actorId: string;
  action: string;
  limit: number;
  windowMs: number;
}

export async function assertRateLimit(
  db: Db,
  orgId: string,
  input: RateLimitInput,
): Promise<void> {
  const limit = Math.max(1, Math.trunc(input.limit));
  const windowMs = Math.max(1_000, Math.trunc(input.windowMs));
  const timestamp = Date.now();
  const bucket = Math.floor(timestamp / windowMs);
  const key = createHash("sha256")
    .update(`${input.actorId}|${input.action}|${bucket}`)
    .digest("hex")
    .slice(0, 32);
  const ref = orgCollection(db, orgId, "rateLimits").doc(key);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.data()?.count ?? 0);
    if (count >= limit) {
      throw new Error("Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.");
    }
    transaction.set(
      ref,
      {
        actorId: input.actorId,
        action: input.action,
        bucket,
        count: count + 1,
        updatedAt: new Date(timestamp).toISOString(),
        expiresAt: new Date((bucket + 2) * windowMs).toISOString(),
      },
      { merge: true },
    );
  });
}
