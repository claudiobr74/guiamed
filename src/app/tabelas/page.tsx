import { AppShell } from "@/components/layout/AppShell";
import { Card, EmptyState } from "@/components/ui";
import { ImportCodesPanel } from "@/features/codes/ImportCodesPanel";
import { requirePageAdmin } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { listCodes } from "@/lib/db/repos";

export default async function TabelasPage() {
  const user = await requirePageAdmin();
  const codes = await withRls(user.organizationId, user.id, (db) => listCodes(db, user.organizationId));
  return (
    <AppShell user={user} title="Tabelas TUSS / IPASGO">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {codes.length === 0 ? (
          <EmptyState
            title="Nenhum código importado"
            description="A IA não inventa TUSS, IPASGO ou CID. Importe a tabela oficial (CSV, XLSX ou JSON)."
            icon="empty-document"
          />
        ) : (
          <Card>
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase text-[#94a3b8]"><tr><th className="pb-2">Sistema</th><th className="pb-2">Código</th><th className="pb-2">Descrição</th><th className="pb-2">Versão</th></tr></thead>
              <tbody>
                {codes.slice(0, 200).map((c) => (
                  <tr key={c.id} className="border-t border-[#e2e8f0]">
                    <td className="py-2">{c.codeSystem}</td>
                    <td>{c.code}</td>
                    <td>{c.description}</td>
                    <td>{c.version}{c.active ? "" : " • inativo"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {user.role === "admin" ? (
          <Card>
            <h2 className="mb-3 text-[14px] font-bold">Importar tabela</h2>
            <ImportCodesPanel />
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
