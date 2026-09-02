import { AppShell } from "@/components/layout/AppShell";
import { RequestEditor } from "@/features/requests/RequestEditor";
import { requirePageUser } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { hydrateRequest, listDoctors, listInstitutions, listInsurers, listKits, listPatients, listProcedures, listTemplates } from "@/lib/db/repos";
import { notFound } from "next/navigation";

export default async function GuiaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const data = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    try {
      const [request, patients, doctors, institutions, insurers, templates, kits, procedures] = await Promise.all([
        hydrateRequest(db, user.organizationId, id),
        listPatients(db, user.organizationId),
        listDoctors(db, user.organizationId),
        listInstitutions(db, user.organizationId),
        listInsurers(db, user.organizationId),
        listTemplates(db, user.organizationId),
        listKits(db, user.organizationId),
        listProcedures(db, user.organizationId),
      ]);
      const kitProcedureIds = new Set(kits.flatMap((kit) => kit.items.map((item) => item.procedureId)));
      return {
        request,
        patients,
        doctors,
        institutions,
        insurers,
        templates,
        kits,
        kitProcedures: procedures.filter((procedure) => kitProcedureIds.has(procedure.id)),
      };
    } catch {
      return null;
    }
  });
  if (!data) notFound();
  return (
    <AppShell user={user} title="Nova solicitação cirúrgica">
      <RequestEditor
        initial={data.request}
        patients={data.patients}
        doctors={data.doctors}
        institutions={data.institutions}
        insurers={data.insurers}
        templates={data.templates}
        kits={data.kits}
        kitProcedures={data.kitProcedures}
      />
    </AppShell>
  );
}
