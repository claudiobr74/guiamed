import Link from "next/link";
import { FileText, PencilLine } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Card, EmptyState } from "@/components/ui";
import { TemplateUploadForm } from "@/features/templates/TemplateUploadForm";
import { requirePageAdmin } from "@/lib/auth/page";
import { orgCollection, withOrganizationContext } from "@/lib/db/client";
import { listTemplatesPage } from "@/lib/db/template-page";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await requirePageAdmin();
  const { cursor } = await searchParams;
  const data = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const templatePage = await listTemplatesPage(db, user.organizationId, { cursor, limit: 20 });
    const institutionIds = [...new Set(templatePage.items.map((template) => template.institutionId).filter((id): id is string => Boolean(id)))];
    const insurerIds = [...new Set(templatePage.items.map((template) => template.healthInsurerId).filter((id): id is string => Boolean(id)))];
    const institutionNames = new Map<string, string>();
    const insurerNames = new Map<string, string>();

    if (institutionIds.length > 0) {
      const snapshots = await db.getAll(...institutionIds.map((id) => orgCollection(db, user.organizationId, "institutions").doc(id)));
      for (const snapshot of snapshots) {
        if (snapshot.exists) institutionNames.set(snapshot.id, String(snapshot.data()?.name ?? ""));
      }
    }
    if (insurerIds.length > 0) {
      const snapshots = await db.getAll(...insurerIds.map((id) => orgCollection(db, user.organizationId, "healthInsurers").doc(id)));
      for (const snapshot of snapshots) {
        if (snapshot.exists) insurerNames.set(snapshot.id, String(snapshot.data()?.name ?? ""));
      }
    }

    return { templatePage, institutionNames, insurerNames };
  });
  const templates = data.templatePage.items;

  return (
    <AppShell
      user={user}
      title="Templates PDF"
      actions={
        <details className="group relative">
          <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-lg bg-[#1e5fa6] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#184e89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e5fa6] focus-visible:ring-offset-2">
            + Novo template
          </summary>
          <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[min(420px,calc(100vw-32px))] rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xl">
            <h2 className="mb-1 text-[15px] font-bold text-[#0f172a]">Upload do PDF original</h2>
            <p className="mb-4 text-[11px] text-[#64748b]">O PDF é validado antes do envio e permanece em armazenamento privado.</p>
            <TemplateUploadForm />
          </div>
        </details>
      }
    >
      {templates.length === 0 && !cursor ? (
        <EmptyState
          title="Nenhum template cadastrado"
          description="Adicione o formulário PDF utilizado pela instituição e mapeie onde cada dado clínico deve ser renderizado."
          icon="empty-document"
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
            <p className="text-[12px] text-[#64748b]">Até 20 templates por página; versões históricas são carregadas somente para os itens visíveis.</p>
            {cursor ? <Link href="/templates" className="text-[12px] font-semibold text-[#1e5fa6] hover:underline">Voltar ao início</Link> : null}
          </div>

          {templates.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#64748b]">Não há mais templates nesta paginação.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-[12px]">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#475569]">
                  <tr>
                    <th className="px-4 py-3">Instituição / convênio</th>
                    <th className="px-4 py-3">Nome do formulário</th>
                    <th className="px-4 py-3">Versão</th>
                    <th className="px-4 py-3">Páginas</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Atualização</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => {
                    const current = template.currentVersion;
                    const institutionName = template.institutionId ? data.institutionNames.get(template.institutionId) : null;
                    const insurerName = template.healthInsurerId ? data.insurerNames.get(template.healthInsurerId) : null;
                    const context = [institutionName, insurerName].filter(Boolean).join(" / ") || "Sem vínculo específico";
                    return (
                      <tr key={template.id} className="border-t border-[#e2e8f0] align-top">
                        <td className="px-4 py-3 font-semibold text-[#0f172a]">{context}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0f172a]">{template.name}</p>
                          {(template.versions?.length ?? 0) > 1 ? (
                            <details className="mt-1">
                              <summary className="cursor-pointer list-none text-[10px] font-semibold text-[#1e5fa6] hover:underline">
                                Ver {template.versions?.length} versões
                              </summary>
                              <ul className="mt-2 min-w-[220px] space-y-1 rounded-lg bg-[#f8fafc] p-2 text-[10px] text-[#475569]">
                                {template.versions?.map((version) => (
                                  <li key={version.id} className="flex items-center justify-between gap-3">
                                    <span>v{version.version}{version.active ? " • atual" : ""} • {version.createdAt ? new Date(version.createdAt).toLocaleDateString("pt-BR") : "sem data"}</span>
                                    <Link href={`/templates/${version.id}/mapper`} className="font-semibold text-[#1e5fa6]">Abrir</Link>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#475569]">{current ? `v${current.version}` : "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#475569]">{current ? current.pageCount : "—"}</td>
                        <td className="px-4 py-3 text-[#475569]">{current ? (current.hasAcroform ? "AcroForm" : "Overlay") : "—"}</td>
                        <td className="px-4 py-3"><Badge tone={template.active && current ? "green" : "neutral"}>{template.active && current ? "Ativo" : "Inativo"}</Badge></td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#64748b]">{current?.createdAt ? new Date(current.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {current ? (
                            <Link
                              href={`/templates/${current.id}/mapper`}
                              className="inline-flex size-8 items-center justify-center rounded-md text-[#475569] hover:bg-[#eff6ff] hover:text-[#1e5fa6]"
                              aria-label={`Mapear template ${template.name}`}
                              title="Abrir mapeamento"
                            >
                              <PencilLine size={16} aria-hidden="true" />
                            </Link>
                          ) : (
                            <span className="inline-flex size-8 items-center justify-center text-[#94a3b8]" title="Sem versão ativa"><FileText size={15} aria-hidden="true" /></span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data.templatePage.nextCursor ? (
            <div className="flex justify-end border-t border-[#e2e8f0] p-4">
              <Link
                href={`/templates?cursor=${encodeURIComponent(data.templatePage.nextCursor)}`}
                className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-semibold text-[#1e5fa6] hover:bg-[#eff6ff]"
              >
                Próximos 20 templates
              </Link>
            </div>
          ) : null}
        </Card>
      )}
    </AppShell>
  );
}
