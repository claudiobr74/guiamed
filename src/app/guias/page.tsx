import Link from "next/link";
import { Copy, Eye, FileText, PencilLine, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Button, EmptyState } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listRequestPage } from "@/lib/db/request-page";
import { createRequestAction, duplicateRequestAction } from "@/app/actions";

function pageHref(input: { q?: string; status?: string; cursor?: string | null }) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.status) params.set("status", input.status);
  if (input.cursor) params.set("cursor", input.cursor);
  const query = params.toString();
  return query ? `/guias?${query}` : "/guias";
}

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

export default async function GuiasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; cursor?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const status = params.status === "draft" || params.status === "finalized" || params.status === "cancelled"
    ? params.status
    : undefined;
  const page = await withOrganizationContext(user.organizationId, user.id, (db) =>
    listRequestPage(db, user.organizationId, {
      q: params.q,
      status,
      cursor: params.cursor,
      limit: 50,
    }),
  );
  const requests = page.items;

  return (
    <AppShell
      user={user}
      title="Guias"
      actions={
        <form action={createRequestAction}>
          <Button type="submit">+ Nova guia</Button>
        </form>
      }
    >
      <form className="mb-5 flex flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar guias</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={16} />
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Buscar por paciente, médico, instituição ou procedimento..."
            className="h-10 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] pl-9 pr-3 text-[13px] outline-none focus:border-[#1e5fa6] focus:bg-white"
          />
        </label>
        <select
          aria-label="Filtrar por status"
          name="status"
          defaultValue={params.status ?? ""}
          className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] lg:min-w-[160px]"
        >
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="finalized">Finalizada</option>
          <option value="cancelled">Cancelada</option>
        </select>
        <Button type="submit" variant="secondary">Filtrar</Button>
        {(params.q || params.status || params.cursor) ? (
          <Link href="/guias" className="self-center px-1 text-[12px] font-semibold text-[#64748b] hover:text-[#1e5fa6]">Limpar</Link>
        ) : null}
      </form>

      {page.scanLimitReached ? (
        <p className="mb-4 rounded-lg bg-[#fff7ed] px-3 py-2 text-[12px] text-[#b45309]">
          A busca atingiu o limite seguro de leitura desta página. Refine o texto/filtro ou avance para continuar procurando.
        </p>
      ) : null}

      {requests.length === 0 ? (
        <EmptyState
          title="Nenhuma guia encontrada"
          description={params.q || params.status ? "Nenhuma guia corresponde aos filtros atuais." : "Crie sua primeira guia para preencher formulários cirúrgicos de forma totalmente automática."}
          icon="empty-document"
          action={
            !params.q && !params.status ? (
              <form action={createRequestAction}>
                <Button type="submit">Criar primeira guia</Button>
              </form>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
          <ul className="divide-y divide-[#e2e8f0] md:hidden">
            {requests.map((req) => {
              const primaryCid = req.cids[0];
              const primaryProcedure = req.items[0];
              const patientName = req.patient?.fullName ?? "paciente sem nome";
              const isDraft = req.status === "draft";

              return (
                <li key={req.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-[#0f172a]">{req.patient?.fullName ?? "—"}</p>
                      <p className="mt-1 truncate text-[12px] text-[#475569]">{req.institution?.name ?? "Instituição não informada"}</p>
                    </div>
                    <Badge tone={statusTone(req.status)}>{statusLabel(req.status)}</Badge>
                  </div>

                  <dl className="mt-4 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[12px]">
                    <dt className="text-[#64748b]">Diagnóstico</dt>
                    <dd className="min-w-0 font-medium text-[#0f172a]">
                      {primaryCid ? `CID ${primaryCid.codeSnapshot}${req.cids.length > 1 ? ` +${req.cids.length - 1}` : ""}` : req.diagnosis || "—"}
                    </dd>
                    <dt className="text-[#64748b]">Procedimento</dt>
                    <dd className="min-w-0 truncate font-medium text-[#0f172a]" title={primaryProcedure?.procedureName}>
                      {primaryProcedure?.procedureName ?? "—"}{req.items.length > 1 ? ` +${req.items.length - 1}` : ""}
                    </dd>
                    <dt className="text-[#64748b]">Médico</dt>
                    <dd className="min-w-0 truncate font-medium text-[#0f172a]">{req.doctor?.name ?? "—"}</dd>
                    <dt className="text-[#64748b]">Criada em</dt>
                    <dd className="font-medium text-[#0f172a]">{new Date(req.createdAt).toLocaleDateString("pt-BR")}</dd>
                  </dl>

                  <RequestActions requestId={req.id} patientName={patientName} isDraft={isDraft} mobile />
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1120px] text-left text-[12px]">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#475569]">
                <tr>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Instituição</th>
                  <th className="px-4 py-3">Diagnóstico</th>
                  <th className="px-4 py-3">Procedimento principal</th>
                  <th className="px-4 py-3">Médico</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const primaryCid = req.cids[0];
                  const primaryProcedure = req.items[0];
                  const patientName = req.patient?.fullName ?? "paciente sem nome";
                  const isDraft = req.status === "draft";

                  return (
                    <tr key={req.id} className="border-t border-[#e2e8f0]">
                      <td className="px-4 py-3 font-semibold text-[#0f172a]">{req.patient?.fullName ?? "—"}</td>
                      <td className="px-4 py-3 text-[#475569]">{req.institution?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-[#475569]" title={primaryCid?.descriptionSnapshot ?? req.diagnosis ?? undefined}>
                        {primaryCid ? `CID ${primaryCid.codeSnapshot}${req.cids.length > 1 ? ` +${req.cids.length - 1}` : ""}` : req.diagnosis || "—"}
                      </td>
                      <td className="max-w-[230px] truncate px-4 py-3 text-[#475569]" title={primaryProcedure?.procedureName}>
                        {primaryProcedure?.procedureName ?? "—"}{req.items.length > 1 ? ` +${req.items.length - 1}` : ""}
                      </td>
                      <td className="px-4 py-3 text-[#475569]">{req.doctor?.name ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#64748b]">{new Date(req.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(req.status)}>{statusLabel(req.status)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <RequestActions requestId={req.id} patientName={patientName} isDraft={isDraft} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {page.nextCursor ? (
            <div className="flex items-center justify-between gap-3 border-t border-[#e2e8f0] p-4">
              <p className="text-[12px] text-[#64748b]">Mostrando até 50 guias por página.</p>
              <Link
                href={pageHref({ q: params.q, status: params.status, cursor: page.nextCursor })}
                className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
              >
                Próximas 50
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function RequestActions({
  requestId,
  patientName,
  isDraft,
  mobile = false,
}: {
  requestId: string;
  patientName: string;
  isDraft: boolean;
  mobile?: boolean;
}) {
  if (mobile) {
    const actionClassName = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] px-3 text-[12px] font-semibold text-[#475569] hover:bg-[#f8fafc] hover:text-[#1e5fa6]";
    return (
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          className={`${actionClassName} col-span-2 border-[#bfdbfe] bg-[#eff6ff] text-[#1e5fa6]`}
          href={`/guias/${requestId}`}
          aria-label={isDraft ? `Continuar guia de ${patientName}` : `Abrir guia de ${patientName}`}
        >
          {isDraft ? <PencilLine size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          {isDraft ? "Continuar" : "Abrir"}
        </Link>
        <Link
          className={actionClassName}
          href={`/guias/${requestId}/preview`}
          aria-label={`Visualizar PDF da guia de ${patientName}`}
        >
          <FileText size={15} aria-hidden="true" />
          PDF
        </Link>
        <form action={duplicateRequestAction.bind(null, requestId)}>
          <button
            className={`${actionClassName} w-full`}
            type="submit"
            aria-label={`Duplicar guia de ${patientName}`}
          >
            <Copy size={15} aria-hidden="true" />
            Duplicar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      <Link
        className="inline-flex size-8 items-center justify-center rounded-md text-[#1e5fa6] hover:bg-[#eff6ff]"
        href={`/guias/${requestId}`}
        aria-label={isDraft ? `Continuar guia de ${patientName}` : `Abrir guia de ${patientName}`}
        title={isDraft ? "Continuar edição" : "Abrir guia"}
      >
        {isDraft ? <PencilLine size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
      </Link>
      <Link
        className="inline-flex size-8 items-center justify-center rounded-md text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1e5fa6]"
        href={`/guias/${requestId}/preview`}
        aria-label={`Visualizar PDF da guia de ${patientName}`}
        title="Visualizar PDF"
      >
        <FileText size={15} aria-hidden="true" />
      </Link>
      <form action={duplicateRequestAction.bind(null, requestId)}>
        <button
          className="inline-flex size-8 items-center justify-center rounded-md text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1e5fa6]"
          type="submit"
          aria-label={`Duplicar guia de ${patientName}`}
          title="Duplicar guia"
        >
          <Copy size={15} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
