import { AppShell } from "@/components/layout/AppShell";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/page";
import { withOrganizationContext } from "@/lib/db/client";
import { listGeneratedDocuments } from "@/lib/db/generated-documents";
import { hydrateRequestDirect } from "@/lib/db/request-hydration";
import { authenticatedFileUrl } from "@/lib/storage/path";
import { notFound } from "next/navigation";
import { CODE_NOT_FOUND } from "@/types/domain";

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  const { doc: selectedDocumentId } = await searchParams;
  const data = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    try {
      return {
        request: await hydrateRequestDirect(db, user.organizationId, id),
        docs: await listGeneratedDocuments(db, user.organizationId, id),
      };
    } catch {
      return null;
    }
  });
  if (!data) notFound();

  const selectedDocument = selectedDocumentId
    ? data.docs.find((document) => document.id === selectedDocumentId)
    : data.docs[0];
  const isDraft = data.request.status === "draft";
  const snapshot = isDraft ? null : selectedDocument?.requestSnapshot ?? null;
  const pdfUrl = isDraft
    ? `/api/guias/${encodeURIComponent(id)}/preview`
    : selectedDocument
      ? authenticatedFileUrl(selectedDocument.filePath)
      : null;

  const patientName = snapshot?.patient?.fullName ?? data.request.patient?.fullName ?? "—";
  const insurerName = snapshot?.healthInsurer?.name ?? data.request.healthInsurer?.name ?? data.request.patient?.healthInsurerName ?? "—";
  const doctorLabel = snapshot?.doctor
    ? `${snapshot.doctor.name} · CRM ${snapshot.doctor.crm}/${snapshot.doctor.crmState}`
    : data.request.doctor
      ? `${data.request.doctor.name} · CRM ${data.request.doctor.crm}/${data.request.doctor.crmState}`
      : "—";
  const primaryCid = snapshot?.cids[0]
    ? `${snapshot.cids[0].code} · ${snapshot.cids[0].description}`
    : data.request.cids[0]
      ? `${data.request.cids[0].codeSnapshot} · ${data.request.cids[0].descriptionSnapshot}`
      : "—";
  const diagnosis = snapshot?.request.diagnosis ?? data.request.diagnosis?.trim() ?? "—";
  const displayItems = snapshot
    ? snapshot.items.toSorted((left, right) => left.sortOrder - right.sortOrder).map((item, index) => ({
        key: `${item.procedureId ?? "snapshot"}-${item.sortOrder}-${index}`,
        procedureName: item.procedureName,
        quantity: item.quantity,
        tussCode: item.tussCode,
        ipasgoCode: item.ipasgoCode,
      }))
    : data.request.items.toSorted((left, right) => left.sortOrder - right.sortOrder).map((item) => ({
        key: item.id,
        procedureName: item.procedureName,
        quantity: item.quantity,
        tussCode: item.tussCodeSnapshot,
        ipasgoCode: item.ipasgoCodeSnapshot,
      }));

  return (
    <AppShell user={user} title={isDraft ? "Visualização da guia" : "Documento da guia"}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-[#dbe3ee] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold text-[#0f172a]">PDF preenchido</h2>
              <Badge tone={isDraft ? "amber" : "green"}>{isDraft ? "Prévia" : "Finalizado"}</Badge>
            </div>
            {pdfUrl ? (
              <a href={pdfUrl} download className="text-[12px] font-semibold text-[#1e5fa6] hover:underline">
                {isDraft ? "Baixar prévia" : "Baixar PDF"}
              </a>
            ) : null}
          </div>
          <div className="bg-[#4b5563] p-3 sm:p-5">
            {pdfUrl ? (
              <iframe
                title={isDraft ? "Prévia do PDF preenchido" : "PDF finalizado"}
                className="mx-auto h-[72vh] min-h-[560px] w-full max-w-[860px] rounded-md border border-[#334155] bg-white shadow-sm"
                src={pdfUrl}
              />
            ) : (
              <div className="mx-auto flex min-h-[560px] max-w-[860px] items-center justify-center rounded-md bg-white p-8 text-center text-[13px] text-[#475569]">
                O documento finalizado não possui um PDF armazenado. Duplique a solicitação para gerar uma nova versão auditável.
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          {!isDraft && !snapshot ? (
            <p role="note" className="rounded-lg bg-[#fff7ed] px-3 py-2 text-[11px] text-[#9a3412]">
              Documento legado sem snapshot estruturado. O PDF é a referência histórica; o resumo usa cadastros atuais como fallback.
            </p>
          ) : null}
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold">Dados inseridos</h2>
              <Badge tone={data.request.status === "cancelled" ? "red" : isDraft ? "neutral" : "green"}>
                {data.request.status === "cancelled" ? "Cancelada" : isDraft ? "Rascunho" : "Gerada"}
              </Badge>
            </div>
            <dl className="divide-y divide-[#e2e8f0] text-[12px]">
              <SummaryRow label="Paciente" value={patientName} />
              <SummaryRow label="Convênio" value={insurerName} />
              <SummaryRow label="Médico solicitante" value={doctorLabel} />
              <SummaryRow label="CID principal" value={primaryCid} />
              <SummaryRow label="Diagnóstico" value={diagnosis || "—"} />
              <SummaryRow
                label="Procedimentos"
                value={`${displayItems.length} selecionado${displayItems.length === 1 ? "" : "s"}`}
              />
            </dl>
          </Card>

          <Card>
            <h2 className="text-[14px] font-bold">Procedimentos</h2>
            {displayItems.length > 0 ? (
              <ul className="mt-3 space-y-3 text-[12px]">
                {displayItems.map((item) => (
                  <li key={item.key} className="rounded-lg bg-[#f8fafc] px-3 py-2">
                    <p className="font-semibold text-[#0f172a]">{item.procedureName}</p>
                    <p className="mt-1 text-[#64748b]">
                      Qtd. {item.quantity} · TUSS {item.tussCode ?? CODE_NOT_FOUND}
                      {item.ipasgoCode ? ` · IPASGO ${item.ipasgoCode}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[12px] text-[#64748b]">Nenhum procedimento informado.</p>
            )}
          </Card>

          <div className="flex flex-col gap-2">
            <ButtonLink href={`/guias/${id}`} variant="secondary" className="w-full">
              {isDraft ? "Voltar e editar" : "Voltar para a guia"}
            </ButtonLink>
            {isDraft ? (
              <ButtonLink href={`/guias/${id}?step=4`} className="w-full">
                Revisar e finalizar
              </ButtonLink>
            ) : pdfUrl ? (
              <ButtonLink href={pdfUrl} download className="w-full">
                Baixar PDF
              </ButtonLink>
            ) : null}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-[#64748b]">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-[#0f172a]">{value}</dd>
    </div>
  );
}
