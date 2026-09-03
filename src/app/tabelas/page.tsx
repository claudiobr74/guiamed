import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, EmptyState } from "@/components/ui";
import { ImportCodesPanel } from "@/features/codes/ImportCodesPanel";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listCodePage } from "@/lib/db/code-page";

export default async function TabelasPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await requirePageAdmin();
  const { cursor } = await searchParams;
  const page = await withOrganizationContext(user.organizationId, user.id, (db) =>
    listCodePage(db, user.organizationId, { cursor, limit: 100 }),
  );
  const codes = page.items;

  return (
    <AppShell user={user} title="Tabelas TUSS / IPASGO">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {codes.length === 0 && !cursor ? (
          <EmptyState
            title="Nenhum código importado"
            description="A IA não inventa TUSS, IPASGO ou CID. Importe a tabela oficial (CSV, XLSX ou JSON)."
            icon="empty-document"
          />
        ) : (
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[12px] text-[#64748b]">Exibindo até 100 códigos por página.</p>
              {cursor ? (
                <Link href="/tabelas" className="text-[12px] font-semibold text-[#1e5fa6]">
                  Voltar ao início
                </Link>
              ) : null}
            </div>
            {codes.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais códigos nesta paginação.</p>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase text-[#94a3b8]"><tr><th className="pb-2">Sistema</th><th className="pb-2">Código</th><th className="pb-2">Descrição</th><th className="pb-2">Versão</th></tr></thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-t border-[#e2e8f0]">
                      <td className="py-2">{c.codeSystem}</td>
                      <td>{c.code}</td>
                      <td>{c.description}</td>
                      <td>{c.version}{c.active ? "" : " • inativo"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {page.nextCursor ? (
              <div className="mt-4 flex justify-end border-t border-[#e2e8f0] pt-4">
                <Link
                  href={`/tabelas?cursor=${encodeURIComponent(page.nextCursor)}`}
                  className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
                >
                  Próximos 100
                </Link>
              </div>
            ) : null}
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
