import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, EmptyState } from "@/components/ui";
import { KitEditor } from "@/features/kits/KitEditor";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { getKit, listKitsPage } from "@/lib/db/admin-page";
import { listProceduresByIds } from "@/lib/db/procedure-lookup";
import { CODE_NOT_FOUND } from "@/types/domain";

function pageHref(input: { cursor?: string | null; edit?: string | null; editor?: boolean } = {}): string {
  const params = new URLSearchParams();
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.edit) params.set("edit", input.edit);
  const query = params.toString();
  return `/kits${query ? `?${query}` : ""}${input.editor ? "#editor" : ""}`;
}

export default async function KitsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; edit?: string }>;
}) {
  const user = await requirePageAdmin();
  const { cursor, edit } = await searchParams;
  const data = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const [kitPage, selectedKit] = await Promise.all([
      listKitsPage(db, user.organizationId, { cursor, limit: 20 }),
      edit ? getKit(db, user.organizationId, edit) : Promise.resolve(null),
    ]);
    const procedureIds = [...new Set([
      ...kitPage.items.flatMap((kit) => kit.items.map((item) => item.procedureId)),
      ...(selectedKit?.items.map((item) => item.procedureId) ?? []),
    ].filter(Boolean))];
    const procedures = await listProceduresByIds(db, user.organizationId, procedureIds);
    return { kitPage, selectedKit, procedures };
  });
  const kits = data.kitPage.items;
  const procedureById = new Map(data.procedures.map((procedure) => [procedure.id, procedure]));

  return (
    <AppShell user={user} title="Kits cirúrgicos">
      <div className="flex flex-col gap-6">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-[#64748b]">Exibindo até 20 kits por página, em ordem alfabética.</p>
            <div className="flex gap-3">
              {cursor ? (
                <Link href={pageHref({ edit: data.selectedKit?.id })} className="text-[12px] font-semibold text-[#1e5fa6]">
                  Voltar ao início
                </Link>
              ) : null}
              <Link href={pageHref({ cursor, editor: true })} className="text-[12px] font-semibold text-[#1e5fa6]">
                + Novo kit
              </Link>
            </div>
          </div>

          {kits.length === 0 && !cursor ? (
            <EmptyState title="Nenhum kit" description="Um kit carrega vários procedimentos com quantidade padrão em um clique." />
          ) : kits.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais kits nesta paginação.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {kits.map((kit) => (
                <Card key={kit.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[14px] font-bold">{kit.name}</h2>
                      {kit.description ? <p className="mt-1 text-[12px] text-[#64748b]">{kit.description}</p> : null}
                    </div>
                    <Link
                      href={pageHref({ cursor, edit: kit.id, editor: true })}
                      className="shrink-0 text-[12px] font-semibold text-[#1e5fa6]"
                    >
                      Editar
                    </Link>
                  </div>
                  <ul className="mt-3 flex flex-col gap-2 text-[12px] text-[#475569]">
                    {kit.items.map((item) => {
                      const procedure = procedureById.get(item.procedureId);
                      const preferredCode = procedure?.codes.find((code) => code.id === item.defaultCodeId);
                      return (
                        <li key={item.id} className="rounded-lg bg-[#f8fafc] px-3 py-2">
                          <span className="font-semibold text-[#0f172a]">{item.procedureName}</span>
                          <span> — qtd {item.defaultQuantity}</span>
                          <span className="ml-2 text-[#64748b]">
                            {preferredCode
                              ? `${preferredCode.codeSystem} ${preferredCode.code}`
                              : item.defaultCodeId
                                ? `código ${CODE_NOT_FOUND.toLowerCase()}`
                                : "resolução automática"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ))}
            </div>
          )}

          {data.kitPage.nextCursor ? (
            <div className="mt-4 flex justify-end">
              <Link
                href={pageHref({ cursor: data.kitPage.nextCursor, edit: data.selectedKit?.id })}
                className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
              >
                Próximos 20 kits
              </Link>
            </div>
          ) : null}
        </div>

        <Card>
          <div id="editor" className="mb-4 scroll-mt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-[#0f172a]">
                  {data.selectedKit ? `Editar kit: ${data.selectedKit.name}` : "Novo kit cirúrgico"}
                </h2>
                <p className="mt-1 text-[12px] text-[#64748b]">
                  Pesquise os procedimentos sob demanda. A quantidade começa em 1 e pode ser alterada; ao escolher um código de referência, a quantidade padrão desse código é sugerida automaticamente.
                </p>
              </div>
              {data.selectedKit ? (
                <Link href={pageHref({ cursor, editor: true })} className="text-[12px] font-semibold text-[#1e5fa6]">
                  Criar novo em vez deste
                </Link>
              ) : null}
            </div>
            {edit && !data.selectedKit ? (
              <p className="mt-3 rounded-lg bg-[#fff7ed] px-3 py-2 text-[12px] text-[#9a3412]">
                O kit solicitado não foi encontrado nesta organização. O editor foi aberto para um novo kit.
              </p>
            ) : null}
          </div>
          <KitEditor
            key={data.selectedKit?.id ?? "new"}
            kit={data.selectedKit}
            initialProcedures={data.procedures}
          />
        </Card>
      </div>
    </AppShell>
  );
}
