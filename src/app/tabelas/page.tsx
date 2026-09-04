import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, EmptyState, Input, Select } from "@/components/ui";
import { TussTableImportPanel } from "@/features/codes/TussTableImportPanel";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listCodeManagementPage, type CodeManagementFilters } from "@/lib/db/code-management-page";
import { listTussCodeTables } from "@/lib/db/code-tables";

type SearchParams = {
  table?: string;
  cursor?: string;
  q?: string;
  link?: string;
  active?: string;
  validity?: string;
  version?: string;
};

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function tableHref(params: SearchParams, tableKey: string, cursor?: string | null) {
  const next = new URLSearchParams();
  next.set("table", tableKey);
  if (params.q?.trim()) next.set("q", params.q.trim());
  if (params.link && params.link !== "all") next.set("link", params.link);
  if (params.active && params.active !== "all") next.set("active", params.active);
  if (params.validity && params.validity !== "all") next.set("validity", params.validity);
  if (params.version?.trim()) next.set("version", params.version.trim());
  if (cursor) next.set("cursor", cursor);
  return `/tabelas?${next.toString()}`;
}

export default async function TabelasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageAdmin();
  const params = await searchParams;
  const tables = await withOrganizationContext(user.organizationId, user.id, (db) =>
    listTussCodeTables(db, user.organizationId),
  );
  const requestedTable = params.table?.trim() ?? "";
  const selectedTable = tables.find((table) => table.key === requestedTable) ?? tables[0] ?? null;

  const filters: CodeManagementFilters = {
    cursor: params.cursor,
    q: params.q,
    tableKey: selectedTable?.key ?? "__none__",
    system: "TUSS",
    linkState: oneOf(params.link, ["all", "linked", "unlinked"] as const, "all"),
    activeState: oneOf(params.active, ["all", "active", "inactive"] as const, "all"),
    validity: oneOf(params.validity, ["all", "current", "future", "expired"] as const, "all"),
    version: params.version,
    limit: 100,
  };

  const page = selectedTable
    ? await withOrganizationContext(user.organizationId, user.id, (db) =>
        listCodeManagementPage(db, user.organizationId, filters),
      )
    : {
        items: [],
        nextCursor: null,
        scanned: 0,
        totalCatalog: 0,
        searchIndexed: false,
        scanLimitReached: false,
      };
  const codes = page.items;
  const filtered = Boolean(
    params.q?.trim() ||
      (params.link && params.link !== "all") ||
      (params.active && params.active !== "all") ||
      (params.validity && params.validity !== "all") ||
      params.version?.trim(),
  );

  return (
    <AppShell user={user} title="Tabelas TUSS">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_390px]">
          <Card>
            <div className="mb-4">
              <h2 className="text-[15px] font-bold text-[#0f172a]">Tabelas disponíveis</h2>
              <p className="mt-1 text-[12px] text-[#64748b]">
                Cada tabela é independente. A escolha da tabela usada em uma guia é feita manualmente durante o preenchimento.
              </p>
            </div>
            {tables.length === 0 ? (
              <EmptyState
                title="Nenhuma Tabela TUSS cadastrada"
                description="Envie a primeira tabela oficial no painel ao lado. Não há catálogo pré-carregado ou código inventado."
                icon="empty-document"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {tables.map((table) => {
                  const active = selectedTable?.key === table.key;
                  return (
                    <Link
                      key={table.key}
                      href={`/tabelas?table=${encodeURIComponent(table.key)}`}
                      aria-current={active ? "page" : undefined}
                      className={`rounded-xl border p-4 transition ${
                        active
                          ? "border-[#1e5fa6] bg-[#eff6ff] shadow-sm"
                          : "border-[#e2e8f0] bg-white hover:border-[#93b4da] hover:bg-[#f8fbff]"
                      }`}
                    >
                      <p className={`text-[13px] font-bold ${active ? "text-[#1e5fa6]" : "text-[#0f172a]"}`}>{table.name}</p>
                      <p className="mt-1 text-[11px] text-[#64748b]">Versão {table.currentVersion || "não informada"}</p>
                      <p className="mt-2 truncate text-[10px] text-[#94a3b8]">{table.sourceFilename ?? "arquivo não informado"}</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-1 text-[14px] font-bold">Nova Tabela TUSS</h2>
            <p className="mb-4 text-[11px] text-[#64748b]">Identifique a tabela antes do upload. Tabelas diferentes nunca se sobrescrevem.</p>
            <TussTableImportPanel />
          </Card>
        </div>

        {selectedTable ? (
          <>
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Tabela selecionada</p>
                  <h2 className="mt-1 text-[16px] font-bold text-[#0f172a]">{selectedTable.name}</h2>
                  <p className="mt-1 text-[11px] text-[#64748b]">Versão atual {selectedTable.currentVersion || "—"}</p>
                </div>
                <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-[11px] font-semibold text-[#166534]">Ativa</span>
              </div>

              <form method="get" action="/tabelas" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                <input type="hidden" name="table" value={selectedTable.key} />
                <div className="md:col-span-2 xl:col-span-2">
                  <label htmlFor="table-q" className="mb-1 block text-[11px] font-semibold text-[#475569]">Código ou descrição</label>
                  <Input id="table-q" name="q" defaultValue={params.q ?? ""} placeholder="Ex.: 30715016 ou artrodese" />
                </div>
                <div>
                  <label htmlFor="table-active" className="mb-1 block text-[11px] font-semibold text-[#475569]">Status</label>
                  <Select id="table-active" name="active" defaultValue={filters.activeState ?? "all"}>
                    <option value="all">Ativos e inativos</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </Select>
                </div>
                <div>
                  <label htmlFor="table-validity" className="mb-1 block text-[11px] font-semibold text-[#475569]">Vigência</label>
                  <Select id="table-validity" name="validity" defaultValue={filters.validity ?? "all"}>
                    <option value="all">Todas</option>
                    <option value="current">Vigente hoje</option>
                    <option value="future">Futura</option>
                    <option value="expired">Expirada</option>
                  </Select>
                </div>
                <div>
                  <label htmlFor="table-link" className="mb-1 block text-[11px] font-semibold text-[#475569]">Vínculo</label>
                  <Select id="table-link" name="link" defaultValue={filters.linkState ?? "all"}>
                    <option value="all">Todos</option>
                    <option value="linked">Vinculados</option>
                    <option value="unlinked">Não vinculados</option>
                  </Select>
                </div>
                <div>
                  <label htmlFor="table-version" className="mb-1 block text-[11px] font-semibold text-[#475569]">Versão</label>
                  <Input id="table-version" name="version" defaultValue={params.version ?? ""} placeholder={selectedTable.currentVersion || "2026.1"} />
                </div>
                <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
                  <button type="submit" className="rounded-lg bg-[#1e5fa6] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#174d88]">Aplicar filtros</button>
                  {filtered ? (
                    <Link href={`/tabelas?table=${encodeURIComponent(selectedTable.key)}`} className="rounded-lg border border-[#dbe3ee] px-4 py-2.5 text-[12px] font-semibold text-[#475569] hover:bg-[#f8fafc]">Limpar</Link>
                  ) : null}
                </div>
              </form>
            </Card>

            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-[#0f172a]">{page.totalCatalog.toLocaleString("pt-BR")} código(s) nesta tabela</p>
                  <p className="mt-0.5 text-[11px] text-[#64748b]">Exibindo {codes.length} resultado(s) nesta página de até 100.</p>
                </div>
                {params.cursor ? <Link href={tableHref(params, selectedTable.key)} className="text-[12px] font-semibold text-[#1e5fa6]">Voltar ao início</Link> : null}
              </div>

              {page.scanLimitReached ? (
                <p role="status" className="mb-3 rounded-lg bg-[#fff7ed] px-3 py-2 text-[11px] text-[#9a3412]">A busca atingiu o limite seguro desta página. Refine os filtros.</p>
              ) : null}

              {codes.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-[#64748b]">Nenhum código corresponde aos filtros informados nesta tabela.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-left text-[13px]">
                    <thead className="text-[11px] uppercase text-[#64748b]">
                      <tr>
                        <th className="pb-2">Código TUSS</th>
                        <th className="pb-2">Descrição oficial</th>
                        <th className="pb-2">Versão</th>
                        <th className="pb-2">Vigência</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Vínculo</th>
                        <th className="pb-2 text-right">Qtd. padrão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codes.map((code) => (
                        <tr key={code.id} className="border-t border-[#e2e8f0] align-top">
                          <td className="py-2.5 font-mono text-[12px]">{code.code}</td>
                          <td className="max-w-[460px] py-2.5">{code.description}</td>
                          <td className="py-2.5">{code.version || "—"}</td>
                          <td className="py-2.5 text-[11px] text-[#475569]">{code.validFrom || "início não informado"}<br />até {code.validUntil || "sem término"}</td>
                          <td className="py-2.5"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${code.active ? "bg-[#ecfdf5] text-[#166534]" : "bg-[#fef2f2] text-[#991b1b]"}`}>{code.active ? "Ativo" : "Inativo"}</span></td>
                          <td className="py-2.5 text-[11px]">{code.procedureId ? "Vinculado" : "Não vinculado"}</td>
                          <td className="py-2.5 text-right font-semibold">{code.defaultQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {page.nextCursor ? (
                <div className="mt-4 flex justify-end border-t border-[#e2e8f0] pt-4">
                  <Link href={tableHref(params, selectedTable.key, page.nextCursor)} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]">Próximos 100</Link>
                </div>
              ) : null}
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
