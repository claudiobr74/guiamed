import { AppShell } from "@/components/layout/AppShell";
import { Badge, Button, EmptyState } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { listRequests } from "@/lib/db/repos";
import { createRequestAction, duplicateRequestAction } from "@/app/actions";
import Link from "next/link";

export default async function GuiasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const requests = await withRls(user.organizationId, user.id, (db) =>
    listRequests(db, user.organizationId, {
      q: params.q,
      status: params.status === "draft" || params.status === "finalized" || params.status === "cancelled" ? params.status : undefined,
    }),
  );
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
      </form>
      {requests.length === 0 ? (
        <EmptyState title="Nenhuma guia encontrada" description="Ajuste a busca ou crie uma nova solicitação." />
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
        </div>
      )}
    </AppShell>
  );
}
