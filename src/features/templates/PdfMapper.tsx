"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { SEMANTIC_FIELDS, suggestSemanticField } from "@/lib/mapping-suggest";
import {
  isMapperArrowKey,
  moveMappingByKeyboard,
  resizeMappingByKeyboard,
} from "@/lib/pdf/mapper-keyboard";
import type { AcroFormField, FieldMapping, PdfRepeater, RepeaterColumn, TemplateVersion } from "@/types/domain";
import { Button, Card, Input, Select } from "@/components/ui";
import { saveMappingsAction, saveRepeatersAction } from "@/features/templates/actions";

const REPEATER_FIELDS: Array<RepeaterColumn["field"]> = [
  "name",
  "tuss",
  "ipasgo",
  "quantity",
  "laterality",
  "notes",
];

type TransformState = {
  id: string;
  mode: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  origin: FieldMapping;
};

function formatPoint(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function PdfMapper({
  version,
  initialMappings,
  initialRepeaters = [],
  fileUrl,
}: {
  version: TemplateVersion;
  initialMappings: FieldMapping[];
  initialRepeaters?: PdfRepeater[];
  fileUrl: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mappingElementsRef = useRef(new Map<string, HTMLDivElement>());
  const pendingMappingFocusRef = useRef<string | null>(null);
  const [page, setPage] = useState(1);
  const [mappings, setMappings] = useState(initialMappings);
  const [repeaters, setRepeaters] = useState(initialRepeaters);
  const [selected, setSelected] = useState<string | null>(initialMappings[0]?.id ?? null);
  const [selectedRepeater, setSelectedRepeater] = useState<string | null>(initialRepeaters[0]?.id ?? null);
  const [semantic, setSemantic] = useState("patient.full_name");
  const [status, setStatus] = useState("");
  const [drag, setDrag] = useState<{ x: number; y: number; pointerId: number } | null>(null);
  const [transform, setTransform] = useState<TransformState | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const pageSize = { w: version.pageWidth ?? 595, h: version.pageHeight ?? 842 };

  const selectedMapping = useMemo(
    () => mappings.find((mapping) => mapping.id === selected) ?? null,
    [mappings, selected],
  );
  const activeRepeater = useMemo(
    () => repeaters.find((repeater) => repeater.id === selectedRepeater) ?? null,
    [repeaters, selectedRepeater],
  );

  useEffect(() => {
    const id = pendingMappingFocusRef.current;
    if (!id) return;
    mappingElementsRef.current.get(id)?.focus();
    pendingMappingFocusRef.current = null;
  }, [mappings]);

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

  function pointerPosition(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = pointerPosition(e);
    setDrag({ ...point, pointerId: e.pointerId });
  }

  function onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
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
    setSelectedRepeater(null);
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (drag?.pointerId === e.pointerId) setDrag(null);
  }

  function patchMapping(id: string, partial: Partial<FieldMapping>) {
    setMappings((current) => current.map((mapping) => (mapping.id === id ? { ...mapping, ...partial } : mapping)));
  }

  function addKeyboardMapping() {
    const width = Math.min(180, Math.max(40, pageSize.w - 48));
    const height = Math.min(36, Math.max(16, pageSize.h - 48));
    const mapping: FieldMapping = {
      id: crypto.randomUUID(),
      templateVersionId: version.id,
      semanticField: semantic,
      pdfFieldName: null,
      mappingKind: "overlay",
      page,
      x: Math.max(0, (pageSize.w - width) / 2),
      y: Math.max(0, Math.min(pageSize.h - height, pageSize.h * 0.35)),
      width,
      height,
      fontSize: 10,
      alignment: "left",
      multiline: false,
      autoShrink: true,
      maxCharacters: null,
      required: false,
    };
    pendingMappingFocusRef.current = mapping.id;
    setMappings((current) => [...current, mapping]);
    setSelected(mapping.id);
    setSelectedRepeater(null);
    setStatus(`Campo ${semantic} criado na página ${page}. Use as setas para posicionar.`);
  }

  function onMappingKeyDown(event: ReactKeyboardEvent<HTMLElement>, mapping: FieldMapping) {
    if (!isMapperArrowKey(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const next = moveMappingByKeyboard(
      mapping,
      event.key,
      event.shiftKey ? 10 : 1,
      pageSize.w,
      pageSize.h,
    );
    setSelected(mapping.id);
    setSelectedRepeater(null);
    patchMapping(mapping.id, next);
    setStatus(
      `Campo ${mapping.semanticField}: X ${formatPoint(next.x)} pt, Y ${formatPoint(next.y)} pt.`,
    );
  }

  function onResizeKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, mapping: FieldMapping) {
    if (!isMapperArrowKey(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const next = resizeMappingByKeyboard(
      mapping,
      event.key,
      event.shiftKey ? 10 : 1,
      pageSize.w,
      pageSize.h,
    );
    setSelected(mapping.id);
    setSelectedRepeater(null);
    patchMapping(mapping.id, next);
    setStatus(
      `Campo ${mapping.semanticField}: largura ${formatPoint(next.width)} pt, altura ${formatPoint(next.height)} pt.`,
    );
  }

  function startTransform(
    e: ReactPointerEvent<HTMLElement>,
    mapping: FieldMapping,
    mode: TransformState["mode"],
  ) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(mapping.id);
    setSelectedRepeater(null);
    setTransform({
      id: mapping.id,
      mode,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origin: mapping,
    });
  }

  function moveTransform(e: ReactPointerEvent<HTMLElement>) {
    if (!transform || transform.pointerId !== e.pointerId) return;
    e.preventDefault();
    const sx = pageSize.w / Math.max(1, canvasSize.width);
    const sy = pageSize.h / Math.max(1, canvasSize.height);
    const dx = (e.clientX - transform.startClientX) * sx;
    const dy = (e.clientY - transform.startClientY) * sy;
    if (transform.mode === "move") {
      patchMapping(transform.id, {
        x: Math.max(0, Math.min(pageSize.w - transform.origin.width, transform.origin.x + dx)),
        y: Math.max(0, Math.min(pageSize.h - transform.origin.height, transform.origin.y + dy)),
      });
    } else {
      patchMapping(transform.id, {
        width: Math.max(4, Math.min(pageSize.w - transform.origin.x, transform.origin.width + dx)),
        height: Math.max(4, Math.min(pageSize.h - transform.origin.y, transform.origin.height + dy)),
      });
    }
  }

  function endTransform(e: ReactPointerEvent<HTMLElement>) {
    if (!transform || transform.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setTransform(null);
  }

  async function save() {
    setStatus("Salvando...");
    try {
      await Promise.all([
        saveMappingsAction(
          version.id,
          mappings.map(({ id, templateVersionId, ...rest }) => {
            void id;
            void templateVersionId;
            return rest;
          }),
        ),
        saveRepeatersAction(
          version.id,
          repeaters.map(({ templateVersionId, ...rest }) => {
            void templateVersionId;
            return rest;
          }),
        ),
      ]);
      setStatus("Mapeamentos e regiões repetidoras salvos.");
    } catch (error) {
      setStatus(error instanceof Error ? `Não foi possível salvar: ${error.message}` : "Não foi possível salvar o mapeamento.");
    }
  }

  function addRepeater() {
    const margin = 32;
    const usable = Math.max(240, pageSize.w - margin * 2);
    const nameWidth = usable * 0.42;
    const tussWidth = usable * 0.18;
    const ipasgoWidth = usable * 0.18;
    const quantityWidth = Math.max(42, usable * 0.1);
    const repeater: PdfRepeater = {
      id: crypto.randomUUID(),
      templateVersionId: version.id,
      source: "procedures",
      page,
      startX: margin,
      startY: Math.min(pageSize.h - 120, Math.max(40, pageSize.h * 0.52)),
      rowHeight: 18,
      maxRows: 5,
      columns: [
        { field: "name", x: margin, width: nameWidth, fontSize: 9 },
        { field: "tuss", x: margin + nameWidth, width: tussWidth, fontSize: 9 },
        { field: "ipasgo", x: margin + nameWidth + tussWidth, width: ipasgoWidth, fontSize: 9 },
        { field: "quantity", x: margin + nameWidth + tussWidth + ipasgoWidth, width: quantityWidth, fontSize: 9 },
      ],
    };
    setRepeaters((current) => [...current, repeater]);
    setSelectedRepeater(repeater.id);
    setSelected(null);
  }

  function patchRepeater(id: string, partial: Partial<PdfRepeater>) {
    setRepeaters((current) => current.map((repeater) => (repeater.id === id ? { ...repeater, ...partial } : repeater)));
  }

  function patchRepeaterColumn(repeaterId: string, index: number, partial: Partial<RepeaterColumn>) {
    setRepeaters((current) => current.map((repeater) => {
      if (repeater.id !== repeaterId) return repeater;
      const columns = [...repeater.columns];
      columns[index] = { ...columns[index], ...partial };
      return { ...repeater, columns };
    }));
  }

  function confirmAcroform(field: AcroFormField) {
    const suggested = suggestSemanticField(field.name) ?? semantic;
    const mapping: FieldMapping = {
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
    };
    setMappings((prev) => [...prev, mapping]);
    setSelected(mapping.id);
    setSelectedRepeater(null);
  }

  const sx = canvasSize.width / pageSize.w;
  const sy = canvasSize.height / pageSize.h;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="overflow-auto rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
          <Button variant="secondary" type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Página anterior</Button>
          <span>Página {page} / {version.pageCount}</span>
          <Button variant="secondary" type="button" disabled={page === version.pageCount} onClick={() => setPage((p) => Math.min(version.pageCount, p + 1))}>Próxima</Button>
          <span id="pdf-mapper-keyboard-help" className="ml-auto max-w-[560px] text-[11px] text-[#64748b]">
            Ponteiro: arraste para criar, mover e redimensionar. Teclado: use “Adicionar campo sem desenhar”; setas movem o campo; no botão de redimensionar, setas ajustam o tamanho; Shift altera 10 pt.
          </span>
        </div>
        <div className="relative inline-block">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Página ${page} de ${version.pageCount} do template PDF`}
            className="block max-w-full touch-none bg-white"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
          {mappings
            .filter((mapping) => mapping.page === page && mapping.mappingKind === "overlay")
            .map((mapping) => (
              <div
                key={mapping.id}
                ref={(element) => {
                  if (element) mappingElementsRef.current.set(mapping.id, element);
                  else mappingElementsRef.current.delete(mapping.id);
                }}
                role="group"
                tabIndex={0}
                aria-label={`Campo ${mapping.semanticField}, X ${formatPoint(mapping.x)} pt, Y ${formatPoint(mapping.y)} pt, largura ${formatPoint(mapping.width)} pt, altura ${formatPoint(mapping.height)} pt`}
                aria-describedby="pdf-mapper-keyboard-help"
                onFocus={() => {
                  setSelected(mapping.id);
                  setSelectedRepeater(null);
                }}
                onKeyDown={(event) => onMappingKeyDown(event, mapping)}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelected(mapping.id);
                  setSelectedRepeater(null);
                }}
                onPointerDown={(event) => startTransform(event, mapping, "move")}
                onPointerMove={moveTransform}
                onPointerUp={endTransform}
                onPointerCancel={endTransform}
                className={`absolute touch-none border-2 text-left text-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e5fa6] ${selected === mapping.id ? "border-[#1e5fa6] bg-[#1e5fa6]/20" : "border-emerald-500 bg-emerald-500/10"}`}
                style={{
                  left: mapping.x * sx,
                  top: mapping.y * sy,
                  width: mapping.width * sx,
                  height: mapping.height * sy,
                }}
              >
                <span className="pointer-events-none line-clamp-2 px-1">{mapping.semanticField}</span>
                <button
                  type="button"
                  aria-label={`Redimensionar ${mapping.semanticField}`}
                  aria-describedby="pdf-mapper-keyboard-help"
                  onKeyDown={(event) => onResizeKeyDown(event, mapping)}
                  onPointerDown={(event) => startTransform(event, mapping, "resize")}
                  onPointerMove={moveTransform}
                  onPointerUp={endTransform}
                  onPointerCancel={endTransform}
                  className="absolute -bottom-3 -right-3 size-6 touch-none rounded-full border-4 border-white bg-[#1e5fa6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f172a]"
                />
              </div>
            ))}
          {repeaters.filter((repeater) => repeater.page === page).map((repeater) => {
            const right = Math.max(...repeater.columns.map((column) => column.x + column.width));
            const width = Math.max(20, right - repeater.startX);
            return (
              <button
                key={repeater.id}
                type="button"
                onClick={() => {
                  setSelectedRepeater(repeater.id);
                  setSelected(null);
                }}
                className={`absolute border-2 border-dashed px-1 text-left text-[10px] ${selectedRepeater === repeater.id ? "border-[#7c3aed] bg-[#ede9fe]/60" : "border-[#a78bfa] bg-[#f5f3ff]/40"}`}
                style={{
                  left: repeater.startX * sx,
                  top: repeater.startY * sy,
                  width: width * sx,
                  height: repeater.rowHeight * repeater.maxRows * sy,
                }}
              >
                Repeater • {repeater.maxRows} linhas
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex max-h-[calc(100vh-130px)] flex-col gap-3 overflow-y-auto pr-1">
        <Card>
          <h2 className="mb-2 text-[14px] font-bold">Criar campo</h2>
          <Select value={semantic} onChange={(e) => setSemantic(e.target.value)}>
            {SEMANTIC_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}
            {[0, 1, 2, 3, 4].flatMap((index) =>
              ["name", "tuss", "ipasgo", "quantity", "laterality", "notes"].map((key) => (
                <option key={`p${index}${key}`} value={`procedures[${index}].${key}`}>{`procedures[${index}].${key}`}</option>
              )),
            )}
          </Select>
          <p className="mt-2 text-[12px] text-[#475569]">
            Desenhe a área no PDF com mouse, toque ou Apple Pencil, ou use o botão abaixo para criar um campo centralizado e posicioná-lo integralmente pelo teclado.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void save()}>Salvar tudo</Button>
            <Button type="button" variant="secondary" onClick={addKeyboardMapping}>Adicionar campo sem desenhar</Button>
            <Button type="button" variant="secondary" onClick={addRepeater}>Nova região de procedimentos</Button>
          </div>
          {status ? <p role="status" className={`mt-2 text-[12px] ${status.startsWith("Não foi possível") ? "text-[#dc2626]" : "text-[#166534]"}`}>{status}</p> : null}
        </Card>

        {selectedMapping ? (
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-bold">Propriedades do campo</h2>
              <button type="button" className="text-[12px] font-semibold text-[#dc2626]" onClick={() => {
                setMappings((current) => current.filter((mapping) => mapping.id !== selectedMapping.id));
                setSelected(null);
              }}>Excluir</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <label className="col-span-2">Campo semântico<Select value={selectedMapping.semanticField} onChange={(e) => patchMapping(selectedMapping.id, { semanticField: e.target.value })}>
                {SEMANTIC_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}
                {[0, 1, 2, 3, 4].flatMap((index) => REPEATER_FIELDS.map((key) => <option key={`${index}-${key}`} value={`procedures[${index}].${key}`}>{`procedures[${index}].${key}`}</option>))}
              </Select></label>
              <NumberField label="Página" value={selectedMapping.page} min={1} max={version.pageCount} onChange={(value) => patchMapping(selectedMapping.id, { page: Math.trunc(value) })} />
              <NumberField label="Fonte" value={selectedMapping.fontSize} min={4} max={72} step={0.5} onChange={(value) => patchMapping(selectedMapping.id, { fontSize: value })} />
              <NumberField label="X" value={selectedMapping.x} min={0} step={0.5} onChange={(value) => patchMapping(selectedMapping.id, { x: value })} />
              <NumberField label="Y" value={selectedMapping.y} min={0} step={0.5} onChange={(value) => patchMapping(selectedMapping.id, { y: value })} />
              <NumberField label="Largura" value={selectedMapping.width} min={1} step={0.5} onChange={(value) => patchMapping(selectedMapping.id, { width: value })} />
              <NumberField label="Altura" value={selectedMapping.height} min={1} step={0.5} onChange={(value) => patchMapping(selectedMapping.id, { height: value })} />
              <label>Alinhamento<Select value={selectedMapping.alignment} onChange={(e) => patchMapping(selectedMapping.id, { alignment: e.target.value as FieldMapping["alignment"] })}>
                <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
              </Select></label>
              <NumberField label="Máx. caracteres" value={selectedMapping.maxCharacters ?? 0} min={0} onChange={(value) => patchMapping(selectedMapping.id, { maxCharacters: value > 0 ? Math.trunc(value) : null })} />
              <label className="col-span-2">Tipo<Select value={selectedMapping.mappingKind} onChange={(e) => patchMapping(selectedMapping.id, { mappingKind: e.target.value as FieldMapping["mappingKind"] })}>
                <option value="overlay">Overlay</option><option value="acroform">AcroForm</option>
              </Select></label>
              {selectedMapping.mappingKind === "acroform" ? (
                <label className="col-span-2">Campo PDF<Select value={selectedMapping.pdfFieldName ?? ""} onChange={(e) => patchMapping(selectedMapping.id, { pdfFieldName: e.target.value || null })}>
                  <option value="">Selecione</option>
                  {version.acroformFields.map((field) => <option key={field.name} value={field.name}>{field.name} ({field.type})</option>)}
                </Select></label>
              ) : null}
              <CheckField label="Multiline" checked={selectedMapping.multiline} onChange={(checked) => patchMapping(selectedMapping.id, { multiline: checked })} />
              <CheckField label="Auto reduzir fonte" checked={selectedMapping.autoShrink} onChange={(checked) => patchMapping(selectedMapping.id, { autoShrink: checked })} />
              <CheckField label="Obrigatório" checked={selectedMapping.required} onChange={(checked) => patchMapping(selectedMapping.id, { required: checked })} />
            </div>
          </Card>
        ) : null}

        {activeRepeater ? (
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-bold">Região de procedimentos</h2>
              <button type="button" className="text-[12px] font-semibold text-[#dc2626]" onClick={() => {
                setRepeaters((current) => current.filter((repeater) => repeater.id !== activeRepeater.id));
                setSelectedRepeater(null);
              }}>Excluir região</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <NumberField label="Página" value={activeRepeater.page} min={1} max={version.pageCount} onChange={(value) => patchRepeater(activeRepeater.id, { page: Math.trunc(value) })} />
              <NumberField label="Linhas máximas" value={activeRepeater.maxRows} min={1} max={100} onChange={(value) => patchRepeater(activeRepeater.id, { maxRows: Math.trunc(value) })} />
              <NumberField label="X inicial" value={activeRepeater.startX} min={0} step={0.5} onChange={(value) => patchRepeater(activeRepeater.id, { startX: value })} />
              <NumberField label="Y inicial" value={activeRepeater.startY} min={0} step={0.5} onChange={(value) => patchRepeater(activeRepeater.id, { startY: value })} />
              <NumberField label="Altura da linha" value={activeRepeater.rowHeight} min={1} step={0.5} onChange={(value) => patchRepeater(activeRepeater.id, { rowHeight: value })} />
            </div>
            <div className="mt-3 space-y-3">
              {activeRepeater.columns.map((column, index) => (
                <div key={`${activeRepeater.id}-${index}`} className="rounded-lg border border-[#e2e8f0] p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <strong className="text-[11px]">Coluna {index + 1}</strong>
                    {activeRepeater.columns.length > 1 ? <button type="button" className="text-[11px] text-[#dc2626]" onClick={() => patchRepeater(activeRepeater.id, { columns: activeRepeater.columns.filter((_, columnIndex) => columnIndex !== index) })}>remover</button> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="col-span-2">Conteúdo<Select value={column.field} onChange={(e) => patchRepeaterColumn(activeRepeater.id, index, { field: e.target.value })}>
                      {REPEATER_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}
                    </Select></label>
                    <NumberField label="X" value={column.x} min={0} step={0.5} onChange={(value) => patchRepeaterColumn(activeRepeater.id, index, { x: value })} />
                    <NumberField label="Largura" value={column.width} min={1} step={0.5} onChange={(value) => patchRepeaterColumn(activeRepeater.id, index, { width: value })} />
                    <NumberField label="Fonte" value={column.fontSize ?? 9} min={4} max={72} step={0.5} onChange={(value) => patchRepeaterColumn(activeRepeater.id, index, { fontSize: value })} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => patchRepeater(activeRepeater.id, {
                columns: [...activeRepeater.columns, { field: "notes", x: activeRepeater.startX, width: 100, fontSize: 9 }],
              })}>Adicionar coluna</Button>
            </div>
          </Card>
        ) : null}

        {version.hasAcroform ? (
          <Card>
            <h2 className="mb-2 text-[14px] font-bold">Campos AcroForm</h2>
            <p className="mb-2 text-[12px] text-[#475569]">Sugestões automáticas exigem confirmação administrativa.</p>
            <ul className="space-y-2 text-[12px]">
              {version.acroformFields.map((field) => (
                <li key={field.name} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{field.name} → {suggestSemanticField(field.name) ?? "sem sugestão"}</span>
                  <Button type="button" variant="subtle" className="px-2 py-1 text-[11px]" onClick={() => confirmAcroform(field)}>Confirmar</Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <h2 className="mb-2 text-[14px] font-bold">Resumo</h2>
          <p className="text-[12px] text-[#475569]">{mappings.length} campo(s) • {repeaters.length} região(ões) repetidora(s).</p>
        </Card>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label>
      {label}
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-2 py-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
