import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { requirePageAdmin } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listTemplatesPage } from "@/lib/db/template-page";
import { listInstitutions, listInsurers } from "@/lib/db/repos";
import { uploadTemplateAction } from "@/app/actions";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await requirePageAdmin();
  const { cursor } = await searchParams;
  const { templatePage, institutions, insurers } = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const [templatePage, institutions, insurers] = await Promise.all([
      listTemplatesPage(db, user.organizationId, { cursor, limit: 20 }),
      listInstitutions(db, user.organizationId),
      listInsurers(db, user.organizationId),
    ]);
    return { templatePage, institutions, insurers };
  });
  const templates = templatePage.items;

  return (
    <AppShell user={user} title="Templates PDF">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {templates.length === 0 && !cursor ? (
          <EmptyState
            title="Nenhum template cadastrado"
            description="Adicione o formulário PDF utilizado pela instituição e mapeie onde cada dado clínico deve ser renderizado."
            icon="empty-document"
          />
        ) : (
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[12px] text-[#64748b]">Exibindo até 20 templates por página, com versões históricas apenas dos itens visíveis.</p>
              {cursor ? (
                <Link href="/templates" className="text-[12px] font-semibold text-[#1e5fa6]">
                  Voltar ao início
                </Link>
              ) : null}
            </div>
            {templates.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais templates nesta paginação.</p>
            ) : (
              <ul className="divide-y divide-[#e2e8f0] text-[13px]">
                {templates.map((t) => (
                  <li key={t.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{t.name}{t.active ? "" : " • inativo"}</p>
                        <p className="text-[#94a3b8]">
                          {t.currentVersion
                            ? `v${t.currentVersion.version} • ${t.currentVersion.pageCount} pág. • ${t.currentVersion.hasAcroform ? "AcroForm" : "estático"}`
                            : "sem versão ativa"}
                        </p>
                      </div>
                      {t.currentVersion ? (
                        <Link className="font-semibold text-[#1e5fa6]" href={`/templates/${t.currentVersion.id}/mapper`}>
                          Mapear
                        </Link>
                      ) : null}
                    </div>
                    {(t.versions?.length ?? 0) > 1 ? (
                      <ul className="mt-2 space-y-1 text-[12px] text-[#475569]">
                        {t.versions?.map((v) => (
                          <li key={v.id} className="flex items-center justify-between gap-3">
                            <span>
                              Versão {v.version}
                              {v.active ? " • atual" : ""}
                              {" • "}
                              {v.createdAt ? new Date(v.createdAt).toLocaleDateString("pt-BR") : "data não registrada"}
                            </span>
                            <Link className="font-semibold text-[#1e5fa6]" href={`/templates/${v.id}/mapper`}>
                              Abrir
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {templatePage.nextCursor ? (
              <div className="mt-4 flex justify-end border-t border-[#e2e8f0] pt-4">
                <Link
                  href={`/templates?cursor=${encodeURIComponent(templatePage.nextCursor)}`}
                  className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
                >
                  Próximos 20 templates
                </Link>
              </div>
            ) : null}
          </Card>
        )}
        {user.role === "admin" ? (
          <Card>
            <h2 className="mb-3 text-[14px] font-bold">Upload do PDF original</h2>
            <form
              action={async (formData) => {
                "use server";
                const result = await uploadTemplateAction(formData);
                redirect(`/templates/${result.versionId}/mapper`);
              }}
              className="flex flex-col gap-3"
            >
              <Field label="Nome"><Input name="name" required placeholder="Solicitação cirúrgica IPASGO" /></Field>
              <Field label="Instituição">
                <Select name="institutionId" defaultValue="">
                  <option value="">Nenhuma</option>
                  {institutions.filter((institution) => institution.active).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </Select>
              </Field>
              <Field label="Operadora">
                <Select name="healthInsurerId" defaultValue="">
                  <option value="">Nenhuma</option>
                  {insurers.filter((insurer) => insurer.active).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </Select>
              </Field>
              <Field label="Arquivo PDF">
                <Input name="file" type="file" accept="application/pdf" required />
              </Field>
              <Button type="submit">Enviar e abrir editor</Button>
            </form>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
