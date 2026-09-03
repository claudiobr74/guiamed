import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, EmptyState, Input, Select } from "@/components/ui";
import { ImportCodesPanel } from "@/features/codes/ImportCodesPanel";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listCodeManagementPage, type CodeManagementFilters } from "@/lib/db/code-management-page";

type SearchParams = {
  cursor?: string;
  q?: string;
  system?: string;
  link?: string;
  active?: string;
  validity?: string;
  version?: string;
};

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function tableHref(params: SearchParams, cursor?: string | null) {
  const next = new URLSearchParams();
  if (params.q?.trim()) next.set("q", params.q.trim());
  if (params.system && params.system !== "ALL") next.set("system", params.system);
  if (params.link && params.link !== "all") next.set("link", params.link);
  if (params.active && params.active !== "all") next.set("active", params.active);
  if (params.validity && params.validity !== "all") next.set("validity", params.validity);
  if (params.version?.trim()) next.set("version", params.version.trim());
  if (cursor) next.set("cursor", cursor);
  const query = next.toString();
  return query ? `/tabelas?${query}` : "/tabelas";
}

export default async function TabelasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePageAdmin();
  const params = await searchParams;
  const filters: CodeManagementFilters = {
    cursor: params.cursor,
    q: params.q,
    system: oneOf(params.system, ["ALL", "TUSS", "IPASGO"] as const, "ALL"),
    linkState: oneOf(params.link, ["all", "linked", "unlinked"] as const, "all"),
    activeState: oneOf(params.active, ["all", "active", "inactive"] as const, "all"),
    validity: oneOf(params.validity, ["all", "current", "future", "expired"] as const, "all"),
    version: params.version,
    limit: 100,
  };

  const page = await withOrganizationContext(user.organizationId, user.id, (db) =>
    listCodeManagementPage(db, user.organizationId, filters),
  );
  const codes = page.items;
  const filtered = Boolean(
    params.q?.trim() ||
      (params.system && params.system !== "ALL") ||
      (params.link && params.link !== "all") ||
      (params.active && params.active !== "all") ||
      (params.validity && params.validity !== "all") ||
      params.version?.trim(),
  );

  return (
    <AppShell user={user} title="Tabelas TUSS / IPASGO">
      <div className="flex flex-col gap-5">
        <Card>
          <form method="get" action="/tabelas" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
            <div className="md:col-span-2 xl:col-span-2">
              <label htmlFor="table-q" className="mb-1 block text-[11px] font-semibold text-[#475569]">
                Código ou descrição
              </label>
              <Input id="table-q" name="q" defaultValue={params.q ?? ""} placeholder="Ex.: 30715016 ou artrodese" />
            </div>
            <div>
              <label htmlFor="table-system" className="mb-1 block text-[11px] font-semibold text-[#475569]">Sistema</label>
              <Select id="table-system" name="system" defaultValue={filters.system ?? "ALL"}>
                <option value="ALL">Todos</option>
                <option value="TUSS">TUSS</option>
                <option value="IPASGO">IPASGO</option>
              </Select>
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
              <Input id="table-version" name="version" defaultValue={params.version ?? ""} placeholder="2026.1" />
            </div>
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-7">
              <button
                type="submit"
                className="rounded-lg bg-[#1e5fa6] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#174d88]"
              >
                Aplicar filtros
              </button>
              {filtered ? (
                <Link href="/tabelas" className="rounded-lg border border-[#dbe3ee] px-4 py-2.5 text-[12px] font-semibold text-[#475569] hover:bg-[#f8fafc]">
                  Limpar
                </Link>
              ) : null}
            </div>
          </form>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
          {page.totalCatalog === 0 && !filtered ? (
            <EmptyState
              title="Nenhum código importado"
              description="A IA não inventa TUSS, IPASGO ou CID. Importe a tabela oficial (CSV, XLSX ou JSON)."
              icon="empty-document"
            />
          ) : (
            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-[#0f172a]">
                    {page.totalCatalog.toLocaleString("pt-BR")} código(s) no catálogo
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#64748b]">
                    Exibindo {codes.length} resultado(s) nesta página de até 100.
                    {params.q?.trim() ? (page.searchIndexed ? " Busca pelo índice normalizado." : " Índice de busca ainda não concluído.") : ""}
                  </p>
                </div>
                {params.cursor ? (
                  <Link href={tableHref(params)} className="text-[12px] font-semibold text-[#1e5fa6]">
                    Voltar ao início dos resultados
                  </Link>
                ) : null}
              </div>

              {page.scanLimitReached ? (
                <p role="status" className="mb-3 rounded-lg bg-[#fff7ed] px-3 py-2 text-[11px] text-[#9a3412]">
                  A busca atingiu o limite seguro de leitura desta página. Refine os filtros ou a descrição para localizar o código desejado.
                </p>
              ) : null}

              {codes.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-[#64748b]">Nenhum código corresponde aos filtros informados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full text-left text-[13px]">
                    <thead className="text-[11px] uppercase text-[#64748b]">
                      <tr>
                        <th className="pb-2">Sistema</th>
                        <th className="pb-2">Código</th>
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
                          <td className="py-2.5 font-semibold">{code.codeSystem}</td>
                          <td className="py-2.5 font-mono text-[12px]">{code.code}</td>
                          <td className="max-w-[420px] py-2.5">{code.description}</td>
                          <td className="py-2.5">{code.version || "—"}</td>
                          <td className="py-2.5 text-[11px] text-[#475569]">
                            {code.validFrom || "início não informado"}<br />até {code.validUntil || "sem término"}
                          </td>
                          <td className="py-2.5">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${code.active ? "bg-[#ecfdf5] text-[#166534]" : "bg-[#fef2f2] text-[#991b1b]"}`}>
                              {code.active ? "Ativo" : "Inativo"}
                            </span>
                          </td>
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
                  <Link
                    href={tableHref(params, page.nextCursor)}
                    className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
                  >
                    Próximos 100
                  </Link>
                </div>
              ) : null}
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-[14px] font-bold">Importar tabela</h2>
            <ImportCodesPanel />
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
