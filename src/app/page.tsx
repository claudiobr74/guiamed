import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Eye, FilePlus2, FileText, PencilLine } from "lucide-react";
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

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function dashboardDate() {
  const value = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return value.charAt(0).toUpperCase() + value.slice(1);
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
      <p className="mb-6 text-[13px] text-[#475569]">{dashboardDate()}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<FilePlus2 size={19} />} label="Guias hoje" value={stats.today} tone="blue" />
        <Stat icon={<FileText size={19} />} label="Guias este mês" value={stats.month} tone="blue" />
        <Stat icon={<Clock3 size={20} />} label="Em elaboração" value={stats.drafts} tone="amber" />
        <Stat icon={<CheckCircle2 size={20} />} label="Geradas" value={stats.generated} tone="green" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 rounded-xl border border-[#e2e8f0] bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-bold">Guias recentes</h2>
            <Link href="/guias" className="text-[12px] font-semibold text-[#1e5fa6] hover:underline">
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
            <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
              <table className="w-full min-w-[820px] text-left text-[12px]">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#475569]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Paciente</th>
                    <th className="px-3 py-2 font-semibold">Convênio</th>
                    <th className="px-3 py-2 font-semibold">Procedimento</th>
                    <th className="px-3 py-2 font-semibold">Atualização</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((req) => {
                    const isDraft = req.status === "draft";
                    return (
                      <tr key={req.id} className="border-t border-[#e2e8f0] first:border-t-0">
                        <td className="px-3 py-3 font-semibold text-[#0f172a]">{req.patient?.fullName ?? "Sem paciente"}</td>
                        <td className="px-3 py-3 text-[#475569]">{req.healthInsurer?.name ?? "—"}</td>
                        <td className="max-w-[220px] truncate px-3 py-3 text-[#475569]">{req.items[0]?.procedureName ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-[#64748b]">{formatTimestamp(req.updatedAt)}</td>
                        <td className="px-3 py-3">
                          <Badge tone={statusTone(req.status)}>{statusLabel(req.status)}</Badge>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/guias/${req.id}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-[#1e5fa6] hover:bg-[#eff6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e5fa6] focus-visible:ring-offset-2"
                            aria-label={isDraft ? `Continuar guia de ${req.patient?.fullName ?? "paciente sem nome"}` : `Abrir guia de ${req.patient?.fullName ?? "paciente sem nome"}`}
                            title={isDraft ? "Continuar edição" : "Abrir guia"}
                          >
                            {isDraft ? <PencilLine size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
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
                <li key={kit.id} className="rounded-lg border border-[#e2e8f0] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[#0f172a]">{kit.name}</p>
                      <p className="mt-1 text-[11px] text-[#64748b]">{kit.items.length} procedimentos</p>
                    </div>
                    <Link href="/guias/nova" className="shrink-0 text-[11px] font-semibold text-[#1e5fa6] hover:underline">
                      Usar kit
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "blue" | "amber" | "green";
}) {
  const toneClass = {
    blue: "bg-[#eff6ff] text-[#1e5fa6]",
    amber: "bg-[#fef3c7] text-[#d97706]",
    green: "bg-[#ecfdf5] text-[#059669]",
  }[tone];

  return (
    <div className="flex min-h-[88px] items-center gap-4 rounded-xl border border-[#e2e8f0] bg-white px-5 py-4">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${toneClass}`} aria-hidden="true">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[12px] text-[#475569]">{label}</p>
        <p className="mt-0.5 text-[23px] font-semibold leading-none text-[#0f172a]">{value}</p>
      </div>
    </div>
  );
}
