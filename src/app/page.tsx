import type { ReactNode } from "react";
import Link from "next/link";
import { FileText, CheckCircle2, Clock3, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Button, EmptyState } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listKitsPage } from "@/lib/db/admin-page";
import { dashboardStatsAggregated } from "@/lib/db/dashboard-stats";
import { listRequestPage } from "@/lib/db/request-page";
import { createRequestAction } from "@/app/actions";

function statusTone(status: string) {
  if (status === "finalized") return "green" as const;
  if (status === "cancelled") return "red" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "finalized") return "Gerada";
  if (status === "cancelled") return "Cancelada";
  return "Rascunho";
}

export default async function DashboardPage() {
  const user = await requirePageUser();
  const { stats, recent, kits } = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const [stats, requestPage, kitPage] = await Promise.all([
      dashboardStatsAggregated(db, user.organizationId),
      listRequestPage(db, user.organizationId, { limit: 8 }),
      listKitsPage(db, user.organizationId, { limit: 6 }),
    ]);
    return { stats, recent: requestPage.items, kits: kitPage.items };
  });

  return (
    <AppShell
      user={user}
      title={`Olá, ${user.fullName.split(" ")[0]}`}
      actions={
        <form action={createRequestAction}>
          <Button type="submit">+ Nova guia</Button>
        </form>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Stat icon={<CalendarDays size={16} />} label="Guias hoje" value={stats.today} />
        <Stat icon={<FileText size={16} />} label="Guias este mês" value={stats.month} />
        <Stat icon={<Clock3 size={16} />} label="Em elaboração" value={stats.drafts} />
        <Stat icon={<CheckCircle2 size={16} />} label="Geradas" value={stats.generated} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <section className="rounded-xl border border-[#e2e8f0] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[14px] font-bold">Guias recentes</h2>
            <Link href="/guias" className="text-[12px] font-semibold text-[#1e5fa6]">
              Ver todas
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              title="Nenhuma guia criada ainda"
              description="Crie sua primeira guia para preencher formulários cirúrgicos de forma totalmente automática."
              icon="empty-document"
              action={
                <form action={createRequestAction}>
                  <Button type="submit">Criar primeira guia</Button>
                </form>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-[13px]">
                <thead className="text-[11px] uppercase text-[#94a3b8]">
                  <tr>
                    <th className="pb-2 font-semibold">Paciente</th>
                    <th className="pb-2 font-semibold">Convênio</th>
                    <th className="pb-2 font-semibold">Procedimento</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((req) => (
                    <tr key={req.id} className="border-t border-[#e2e8f0]">
                      <td className="py-3">
                        <Link href={`/guias/${req.id}`} className="font-semibold text-[#1e5fa6]">
                          {req.patient?.fullName ?? "Sem paciente"}
                        </Link>
                      </td>
                      <td className="py-3 text-[#475569]">{req.healthInsurer?.name ?? "—"}</td>
                      <td className="py-3 text-[#475569]">{req.items[0]?.procedureName ?? "—"}</td>
                      <td className="py-3">
                        <Badge tone={statusTone(req.status)}>{statusLabel(req.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="rounded-xl border border-[#e2e8f0] bg-white p-5">
          <h2 className="mb-4 text-[14px] font-bold">Kits disponíveis</h2>
          {kits.length === 0 ? (
            <p className="text-[13px] text-[#475569]">Nenhum kit cadastrado.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {kits.map((kit) => (
                <li key={kit.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold">{kit.name}</p>
                    <p className="text-[11px] text-[#94a3b8]">{kit.items.length} procedimentos</p>
                  </div>
                  <Link href="/guias/nova" className="text-[12px] font-semibold text-[#1e5fa6]">
                    Usar kit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
      <div className="flex items-center gap-2 text-[#1e5fa6]">{icon}<span className="text-[12px] text-[#475569]">{label}</span></div>
      <p className="mt-2 text-[28px] font-semibold">{value}</p>
    </div>
  );
}
