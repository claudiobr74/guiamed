import Link from "next/link";
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
          <Button type="submit">Nova guia</Button>
        </form>
      }
    >
      <form className="mb-4 flex gap-3">
        <input name="q" defaultValue={params.q} placeholder="Paciente, médico, instituição ou procedimento" className="h-10 flex-1 rounded-lg border border-[#e2e8f0] px-3 text-[13px]" />
        <select name="status" defaultValue={params.status ?? ""} className="h-10 rounded-lg border border-[#e2e8f0] px-3 text-[13px]">
          <option value="">Todos</option>
          <option value="draft">Rascunho</option>
          <option value="finalized">Finalizada</option>
          <option value="cancelled">Cancelada</option>
        </select>
        <Button type="submit" variant="secondary">Filtrar</Button>
        {(params.q || params.status || params.cursor) ? (
          <Link href="/guias" className="self-center text-[12px] font-semibold text-[#64748b]">Limpar</Link>
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
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#f8fafc] text-[11px] uppercase text-[#94a3b8]">
              <tr>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3">Médico</th>
                <th className="px-4 py-3">Instituição</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-t border-[#e2e8f0]">
                  <td className="px-4 py-3 font-semibold">{req.patient?.fullName ?? "—"}</td>
                  <td className="px-4 py-3">{req.doctor?.name ?? "—"}</td>
                  <td className="px-4 py-3">{req.institution?.name ?? "—"}</td>
                  <td className="px-4 py-3">{new Date(req.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <Badge tone={req.status === "finalized" ? "green" : req.status === "cancelled" ? "red" : "neutral"}>
                      {req.status === "finalized" ? "Gerada" : req.status === "cancelled" ? "Cancelada" : "Rascunho"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link className="text-[#1e5fa6]" href={`/guias/${req.id}`}>Abrir</Link>
                      <Link className="text-[#1e5fa6]" href={`/guias/${req.id}/preview`}>PDF</Link>
                      <form action={duplicateRequestAction.bind(null, req.id)}>
                        <button className="text-[#1e5fa6]" type="submit">Duplicar</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {page.nextCursor ? (
            <div className="flex justify-end border-t border-[#e2e8f0] p-4">
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
