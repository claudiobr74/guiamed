import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import {
  DEFAULT_ORGANIZATION_TIME_ZONE,
  clinicalDayRange,
  clinicalMonthRange,
} from "@/lib/time/clinical-calendar";

/**
 * Usa aggregate count do Firestore: o dashboard não baixa requests apenas para
 * calcular métricas. Os limites de dia/mês seguem o calendário clínico da
 * organização; enquanto não houver preferência por tenant, o default brasileiro
 * é America/Sao_Paulo.
 */
export async function dashboardStatsAggregated(
  db: Db,
  orgId: string,
  input: { now?: Date; timeZone?: string } = {},
) {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? DEFAULT_ORGANIZATION_TIME_ZONE;
  const day = clinicalDayRange(now, timeZone);
  const month = clinicalMonthRange(now, timeZone);
  const requests = orgCollection(db, orgId, "requests");

  const [todaySnap, monthSnap, draftSnap, generatedSnap] = await Promise.all([
    requests.where("createdAt", ">=", day.start.toISOString()).where("createdAt", "<", day.end.toISOString()).count().get(),
    requests.where("createdAt", ">=", month.start.toISOString()).where("createdAt", "<", month.end.toISOString()).count().get(),
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
