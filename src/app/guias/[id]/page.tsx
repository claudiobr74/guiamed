import { AppShell } from "@/components/layout/AppShell";
import { FinalizedRequestView } from "@/features/requests/FinalizedRequestView";
import { RequestEditor } from "@/features/requests/RequestEditor";
import { RequestTussTablePicker } from "@/features/requests/RequestTussTablePicker";
import { requirePageUser } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listTussCodeTables } from "@/lib/db/code-tables";
import { getLatestGeneratedDocument } from "@/lib/db/generated-documents";
import { listProceduresByIds } from "@/lib/db/procedure-lookup";
import { hydrateRequestDirect } from "@/lib/db/request-hydration";
import { getTemplate, getTemplateVersion, listDoctors, listInstitutions, listInsurers, listKits, listTemplates } from "@/lib/db/repos";
import { notFound } from "next/navigation";

export default async function GuiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const user = await requirePageUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requestedStep = Array.isArray(query.step) ? query.step[0] : query.step;
  const parsedStep = Number(requestedStep);
  const initialStep = Number.isInteger(parsedStep) && parsedStep >= 0 && parsedStep <= 4 ? parsedStep : 0;
  const data = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    try {
      const request = await hydrateRequestDirect(db, user.organizationId, id);

      if (request.status !== "draft") {
        const [template, version, generatedDocument] = await Promise.all([
          request.templateId ? getTemplate(db, user.organizationId, request.templateId) : Promise.resolve(null),
          request.templateVersionId ? getTemplateVersion(db, user.organizationId, request.templateVersionId) : Promise.resolve(null),
          getLatestGeneratedDocument(db, user.organizationId, request.id),
        ]);
        return {
          request,
          doctors: [],
          institutions: [],
          insurers: [],
          templates: [],
          kits: [],
          kitProcedures: [],
          tussTables: [],
          selectedTemplate: template ? { ...template, currentVersion: version } : null,
          finalizedSnapshot: generatedDocument?.requestSnapshot ?? null,
        };
      }

      const [doctors, institutions, insurers, templates, kits, tussTables] = await Promise.all([
        listDoctors(db, user.organizationId),
        listInstitutions(db, user.organizationId),
        listInsurers(db, user.organizationId),
        listTemplates(db, user.organizationId),
        listKits(db, user.organizationId),
        listTussCodeTables(db, user.organizationId),
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
        tussTables,
        selectedTemplate: templates.find((template) => template.id === request.templateId) ?? null,
        finalizedSnapshot: null,
      };
    } catch {
      return null;
    }
  });
  if (!data) notFound();

  return (
    <AppShell user={user} title={data.request.status === "draft" ? "Nova solicitação cirúrgica" : "Guia cirúrgica"}>
      {data.request.status === "draft" ? (
        <div className="flex flex-col gap-5">
          <RequestTussTablePicker
            requestId={data.request.id}
            selectedKey={data.request.tussTableKey}
            tables={data.tussTables}
          />
          <RequestEditor
            key={data.request.tussTableKey ?? "no-tuss-table"}
            initial={data.request}
            patients={[]}
            doctors={data.doctors}
            institutions={data.institutions}
            insurers={data.insurers}
            templates={data.templates}
            kits={data.kits}
            kitProcedures={data.kitProcedures}
            initialStep={initialStep}
          />
        </div>
      ) : (
        <FinalizedRequestView
          request={data.request}
          template={data.selectedTemplate}
          snapshot={data.finalizedSnapshot}
        />
      )}
    </AppShell>
  );
}
