import React, { useState } from 'react';
import { Button } from './ui/button';
import { Sparkles, Wand2, FileSearch, CheckCircle2, AlertCircle, RefreshCw, Layers, Check, X } from 'lucide-react';
import { 
  DetectedFieldSuggestion, 
  detectAcroForms, 
  detectFromTextLayer, 
  detectWithAI, 
  convertSuggestionsToTemplateFields 
} from '../lib/fieldDetector';
import { TemplateField, ALL_AVAILABLE_MAPPINGS } from '../lib/pdfGenerator';
import toast from 'react-hot-toast';

interface AutoDetectFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfSource: string | ArrayBuffer | Uint8Array | null;
  pdfJsDoc: any;
  currentPage: number;
  numPages: number;
  existingFields: TemplateField[];
  onApplyFields: (newFields: TemplateField[], replaceExisting: boolean) => void;
}

export const AutoDetectFieldsModal: React.FC<AutoDetectFieldsModalProps> = ({
  isOpen,
  onClose,
  pdfSource,
  pdfJsDoc,
  currentPage,
  numPages,
  existingFields,
  onApplyFields
}) => {
  const [method, setMethod] = useState<'hybrid_local' | 'ai_vision'>('hybrid_local');
  const [scope, setScope] = useState<'current_page' | 'all_pages'>('current_page');
  const [replaceMode, setReplaceMode] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [detectedFields, setDetectedFields] = useState<DetectedFieldSuggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'choose' | 'review'>('choose');

  if (!isOpen) return null;

  const handleStartDetection = async () => {
    if (!pdfSource) {
      toast.error('Arquivo PDF não carregado');
      return;
    }

    setIsDetecting(true);
    setDetectedFields([]);
    setSelectedIds(new Set());

    try {
      let results: DetectedFieldSuggestion[] = [];

      if (method === 'hybrid_local') {
        setStatusMessage('Inspecionando campos interativos do formulário (AcroForms)...');
        const acroResults = await detectAcroForms(pdfSource);

        const targetPages = scope === 'current_page' 
          ? [currentPage] 
          : Array.from({ length: numPages }, (_, i) => i + 1);

        // Filter acroResults to target pages if applicable
        const filteredAcro = acroResults.filter(f => targetPages.includes(f.pageNumber));
        results.push(...filteredAcro);

        if (pdfJsDoc) {
          setStatusMessage('Analisando rótulos da camada de texto vetorial...');
          for (const pNum of targetPages) {
            const textResults = await detectFromTextLayer(pdfJsDoc, pNum);
            // Avoid duplicate mappings on the same page
            const existingMappingsOnPage = new Set(results.filter(r => r.pageNumber === pNum).map(r => r.mappedTo));
            for (const tr of textResults) {
              if (!existingMappingsOnPage.has(tr.mappedTo)) {
                results.push(tr);
                existingMappingsOnPage.add(tr.mappedTo);
              }
            }
          }
        }
      } else {
        // AI Vision with Gemini 3.8 Flash
        setStatusMessage('Renderizando página e acionando IA Gemini 3.8 Flash...');
        if (!pdfJsDoc) {
          throw new Error('Documento PDF não inicializado no visualizador');
        }

        const targetPages = scope === 'current_page' 
          ? [currentPage] 
          : Array.from({ length: numPages }, (_, i) => i + 1);

        for (const pNum of targetPages) {
          setStatusMessage(`Analisando visualmente a Página ${pNum} com Gemini...`);
          const page = await pdfJsDoc.getPage(pNum);
          const viewport = page.getViewport({ scale: 1.5 }); // High-res render for OCR
          
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Falha ao instanciar canvas de renderização');

          await page.render({ canvasContext: ctx, viewport }).promise;
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

          const aiResults = await detectWithAI(imageBase64, pNum);
          results.push(...aiResults);
        }
      }

      if (results.length === 0) {
        toast('Nenhum campo evidente foi detectado automaticamente neste modo. Tente o modo de Visão com IA.', {
          icon: 'ℹ️',
          duration: 5000
        });
        setIsDetecting(false);
        return;
      }

      setDetectedFields(results);
      setSelectedIds(new Set(results.map(r => r.id)));
      setStep('review');
      toast.success(`${results.length} campos identificados com sucesso!`);
    } catch (err: any) {
      console.error('Erro na detecção automática:', err);
      toast.error('Erro na detecção: ' + (err.message || 'Verifique se o backend está ativo'));
    } finally {
      setIsDetecting(false);
      setStatusMessage('');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === detectedFields.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(detectedFields.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    const chosenSuggestions = detectedFields.filter(f => selectedIds.has(f.id));
    if (chosenSuggestions.length === 0) {
      toast.error('Selecione pelo menos um campo para aplicar');
      return;
    }

    const converted = convertSuggestionsToTemplateFields(chosenSuggestions);
    onApplyFields(converted, replaceMode);
    toast.success(`${converted.length} campos adicionados ao template!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-tight flex items-center gap-2">
                Identificação Automática de Campos
                <span className="text-[10px] uppercase font-semibold tracking-wide bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  IA & Heurística
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                Detecte posições de dados do paciente, médico, CID e procedimentos sem posicionamento manual
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl p-1 leading-none rounded-md"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {step === 'choose' ? (
            <>
              {/* Method Selection */}
              <div>
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-2">
                  Método de Detecção
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setMethod('hybrid_local')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      method === 'hybrid_local'
                        ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <FileSearch className="w-4 h-4 text-indigo-600" /> Detecção Rápida (Nativa)
                      </span>
                      {method === 'hybrid_local' && (
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Lê formulários interativos oficiais (*AcroForms*) e analisa palavras-chave na camada de texto vetorial. Instantâneo e offline.
                    </p>
                  </div>

                  <div
                    onClick={() => setMethod('ai_vision')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      method === 'ai_vision'
                        ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" /> Visão Multimodal com IA
                      </span>
                      {method === 'ai_vision' && (
                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                          Gemini 3.8
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Recomendado para PDFs digitalizados, guias escaneadas ou formulários de convênio com tabelas complexas de procedimentos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Scope & Replace Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Escopo da Detecção:
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as any)}
                    className="w-full text-xs rounded-lg border-gray-300 bg-white py-2 px-3 shadow-2xs focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="current_page">Apenas Página Atual (Pág. {currentPage})</option>
                    {numPages > 1 && (
                      <option value="all_pages">Todas as {numPages} páginas do formulário</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Tratamento de Campos Existentes:
                  </label>
                  <select
                    value={replaceMode ? 'replace' : 'merge'}
                    onChange={(e) => setReplaceMode(e.target.value === 'replace')}
                    className="w-full text-xs rounded-lg border-gray-300 bg-white py-2 px-3 shadow-2xs focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="merge">Manter existentes e adicionar detectados</option>
                    <option value="replace">Substituir todos os campos atuais</option>
                  </select>
                </div>
              </div>

              {existingFields.length > 0 && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-start gap-2.5 text-amber-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    O template já possui <strong>{existingFields.length} campos</strong> mapeados. Você poderá revisar e selecionar individualmente cada campo encontrado antes de salvar.
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Review Step */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Campos Detectados ({selectedIds.size} de {detectedFields.length} selecionados)
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Desmarque os campos que não desejar importar ou edite os detalhes após a aplicação.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="text-xs h-7"
                >
                  {selectedIds.size === detectedFields.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </Button>
              </div>

              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[350px] overflow-y-auto bg-gray-50/30">
                {detectedFields.map((field) => {
                  const isChecked = selectedIds.has(field.id);
                  const mappingObj = ALL_AVAILABLE_MAPPINGS.find(m => m.value === field.mappedTo);

                  return (
                    <div
                      key={field.id}
                      onClick={() => toggleSelect(field.id)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked ? 'bg-indigo-50/30 hover:bg-indigo-50/50' : 'hover:bg-gray-100/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(field.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900">
                              {field.name}
                            </span>
                            <span className="text-[10px] font-mono bg-gray-200/80 text-gray-700 px-1.5 py-0.2 rounded">
                              {field.mappedTo}
                            </span>
                            {field.isCheckbox && (
                              <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded">
                                Checkbox
                              </span>
                            )}
                            {field.isList && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded">
                                Tabela/Lista
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-3">
                            <span>Pág. {field.pageNumber}</span>
                            <span>Posição: X={field.x}% Y={field.y}%</span>
                            <span>Tam: {field.width}% × {field.height}%</span>
                            <span className="text-indigo-600">
                              Fonte: {field.source === 'acroform' ? 'Formulário Nativo' : field.source === 'ai_vision' ? 'IA Gemini' : 'Texto Vetorial'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-[11px] font-medium text-gray-500">
                        {Math.round(field.confidence * 100)}% confiança
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
          {step === 'choose' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isDetecting}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleStartDetection}
                disabled={isDetecting}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
              >
                {isDetecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{statusMessage || 'Processando...'}</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Iniciar Identificação</span>
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('choose')}
                className="text-xs"
              >
                Voltar e Reconfigurar
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={selectedIds.size === 0}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Aplicar {selectedIds.size} Campos Selecionados</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
