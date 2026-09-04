import Link from "next/link";
import { PencilLine } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Card, EmptyState } from "@/components/ui";
import { KitEditor } from "@/features/kits/KitEditor";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { getKit, listKitsPage } from "@/lib/db/admin-page";
import { listProceduresByIds } from "@/lib/db/procedure-lookup";

function pageHref(input: { cursor?: string | null; edit?: string | null; newKit?: boolean; editor?: boolean } = {}): string {
  const params = new URLSearchParams();
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.edit) params.set("edit", input.edit);
  if (input.newKit) params.set("new", "1");
  const query = params.toString();
  return `/kits${query ? `?${query}` : ""}${input.editor ? "#editor" : ""}`;
}

export default async function KitsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; edit?: string; new?: string }>;
}) {
  const user = await requirePageAdmin();
  const { cursor, edit, new: newKitParam } = await searchParams;
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
  const showEditor = newKitParam === "1" || Boolean(edit);

  return (
    <AppShell
      user={user}
      title="Kits cirúrgicos"
      actions={
        <Link
          href={pageHref({ cursor, newKit: true, editor: true })}
          className="inline-flex items-center justify-center rounded-lg bg-[#1e5fa6] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#184e89]"
        >
          + Novo kit
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-[#64748b]">Exibindo até 20 kits por página, em ordem alfabética.</p>
            {cursor ? (
              <Link href={pageHref()} className="text-[12px] font-semibold text-[#1e5fa6] hover:underline">
                Voltar ao início
              </Link>
            ) : null}
          </div>

          {kits.length === 0 && !cursor ? (
            <EmptyState
              title="Nenhum kit"
              description="Um kit carrega vários procedimentos com quantidade padrão em um clique."
              action={
                <Link href={pageHref({ newKit: true, editor: true })} className="text-[12px] font-semibold text-[#1e5fa6]">
                  Criar primeiro kit
                </Link>
              }
            />
          ) : kits.length === 0 ? (
            <Card>
              <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais kits nesta paginação.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {kits.map((kit) => (
                <Card key={kit.id} className="flex min-h-[150px] flex-col justify-between p-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-[14px] font-bold text-[#0f172a]">{kit.name}</h2>
                      {!kit.active ? <Badge tone="neutral">Inativo</Badge> : null}
                    </div>
                    {kit.specialty ? <div className="mt-2"><Badge tone="blue">{kit.specialty}</Badge></div> : null}
                    {kit.description ? <p className="mt-2 line-clamp-2 text-[11px] text-[#64748b]">{kit.description}</p> : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#e2e8f0] pt-3">
                    <p className="text-[12px] text-[#475569]">{kit.items.length} procedimentos</p>
                    <Link
                      href={pageHref({ cursor, edit: kit.id, editor: true })}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1e5fa6] hover:underline"
                    >
                      Editar <PencilLine size={13} aria-hidden="true" />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {data.kitPage.nextCursor ? (
            <div className="mt-4 flex justify-end">
              <Link
                href={pageHref({ cursor: data.kitPage.nextCursor })}
                className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
              >
                Próximos 20 kits
              </Link>
            </div>
          ) : null}
        </div>

        {showEditor ? (
          <Card>
            <div id="editor" className="mb-4 scroll-mt-24">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-[#0f172a]">
                    {data.selectedKit ? `Editar kit: ${data.selectedKit.name}` : "Novo kit cirúrgico"}
                  </h2>
                  <p className="mt-1 text-[12px] text-[#64748b]">
                    Pesquise os procedimentos sob demanda. A quantidade começa em 1 e pode ser alterada; ao escolher um código de referência, a quantidade padrão desse código é sugerida automaticamente.
                  </p>
                </div>
                <Link href={pageHref({ cursor })} className="text-[12px] font-semibold text-[#64748b] hover:text-[#1e5fa6]">
                  Fechar editor
                </Link>
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
        ) : null}
      </div>
    </AppShell>
  );
}
