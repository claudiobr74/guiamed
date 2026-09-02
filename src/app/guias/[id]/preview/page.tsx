import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button, Card } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withRls } from "@/lib/db/client";
import { hydrateRequest, listGenerated } from "@/lib/db/repos";
import { publicFileUrl } from "@/lib/storage";
import { notFound } from "next/navigation";
import { CODE_NOT_FOUND } from "@/types/domain";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const data = await withRls(user.organizationId, user.id, async (db) => {
    try {
      return {
        request: await hydrateRequest(db, user.organizationId, id),
        docs: await listGenerated(db, user.organizationId, id),
      };
    } catch {
      return null;
    }
  });
  if (!data) notFound();
  const latest = data.docs[0];
  return (
    <AppShell user={user} title="Preview do PDF">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-[14px] font-bold">Dados</h2>
          <ul className="space-y-2 text-[13px] text-[#475569]">
            <li><strong>Paciente:</strong> {data.request.patient?.fullName ?? "—"}</li>
            <li><strong>Médico:</strong> {data.request.doctor?.name ?? "—"} CRM {data.request.doctor?.crm ?? "—"}</li>
            <li><strong>CID:</strong> {data.request.cids.map((c) => c.codeSnapshot).join(", ") || "—"}</li>
            <li><strong>Diagnóstico:</strong> {data.request.diagnosis ?? "—"}</li>
            {data.request.items.map((item) => (
              <li key={item.id}>
                {item.procedureName} — qtd {item.quantity} — TUSS {item.tussCodeSnapshot ?? CODE_NOT_FOUND}
              </li>
            ))}
          </ul>
          <Link href={`/guias/${id}`} className="mt-4 inline-block text-[13px] font-semibold text-[#1e5fa6]">
            Voltar e corrigir
          </Link>
        </Card>
        <Card>
          <h2 className="mb-3 text-[14px] font-bold">PDF preenchido</h2>
          {latest ? (
            <div className="flex flex-col gap-3">
              <iframe title="PDF gerado" className="h-[640px] w-full rounded-lg border border-[#e2e8f0]" src={publicFileUrl(latest.filePath)} />
              <a href={publicFileUrl(latest.filePath)} download>
                <Button type="button">Baixar PDF</Button>
              </a>
            </div>
          ) : (
            <p className="text-[13px] text-[#475569]">Nenhum PDF gerado ainda. Finalize a solicitação para preencher o arquivo original.</p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
