import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";

function nextUtcDayStart(date: Date): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString();
}

function nextUtcMonthStart(date: Date): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return next.toISOString();
}

/**
 * Usa aggregate count do Firestore: o dashboard não precisa baixar todos os
 * documentos de requests apenas para calcular quatro números.
 */
export async function dashboardStatsAggregated(db: Db, orgId: string) {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const tomorrowStart = nextUtcDayStart(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const nextMonthStart = nextUtcMonthStart(now);
  const requests = orgCollection(db, orgId, "requests");

  const [todaySnap, monthSnap, draftSnap, generatedSnap] = await Promise.all([
    requests.where("createdAt", ">=", todayStart).where("createdAt", "<", tomorrowStart).count().get(),
    requests.where("createdAt", ">=", monthStart).where("createdAt", "<", nextMonthStart).count().get(),
    requests.where("status", "==", "draft").count().get(),
    requests.where("status", "==", "finalized").count().get(),
  ]);

  return {
    today: todaySnap.data().count,
    month: monthSnap.data().count,
    drafts: draftSnap.data().count,
    generated: generatedSnap.data().count,
  };
}
