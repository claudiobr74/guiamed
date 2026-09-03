import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { ProcedureCodeManager } from "@/features/codes/ProcedureCodeManager";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listCodeManagementPage, listProcedureAdminCatalog } from "@/lib/db/code-management-page";
import { listInsurers } from "@/lib/db/repos";
import { saveProcedureAction } from "@/app/actions";
import { CODE_NOT_FOUND } from "@/types/domain";

type SystemFilter = "ALL" | "TUSS" | "IPASGO";
type LinkFilter = "all" | "linked" | "unlinked";

function filterHref(input: {
  q: string;
  system: SystemFilter;
  linkState: LinkFilter;
  cursor?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.system !== "ALL") params.set("system", input.system);
  if (input.linkState !== "unlinked") params.set("linkState", input.linkState);
  if (input.cursor) params.set("cursor", input.cursor);
  const query = params.toString();
  return query ? `/procedimentos?${query}` : "/procedimentos";
}

export default async function ProcedimentosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    system?: string;
    linkState?: string;
    cursor?: string;
  }>;
}) {
  const user = await requirePageAdmin();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const system: SystemFilter = params.system === "TUSS" || params.system === "IPASGO" ? params.system : "ALL";
  const linkState: LinkFilter =
    params.linkState === "linked" || params.linkState === "all" ? params.linkState : "unlinked";

  const { procedures, insurers, codePage } = await withOrganizationContext(
    user.organizationId,
    user.id,
    async (db) => {
      const [procedures, insurers, codePage] = await Promise.all([
        listProcedureAdminCatalog(db, user.organizationId),
        listInsurers(db, user.organizationId),
        listCodeManagementPage(db, user.organizationId, {
          q,
          system,
          linkState,
          cursor: params.cursor,
          limit: 50,
        }),
      ]);
      return { procedures, insurers, codePage };
    },
  );

  return (
    <AppShell user={user} title="Procedimentos">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
          {procedures.length === 0 ? (
            <EmptyState title="Nenhum procedimento canônico" description="Cadastre o nome clínico e importe códigos TUSS/IPASGO na tela de tabelas. O sistema não inventa códigos." />
          ) : (
            <Card>
              <table className="w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase text-[#94a3b8]"><tr><th className="pb-2">Nome</th><th className="pb-2">TUSS</th><th className="pb-2">IPASGO</th></tr></thead>
                <tbody>
                  {procedures.map((p) => {
                    const tuss = p.codes.find((c) => c.codeSystem === "TUSS" && c.active);
                    const ipasgo = p.codes.find((c) => c.codeSystem === "IPASGO" && c.active);
                    return (
                      <tr key={p.id} className="border-t border-[#e2e8f0]">
                        <td className="py-2 font-semibold">{p.name}</td>
                        <td>{tuss?.code ?? CODE_NOT_FOUND}</td>
                        <td>{ipasgo?.code ?? CODE_NOT_FOUND}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
          {user.role === "admin" ? (
            <Card>
              <h2 className="mb-3 text-[14px] font-bold">Novo procedimento</h2>
              <form
                action={async (formData) => {
                  "use server";
                  await saveProcedureAction({
                    name: String(formData.get("name")),
                    description: String(formData.get("description") || "") || undefined,
                    specialty: String(formData.get("specialty") || "") || undefined,
                    synonyms: String(formData.get("synonyms") || "").split(",").map((s) => s.trim()).filter(Boolean),
                  });
                }}
                className="flex flex-col gap-3"
              >
                <Field label="Nome"><Input name="name" required /></Field>
                <Field label="Especialidade"><Input name="specialty" /></Field>
                <Field label="Sinônimos (vírgula)"><Input name="synonyms" /></Field>
                <Button type="submit">Cadastrar</Button>
              </form>
            </Card>
          ) : null}
        </div>

        <Card>
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-[#0f172a]">Vínculos TUSS / IPASGO</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">
              Vincule cada código ao procedimento canônico, defina se ele é geral ou específico de um convênio e ajuste a quantidade padrão usada ao preencher a guia.
            </p>
          </div>

          <form method="get" action="/procedimentos" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-[#f8fafc] p-3">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase text-[#64748b]">Buscar código ou descrição</label>
              <Input name="q" defaultValue={q} placeholder="Ex.: 31403019 ou artrodese" />
            </div>
            <div className="w-[150px]">
              <label className="mb-1 block text-[11px] font-semibold uppercase text-[#64748b]">Sistema</label>
              <Select name="system" defaultValue={system}>
                <option value="ALL">Todos</option>
                <option value="TUSS">TUSS</option>
                <option value="IPASGO">IPASGO</option>
              </Select>
            </div>
            <div className="w-[170px]">
              <label className="mb-1 block text-[11px] font-semibold uppercase text-[#64748b]">Vínculo</label>
              <Select name="linkState" defaultValue={linkState}>
                <option value="unlinked">Sem vínculo</option>
                <option value="linked">Vinculados</option>
                <option value="all">Todos</option>
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            {(q || system !== "ALL" || linkState !== "unlinked" || params.cursor) ? (
              <Link href="/procedimentos" className="px-2 py-2 text-[12px] font-semibold text-[#64748b]">
                Limpar
              </Link>
            ) : null}
          </form>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#64748b]">
            <span>
              {codePage.items.length} código(s) nesta página • até 50 resultados por página
              {q ? ` • busca ${codePage.searchIndexed ? "indexada" : "compatível com base legada"}` : ""}
            </span>
            {params.cursor ? (
              <Link href={filterHref({ q, system, linkState })} className="font-semibold text-[#1e5fa6]">
                Voltar ao início
              </Link>
            ) : null}
          </div>

          {codePage.scanLimitReached ? (
            <p className="mb-3 rounded-lg bg-[#fff7ed] px-3 py-2 text-[12px] text-[#b45309]">
              Esta página atingiu o limite seguro de leitura antes de completar 50 resultados. Use a próxima página ou conclua a reindexação em Configurações para acelerar buscas textuais.
            </p>
          ) : null}

          <ProcedureCodeManager codes={codePage.items} procedures={procedures} insurers={insurers} />

          {codePage.nextCursor ? (
            <div className="mt-4 flex justify-end border-t border-[#e2e8f0] pt-4">
              <Link
                href={filterHref({ q, system, linkState, cursor: codePage.nextCursor })}
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
