import { AppShell } from "@/components/layout/AppShell";
import { FinalizedRequestView } from "@/features/requests/FinalizedRequestView";
import { RequestEditor } from "@/features/requests/RequestEditor";
import { requirePageUser } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listProceduresByIds } from "@/lib/db/procedure-lookup";
import { hydrateRequest, listDoctors, listInstitutions, listInsurers, listKits, listTemplates } from "@/lib/db/repos";
import { notFound } from "next/navigation";

export default async function GuiaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const data = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    try {
      const [request, doctors, institutions, insurers, templates, kits] = await Promise.all([
        hydrateRequest(db, user.organizationId, id),
        listDoctors(db, user.organizationId),
        listInstitutions(db, user.organizationId),
        listInsurers(db, user.organizationId),
        listTemplates(db, user.organizationId),
        listKits(db, user.organizationId),
      ]);
      const kitProcedureIds = [...new Set(kits.flatMap((kit) => kit.items.map((item) => item.procedureId)))];
      const kitProcedures = await listProceduresByIds(db, user.organizationId, kitProcedureIds);
      return {
        request,
        doctors,
        institutions,
        insurers,
        templates,
        kits,
        kitProcedures,
      };
    } catch {
      return null;
    }
  });
  if (!data) notFound();

  const selectedTemplate = data.templates.find((template) => template.id === data.request.templateId) ?? null;

  return (
    <AppShell user={user} title={data.request.status === "draft" ? "Nova solicitação cirúrgica" : "Guia cirúrgica"}>
      {data.request.status === "draft" ? (
        <RequestEditor
          initial={data.request}
          patients={[]}
          doctors={data.doctors}
          institutions={data.institutions}
          insurers={data.insurers}
          templates={data.templates}
          kits={data.kits}
          kitProcedures={data.kitProcedures}
        />
      ) : (
        <FinalizedRequestView request={data.request} template={selectedTemplate} />
      )}
    </AppShell>
  );
}
