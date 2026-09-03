"use client";

import { useEffect, useRef, useState } from "react";
import { SEMANTIC_FIELDS, suggestSemanticField } from "@/lib/mapping-suggest";
import type { AcroFormField, FieldMapping, PdfRepeater, TemplateVersion } from "@/types/domain";
import { Button, Card, Select } from "@/components/ui";
import { saveMappingsAction, saveRepeaterAction } from "@/app/actions";

export function PdfMapper({
  version,
  initialMappings,
  fileUrl,
}: {
  version: TemplateVersion;
  initialMappings: FieldMapping[];
  initialRepeaters?: unknown;
  fileUrl: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [mappings, setMappings] = useState(initialMappings);
  const [selected, setSelected] = useState<string | null>(null);
  const [semantic, setSemantic] = useState("patient.full_name");
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState<{ x: number; y: number; pointerId: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const pageSize = { w: version.pageWidth ?? 595, h: version.pageHeight ?? 842 };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (typeof Worker !== "undefined" && !pdfjs.GlobalWorkerOptions.workerPort) {
          pdfjs.GlobalWorkerOptions.workerPort = new Worker(
            new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
            { type: "module" },
          );
        }
        const doc = await pdfjs.getDocument({ url: fileUrl }).promise;
        const pdfPage = await doc.getPage(page);
        const viewport = pdfPage.getViewport({ scale: 1.2 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setCanvasSize({ width: viewport.width, height: viewport.height });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (!cancelled) setStatus("");
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? `Não foi possível carregar o PDF: ${error.message}` : "Não foi possível carregar o PDF.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, page]);

  function canvasToPdf(x: number, y: number, w: number, h: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { x, y, width: w, height: h };
    const scaleX = pageSize.w / canvas.width;
    const scaleY = pageSize.h / canvas.height;
    return { x: x * scaleX, y: y * scaleY, width: w * scaleX, height: h * scaleY };
  }

  function pointerPosition(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = pointerPosition(e);
    setDrag({ ...point, pointerId: e.pointerId });
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const point = pointerPosition(e);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const x = Math.min(drag.x, point.x);
    const y = Math.min(drag.y, point.y);
    const w = Math.abs(point.x - drag.x);
    const h = Math.abs(point.y - drag.y);
    setDrag(null);
    if (w < 8 || h < 8) return;
    const pdf = canvasToPdf(x, y, w, h);
    const mapping: FieldMapping = {
      id: crypto.randomUUID(),
      templateVersionId: version.id,
      semanticField: semantic,
      pdfFieldName: null,
      mappingKind: "overlay",
      page,
      x: pdf.x,
      y: pdf.y,
      width: pdf.width,
      height: pdf.height,
      fontSize: 10,
      alignment: "left",
      multiline: h > 28,
      autoShrink: true,
      maxCharacters: null,
      required: false,
    };
    setMappings((prev) => [...prev, mapping]);
    setSelected(mapping.id);
  }

  function onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
    if (drag?.pointerId === e.pointerId) setDrag(null);
  }

  async function save() {
    await saveMappingsAction(
      version.id,
      mappings.map(({ id, templateVersionId, ...rest }) => {
        void id;
        void templateVersionId;
        return rest;
      }),
    );
    setStatus("Mapeamento salvo.");
  }

  async function addRepeater() {
    const repeater: Omit<PdfRepeater, "id"> = {
      templateVersionId: version.id,
      source: "procedures",
      page,
      startX: 40,
      startY: 400,
      rowHeight: 18,
      maxRows: 5,
      columns: [
        { field: "name", x: 40, width: 220 },
        { field: "tuss", x: 270, width: 80 },
        { field: "quantity", x: 360, width: 40 },
      ],
    };
    await saveRepeaterAction(repeater);
    setStatus("Região repetidora criada. Ajuste as coordenadas e salve novamente se necessário.");
  }

  function confirmAcroform(field: AcroFormField) {
    const suggested = suggestSemanticField(field.name) ?? semantic;
    setMappings((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        templateVersionId: version.id,
        semanticField: suggested,
        pdfFieldName: field.name,
        mappingKind: "acroform",
        page: field.page ?? 1,
        x: 0,
        y: 0,
        width: 100,
        height: 16,
        fontSize: 10,
        alignment: "left",
        multiline: false,
        autoShrink: true,
        maxCharacters: null,
        required: false,
      },
    ]);
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
      <div className="overflow-auto rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] p-3">
        <div className="mb-2 flex items-center gap-2 text-[13px]">
          <Button variant="secondary" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}>Página anterior</Button>
          <span>Página {page} / {version.pageCount}</span>
          <Button variant="secondary" type="button" onClick={() => setPage((p) => Math.min(version.pageCount, p + 1))}>Próxima</Button>
        </div>
        <div className="relative inline-block">
          <canvas
            ref={canvasRef}
            className="block max-w-full touch-none bg-white"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
          {mappings
            .filter((m) => m.page === page && m.mappingKind === "overlay")
            .map((m) => {
              const sx = canvasSize.width / pageSize.w;
              const sy = canvasSize.height / pageSize.h;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m.id)}
                  className={`absolute border-2 text-left text-[10px] ${selected === m.id ? "border-[#1e5fa6] bg-[#1e5fa6]/20" : "border-emerald-500 bg-emerald-500/10"}`}
                  style={{
                    left: m.x * sx,
                    top: m.y * sy,
                    width: m.width * sx,
                    height: m.height * sy,
                  }}
                >
                  {m.semanticField}
                </button>
              );
            })}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Card>
          <h2 className="mb-2 text-[14px] font-bold">Campo semântico</h2>
          <Select value={semantic} onChange={(e) => setSemantic(e.target.value)}>
            {SEMANTIC_FIELDS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
            {[0, 1, 2, 3, 4].flatMap((i) =>
              ["name", "tuss", "ipasgo", "quantity"].map((k) => (
                <option key={`p${i}${k}`} value={`procedures[${i}].${k}`}>{`procedures[${i}].${k}`}</option>
              )),
            )}
          </Select>
          <p className="mt-2 text-[12px] text-[#475569]">Clique e arraste com mouse, toque ou caneta sobre o PDF para posicionar. Coordenadas são salvas em pontos do PDF, não em pixels da tela.</p>
          <div className="mt-3 flex flex-col gap-2">
            <Button type="button" onClick={() => void save()}>Salvar mapeamento</Button>
            <Button type="button" variant="secondary" onClick={() => void addRepeater()}>Criar região repetidora</Button>
          </div>
          {status ? <p className={`mt-2 text-[12px] ${status.startsWith("Não foi possível") ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{status}</p> : null}
        </Card>
        {version.hasAcroform ? (
          <Card>
            <h2 className="mb-2 text-[14px] font-bold">Campos AcroForm</h2>
            <p className="mb-2 text-[12px] text-[#475569]">Sugestões automáticas exigem confirmação.</p>
            <ul className="space-y-2 text-[12px]">
              {version.acroformFields.map((field) => (
                <li key={field.name} className="flex items-center justify-between gap-2">
                  <span>{field.name} → {suggestSemanticField(field.name) ?? "sem sugestão"}</span>
                  <Button type="button" variant="subtle" className="px-2 py-1 text-[11px]" onClick={() => confirmAcroform(field)}>
                    Confirmar
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <p className="text-[13px] text-[#475569]">PDF estático detectado. Use o editor visual.</p>
          </Card>
        )}
        <Card>
          <h2 className="mb-2 text-[14px] font-bold">Mapeados</h2>
          <ul className="space-y-1 text-[12px]">
            {mappings.map((m) => (
              <li key={m.id} className="flex justify-between gap-2">
                <button type="button" className="text-left text-[#1e5fa6]" onClick={() => setSelected(m.id)}>
                  {m.semanticField}
                </button>
                <button type="button" className="text-[#dc2626]" onClick={() => setMappings((prev) => prev.filter((x) => x.id !== m.id))}>
                  remover
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
