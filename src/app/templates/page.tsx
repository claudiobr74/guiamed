import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { requirePageAdmin } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { listInstitutions, listInsurers, listTemplates } from "@/lib/db/repos";
import { uploadTemplateAction } from "@/app/actions";
import { redirect } from "next/navigation";

export default async function TemplatesPage() {
  const user = await requirePageAdmin();
  const { templates, institutions, insurers } = await withRls(user.organizationId, user.id, async (db) => ({
    templates: await listTemplates(db, user.organizationId),
    institutions: await listInstitutions(db, user.organizationId),
    insurers: await listInsurers(db, user.organizationId),
  }));
  return (
    <AppShell user={user} title="Templates PDF">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {templates.length === 0 ? (
          <EmptyState
            title="Nenhum template cadastrado"
            description="Adicione o formulário PDF utilizado pela instituição e mapeie onde cada dado clínico deve ser renderizado."
            icon="empty-document"
          />
        ) : (
          <Card>
            <ul className="divide-y divide-[#e2e8f0] text-[13px]">
              {templates.map((t) => (
                <li key={t.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-[#94a3b8]">
                        {t.currentVersion
                          ? `v${t.currentVersion.version} • ${t.currentVersion.pageCount} pág. • ${t.currentVersion.hasAcroform ? "AcroForm" : "estático"}`
                          : "sem arquivo"}
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
                        <li key={v.id} className="flex items-center justify-between">
                          <span>
                            Versão {v.version}
                            {v.active ? " • atual" : ""}
                            {" • "}
                            {new Date(v.createdAt).toLocaleDateString("pt-BR")}
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
                  {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </Select>
              </Field>
              <Field label="Operadora">
                <Select name="healthInsurerId" defaultValue="">
                  <option value="">Nenhuma</option>
                  {insurers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
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
