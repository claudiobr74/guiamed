import { AppShell } from "@/components/layout/AppShell";
import { PdfMapper } from "@/features/templates/PdfMapper";
import { requirePageUser } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { getTemplateVersion, listMappings, listRepeaters } from "@/lib/db/repos";
import { publicFileUrl } from "@/lib/storage";
import { notFound } from "next/navigation";

export default async function MapperPage({ params }: { params: Promise<{ versionId: string }> }) {
  const user = await requirePageUser();
  if (user.role !== "admin") notFound();
  const { versionId } = await params;
  const data = await withRls(user.organizationId, user.id, async (db) => {
    const version = await getTemplateVersion(db, user.organizationId, versionId);
    if (!version) return null;
    return {
      version,
      mappings: await listMappings(db, user.organizationId, versionId),
      repeaters: await listRepeaters(db, user.organizationId, versionId),
    };
  });
  if (!data) notFound();
  return (
    <AppShell user={user} title="Editor de mapeamento">
      <PdfMapper
        version={data.version}
        initialMappings={data.mappings}
        initialRepeaters={data.repeaters}
        fileUrl={publicFileUrl(data.version.filePath)}
      />
    </AppShell>
  );
}
