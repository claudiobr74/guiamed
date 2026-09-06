import React, { useState, useMemo, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { 
  X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw, 
  ChevronLeft, ChevronRight, AlertCircle, FileText, Printer, Maximize2 
} from 'lucide-react';
import { Button } from './ui/button';
import { normalizePdfSource } from '../lib/templateStorage';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Ensure worker matches pdfjs.version perfectly
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfSource: string | Uint8Array | null;
  title?: string;
  subtitle?: string;
  filename?: string;
  warnings?: string[];
}

export default function PdfPreviewModal({
  isOpen,
  onClose,
  pdfSource,
  title = 'Visualização do Documento',
  subtitle = 'Guia médica gerada para conferência e impressão',
  filename = 'solicitacao_medica.pdf',
  warnings = []
}: PdfPreviewModalProps) {
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Convert source to Document file object and Blob URL for download/open
  const { fileData, directBlobUrl } = useMemo(() => {
    if (!pdfSource) return { fileData: null, directBlobUrl: null };

    if (pdfSource instanceof Uint8Array) {
      const blob = new Blob([pdfSource], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      return { fileData: { data: pdfSource }, directBlobUrl: url };
    }

    if (typeof pdfSource === 'string') {
      const normalized = normalizePdfSource(pdfSource);
      if (normalized.startsWith('data:')) {
        try {
          const clean = normalized.replace(/^data:[^;]+;base64,/, '').trim();
          const binary = atob(clean);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          return { fileData: { data: bytes }, directBlobUrl: url };
        } catch (e) {
          return { fileData: normalized, directBlobUrl: normalized };
        }
      }
      return { fileData: normalized, directBlobUrl: normalized };
    }

    return { fileData: null, directBlobUrl: null };
  }, [pdfSource]);

  useEffect(() => {
    if (directBlobUrl) {
      setBlobUrl(directBlobUrl);
    }
    return () => {
      if (directBlobUrl && directBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(directBlobUrl);
      }
    };
  }, [directBlobUrl]);

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
      setScale(window.innerWidth < 640 ? 0.72 : 1.0);
      setRotation(0);
      setRenderError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenInNewTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePrint = () => {
    if (!blobUrl) return;
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 2.5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.6));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  return (
    <div className="fixed inset-0 z-50 bg-[#0F172A]/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-[12px] shadow-[0_25px_50px_rgba(15,23,42,0.3)] w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[95vh] flex flex-col overflow-hidden border-0 sm:border border-[#CBD5E1] animate-in fade-in duration-150">
        
        {/* Header Bar */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-[#E2E8F0] flex flex-wrap items-start sm:items-center justify-between gap-2 sm:gap-3 bg-[#F8FAFC] safe-top">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#1E5FA6]" />
              <h3 className="text-[15px] font-bold text-[#0F172A] leading-tight">{title}</h3>
            </div>
            {subtitle && (
              <p className="text-[11px] text-[#64748B] mt-0.5">{subtitle}</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              className="h-[32px] text-[11px] font-medium text-[#334155] border-[#CBD5E1] hover:bg-white"
              title="Abrir PDF em nova aba do navegador"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1 text-[#1E5FA6]" />
              <span className="hidden sm:inline">Abrir em Nova Aba</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-[32px] text-[11px] font-medium text-[#334155] border-[#CBD5E1] hover:bg-white"
              title="Imprimir documento"
            >
              <Printer className="h-3.5 w-3.5 mr-1 text-gray-600" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>

            <Button
              size="sm"
              onClick={handleDownload}
              className="h-[32px] text-[11px] font-semibold bg-[#1E5FA6] hover:bg-[#184d85] text-white shadow-2xs"
              title="Baixar arquivo PDF"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Baixar PDF
            </Button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Fechar visualizador"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Warnings Banner if any */}
        {warnings && warnings.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 space-y-1">
            {warnings.map((w, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar: Navigation, Zoom & Controls */}
        <div className="px-4 py-2 bg-white border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Pagination */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="h-7 w-7 p-0 text-[#475569]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[12px] font-semibold text-[#334155] min-w-[90px] text-center">
              Página {currentPage} de {numPages || 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage >= numPages}
              onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
              className="h-7 w-7 p-0 text-[#475569]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom & Rotate Controls */}
          <div className="flex items-center gap-1.5 bg-[#F1F5F9] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
            <button
              onClick={handleZoomOut}
              className="p-1 text-[#475569] hover:text-[#0F172A] rounded"
              title="Diminuir zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-mono font-medium text-[#334155] px-1 min-w-[45px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-[#475569] hover:text-[#0F172A] rounded"
              title="Aumentar zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <div className="h-3.5 w-[1px] bg-[#CBD5E1] mx-1" />
            <button
              onClick={handleRotate}
              className="p-1 text-[#475569] hover:text-[#0F172A] rounded"
              title="Girar 90 graus"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setScale(1.0); setRotation(0); }}
              className="p-1 text-[#475569] hover:text-[#0F172A] rounded text-[10px] font-semibold"
              title="Redefinir tamanho padrão"
            >
              100%
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 min-h-0 bg-[#E2E8F0] p-2 sm:p-6 overflow-auto flex justify-center items-start">
          {fileData ? (
            <div className="shadow-2xl rounded-sm bg-white overflow-hidden transition-transform duration-100">
              <Document
                file={fileData}
                loading={
                  <div className="p-8 sm:p-16 flex flex-col items-center justify-center text-center space-y-3 bg-white w-[82vw] sm:w-[600px] min-h-[420px] sm:min-h-[500px]">
                    <div className="w-8 h-8 border-3 border-[#1E5FA6] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-semibold text-[#0F172A]">Carregando página do PDF...</p>
                  </div>
                }
                onLoadSuccess={({ numPages }) => {
                  setNumPages(numPages);
                  setRenderError(null);
                }}
                onLoadError={(err) => {
                  console.error('Erro no visualizador de PDF:', err);
                  setRenderError(err?.message || 'Falha ao renderizar PDF');
                }}
                error={
                  <div className="p-6 sm:p-12 text-center bg-white w-[82vw] sm:w-[600px] space-y-4">
                    <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">Visualização Integrada Indisponível</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                        O navegador impediu a renderização interna do documento. Você pode abrir o PDF diretamente em uma nova aba ou baixá-lo.
                      </p>
                    </div>
                    <div className="flex justify-center gap-2 pt-2">
                      <Button size="sm" onClick={handleOpenInNewTab} className="text-xs">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir em Nova Aba
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleDownload} className="text-xs">
                        <Download className="w-3.5 h-3.5 mr-1" /> Baixar Arquivo
                      </Button>
                    </div>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  rotate={rotation}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="mx-auto"
                />
              </Document>
            </div>
          ) : (
            <div className="p-16 text-center bg-white rounded-lg shadow-sm border border-gray-200">
              <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">Nenhum dado de PDF fornecido para visualização.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
