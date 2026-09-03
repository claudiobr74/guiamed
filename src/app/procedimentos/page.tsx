import Link from "next/link";
import { PencilLine, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from "@/components/ui";
import { searchProceduresAction } from "@/app/actions";
import { saveProcedureAction } from "@/features/admin/actions";
import { ProcedureCodeManager } from "@/features/codes/ProcedureCodeManager";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listCodeManagementPage } from "@/lib/db/code-management-page";
import {
  listInsurerReferencesByIds,
  listProcedureCatalogPage,
  listProcedureReferencesByIds,
} from "@/lib/db/procedure-page";
import { CODE_NOT_FOUND } from "@/types/domain";

type SystemFilter = "ALL" | "TUSS" | "IPASGO";
type LinkFilter = "all" | "linked" | "unlinked";

function filterHref(input: {
  q: string;
  procedureQ: string;
  system: SystemFilter;
  linkState: LinkFilter;
  cursor?: string | null;
  procedureCursor?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.procedureQ) params.set("procedureQ", input.procedureQ);
  if (input.system !== "ALL") params.set("system", input.system);
  if (input.linkState !== "unlinked") params.set("linkState", input.linkState);
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.procedureCursor) params.set("procedureCursor", input.procedureCursor);
  const query = params.toString();
  return query ? `/procedimentos?${query}` : "/procedimentos";
}

export default async function ProcedimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; procedureQ?: string; system?: string; linkState?: string; cursor?: string; procedureCursor?: string }>;
}) {
  const user = await requirePageAdmin();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const procedureQ = params.procedureQ?.trim() ?? "";
  const procedureSearchTooShort = procedureQ.length > 0 && procedureQ.length < 2;
  const system: SystemFilter = params.system === "TUSS" || params.system === "IPASGO" ? params.system : "ALL";
  const linkState: LinkFilter = params.linkState === "linked" || params.linkState === "all" ? params.linkState : "unlinked";

  const procedurePage = procedureSearchTooShort
    ? { items: [], nextCursor: null }
    : procedureQ
      ? { items: await searchProceduresAction(procedureQ), nextCursor: null }
      : await withOrganizationContext(user.organizationId, user.id, (db) =>
          listProcedureCatalogPage(db, user.organizationId, { cursor: params.procedureCursor, limit: 50 }),
        );

  const data = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const codePage = await listCodeManagementPage(db, user.organizationId, { q, system, linkState, cursor: params.cursor, limit: 50 });
    const procedureIds = codePage.items.map((code) => code.procedureId ?? "").filter(Boolean);
    const insurerIds = codePage.items.map((code) => code.healthInsurerId ?? "").filter(Boolean);
    const [linkedProcedures, linkedInsurers] = await Promise.all([
      listProcedureReferencesByIds(db, user.organizationId, procedureIds),
      listInsurerReferencesByIds(db, user.organizationId, insurerIds),
    ]);
    return { codePage, linkedProcedures, linkedInsurers };
  });
  const procedures = procedurePage.items;
  const codePage = data.codePage;
  const hasProcedureSearch = procedureQ.length > 0;

  return (
    <AppShell user={user} title="Procedimentos">
      <div className="flex flex-col gap-6">
        <section className="overflow-visible rounded-xl border border-[#e2e8f0] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#e2e8f0] p-4 lg:flex-row lg:items-start lg:justify-between">
            <form action="/procedimentos" className="relative w-full max-w-[500px]">
              <input type="hidden" name="q" value={q} />
              <input type="hidden" name="system" value={system} />
              <input type="hidden" name="linkState" value={linkState} />
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={16} />
              <input
                aria-label="Buscar procedimentos"
                name="procedureQ"
                defaultValue={procedureQ}
                placeholder="Buscar procedimento, TUSS ou IPASGO..."
                className="h-[41px] w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] pl-9 pr-3 text-[13px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] focus:border-[#1e5fa6] focus:bg-white"
              />
            </form>

            <details className="group relative shrink-0">
              <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-lg bg-[#1e5fa6] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#184e89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e5fa6] focus-visible:ring-offset-2">
                + Novo procedimento
              </summary>
              <div className="mt-3 w-full rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xl lg:absolute lg:right-0 lg:z-20 lg:w-[420px]">
                <h2 className="mb-3 text-[14px] font-bold">Novo procedimento</h2>
                <form
                  action={async (formData) => {
                    "use server";
                    await saveProcedureAction({
                      name: String(formData.get("name")),
                      description: String(formData.get("description") || "") || null,
                      specialty: String(formData.get("specialty") || "") || null,
                      category: String(formData.get("category") || "") || null,
                      synonyms: String(formData.get("synonyms") || "").split(",").map((value) => value.trim()).filter(Boolean),
                      active: formData.get("active") === "on",
                    });
                  }}
                  className="flex flex-col gap-3"
                >
                  <Field label="Nome canônico"><Input name="name" required /></Field>
                  <Field label="Descrição"><Textarea name="description" className="min-h-20" /></Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Especialidade"><Input name="specialty" /></Field>
                    <Field label="Categoria"><Input name="category" /></Field>
                  </div>
                  <Field label="Sinônimos (vírgula)"><Input name="synonyms" /></Field>
                  <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="active" defaultChecked /> Procedimento ativo</label>
                  <div className="flex justify-end"><Button type="submit">Cadastrar procedimento</Button></div>
                </form>
              </div>
            </details>
          </div>

          {procedureSearchTooShort ? (
            <p role="status" className="m-4 rounded-lg bg-[#eff6ff] px-3 py-2 text-[12px] text-[#1e5fa6]">
              Digite pelo menos 2 caracteres para pesquisar procedimentos.
            </p>
          ) : null}

          {procedures.length === 0 && !params.procedureCursor ? (
            <div className="p-4">
              <EmptyState
                title={hasProcedureSearch ? "Nenhum procedimento encontrado" : "Nenhum procedimento canônico"}
                description={hasProcedureSearch ? "Nenhum procedimento corresponde à busca atual." : "Cadastre o nome clínico e importe códigos TUSS/IPASGO na tela de tabelas. O sistema não inventa códigos."}
                action={hasProcedureSearch ? <Link href="/procedimentos" className="text-[12px] font-semibold text-[#1e5fa6]">Limpar busca</Link> : undefined}
              />
            </div>
          ) : procedures.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais procedimentos nesta paginação.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-[12px]">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#475569]">
                  <tr>
                    <th className="px-4 py-3">Procedimento</th>
                    <th className="px-4 py-3">Código TUSS</th>
                    <th className="px-4 py-3">Código IPASGO</th>
                    <th className="px-4 py-3">Especialidade</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {procedures.map((procedure) => {
                    const tuss = procedure.codes.find((code) => code.codeSystem === "TUSS" && code.active);
                    const ipasgo = procedure.codes.find((code) => code.codeSystem === "IPASGO" && code.active);
                    return (
                      <tr key={procedure.id} className="border-t border-[#e2e8f0]">
                        <td className="px-4 py-3 font-semibold text-[#0f172a]">{procedure.name}</td>
                        <td className="px-4 py-3 text-[#475569]">{tuss?.code ?? <span className="text-[#b45309]">{CODE_NOT_FOUND}</span>}</td>
                        <td className="px-4 py-3 text-[#475569]">{ipasgo?.code ?? <span className="text-[#b45309]">{CODE_NOT_FOUND}</span>}</td>
                        <td className="px-4 py-3 text-[#475569]">{procedure.specialty ?? "—"}</td>
                        <td className="px-4 py-3"><Badge tone={procedure.active ? "green" : "neutral"}>{procedure.active ? "Ativo" : "Inativo"}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/procedimentos/${procedure.id}`}
                            className="inline-flex size-8 items-center justify-center rounded-md text-[#475569] hover:bg-[#eff6ff] hover:text-[#1e5fa6]"
                            aria-label={`Editar procedimento ${procedure.name}`}
                            title="Editar procedimento"
                          >
                            <PencilLine size={16} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] px-4 py-3">
            <p className="text-[12px] text-[#64748b]">
              {hasProcedureSearch ? `Até ${procedures.length} resultados da busca indexada.` : "Até 50 procedimentos por página; códigos são carregados somente para os itens visíveis."}
            </p>
            <div className="flex items-center gap-3">
              {(params.procedureCursor || hasProcedureSearch) ? (
                <Link
                  href={filterHref({ q, procedureQ: "", system, linkState, cursor: params.cursor })}
                  className="text-[12px] font-semibold text-[#1e5fa6] hover:underline"
                >
                  Limpar / início
                </Link>
              ) : null}
              {!hasProcedureSearch && procedurePage.nextCursor ? (
                <Link
                  href={filterHref({
                    q,
                    procedureQ,
                    system,
                    linkState,
                    cursor: params.cursor,
                    procedureCursor: procedurePage.nextCursor,
                  })}
                  className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
                >
                  Próximos 50
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <Card>
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-[#0f172a]">Vínculos TUSS / IPASGO</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">Vincule cada código ao procedimento canônico, defina se ele é geral ou específico de um convênio e ajuste a quantidade padrão usada ao preencher a guia. Procedimentos e operadoras são pesquisados sob demanda.</p>
          </div>

          <form method="get" action="/procedimentos" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-[#f8fafc] p-3">
            <input type="hidden" name="procedureCursor" value={params.procedureCursor ?? ""} />
            <input type="hidden" name="procedureQ" value={procedureQ} />
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase text-[#64748b]">Buscar código ou descrição</label>
              <Input name="q" defaultValue={q} placeholder="Ex.: 31403019 ou artrodese" />
            </div>
            <div className="w-[150px]">
              <label className="mb-1 block text-[11px] font-semibold uppercase text-[#64748b]">Sistema</label>
              <Select name="system" defaultValue={system}><option value="ALL">Todos</option><option value="TUSS">TUSS</option><option value="IPASGO">IPASGO</option></Select>
            </div>
            <div className="w-[170px]">
              <label className="mb-1 block text-[11px] font-semibold uppercase text-[#64748b]">Vínculo</label>
              <Select name="linkState" defaultValue={linkState}><option value="unlinked">Sem vínculo</option><option value="linked">Vinculados</option><option value="all">Todos</option></Select>
            </div>
            <Button type="submit">Filtrar</Button>
            {(q || system !== "ALL" || linkState !== "unlinked" || params.cursor) ? <Link href={filterHref({ q: "", procedureQ, system: "ALL", linkState: "unlinked", procedureCursor: params.procedureCursor })} className="px-2 py-2 text-[12px] font-semibold text-[#64748b]">Limpar filtros</Link> : null}
          </form>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#64748b]">
            <span>{codePage.items.length} código(s) nesta página • até 50 resultados por página{q ? ` • busca ${codePage.searchIndexed ? "indexada" : "compatível com base legada"}` : ""}</span>
            {params.cursor ? <Link href={filterHref({ q, procedureQ, system, linkState, procedureCursor: params.procedureCursor })} className="font-semibold text-[#1e5fa6]">Voltar ao início dos códigos</Link> : null}
          </div>

          {codePage.scanLimitReached ? <p className="mb-3 rounded-lg bg-[#fff7ed] px-3 py-2 text-[12px] text-[#b45309]">Esta página atingiu o limite seguro de leitura antes de completar 50 resultados. Use a próxima página ou conclua a reindexação em Configurações para acelerar buscas textuais.</p> : null}

          <ProcedureCodeManager
            codes={codePage.items}
            linkedProcedures={data.linkedProcedures}
            linkedInsurers={data.linkedInsurers}
          />

          {codePage.nextCursor ? (
            <div className="mt-4 flex justify-end border-t border-[#e2e8f0] pt-4">
              <Link
                href={filterHref({ q, procedureQ, system, linkState, cursor: codePage.nextCursor, procedureCursor: params.procedureCursor })}
                className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
              >
                Próximos resultados
              </Link>
            </div>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
