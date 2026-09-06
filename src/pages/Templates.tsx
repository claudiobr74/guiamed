import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Plus, UploadCloud, Edit3, Save, ArrowLeft, LayoutTemplate, Eye, ChevronLeft, ChevronRight, CheckSquare, AlignLeft, AlignCenter, AlignRight, AlignJustify, FileText, Trash2, Magnet, Copy, Layers, ArrowUpDown, ArrowLeftRight, Maximize2, SlidersHorizontal, Check, Sparkles, Wand2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Operator } from './Operators';
import { toast } from 'react-hot-toast';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { TemplateField, ContinuationConfig, AVAILABLE_MAPPINGS_GROUPED, ALL_AVAILABLE_MAPPINGS, generateFilledPdf, SAMPLE_TEST_DATA, base64ToUint8Array } from '../lib/pdfGenerator';
import { saveTemplateWithPdf, getTemplatePdfSource, duplicateTemplateWithPdf, deleteTemplateWithPdf, updateTemplatePdf, normalizePdfSource } from '../lib/templateStorage';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { AutoDetectFieldsModal } from '../components/AutoDetectFieldsModal';
import { extractPdfGuidesFromDocument, calculateSnapping, PdfGuideTarget } from '../lib/pdfGuideDetector';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Template {
  id: string;
  name: string;
  operatorId: string;
  category?: string;
  version?: string;
  validity?: string;
  tableId?: string;
  status?: string;
  pdfUrl?: string;
  pdfData?: string | null;
  hasChunks?: boolean;
  chunkCount?: number;
  fields: TemplateField[];
  continuationConfig?: ContinuationConfig;
}

export default function Templates() {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Editor State
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [smartGuidesEnabled, setSmartGuidesEnabled] = useState<boolean>(true);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);
  const [snapSensitivity, setSnapSensitivity] = useState<number>(1.5);
  const [pdfGuides, setPdfGuides] = useState<{ vertical: PdfGuideTarget[]; horizontal: PdfGuideTarget[] }>({ vertical: [], horizontal: [] });
  const [activeGuides, setActiveGuides] = useState<{ type: 'vertical' | 'horizontal'; pos: number; label?: string }[]>([]);
  const [showContinuationModal, setShowContinuationModal] = useState<boolean>(false);
  const [showAutoDetectModal, setShowAutoDetectModal] = useState<boolean>(false);
  const [pdfJsDoc, setPdfJsDoc] = useState<any>(null);
  const [isDuplicatingPage, setIsDuplicatingPage] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [testPdfUrl, setTestPdfUrl] = useState<string | null>(null);
  const [testWarnings, setTestWarnings] = useState<string[]>([]);
  const [isGeneratingTest, setIsGeneratingTest] = useState<boolean>(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  
  // Deletion State
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Direct Template Preview from List
  const [previewTemplateFromList, setPreviewTemplateFromList] = useState<{ source: string; name: string } | null>(null);
  const [isLoadingPreviewId, setIsLoadingPreviewId] = useState<string | null>(null);
  
  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', operatorId: '', category: '', version: '', validity: '', tableId: '', status: 'Ativo' 
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const opsQ = query(collection(db, 'operators'), where('doctorId', '==', user.uid));
    const opsSnap = await getDocs(opsQ);
    setOperators(opsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Operator[]);
    
    const tabsQ = query(collection(db, 'tables'), where('doctorId', '==', user.uid));
    const tabsSnap = await getDocs(tabsQ);
    setTables(tabsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    
    const tplQ = query(collection(db, 'templates'), where('doctorId', '==', user.uid));
    const tplSnap = await getDocs(tplQ);
    setTemplates(tplSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Template[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleOpenEditor = async (template: Template) => {
    setIsLoadingPdf(true);
    setEditingTemplate(template);
    setSelectedFieldId(null);
    setCurrentPage(1);

    try {
      const fullPdf = await getTemplatePdfSource(template);
      if (fullPdf) {
        setEditingTemplate(prev => prev && prev.id === template.id ? { ...prev, pdfData: fullPdf } : prev);
      } else {
        toast.error('Nenhum arquivo PDF encontrado para este template. Você pode carregar um arquivo PDF agora.');
      }
    } catch (err: any) {
      console.error('Erro ao abrir template:', err);
      toast.error('Erro ao carregar PDF do template: ' + err.message);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handlePreviewTemplate = async (template: Template) => {
    setIsLoadingPreviewId(template.id);
    try {
      const fullPdf = await getTemplatePdfSource(template);
      if (!fullPdf) {
        toast.error('Nenhum arquivo PDF encontrado para este template.');
        return;
      }
      setPreviewTemplateFromList({ source: fullPdf, name: template.name });
    } catch (err: any) {
      console.error('Erro ao visualizar template:', err);
      toast.error('Erro ao carregar PDF: ' + (err?.message || 'Falha ao carregar'));
    } finally {
      setIsLoadingPreviewId(null);
    }
  };

  const handleReuploadPdfForEditingTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTemplate || !user) return;
    setIsLoadingPdf(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64Data = evt.target?.result as string;
        if (!base64Data) {
          toast.error("Erro ao ler o arquivo selecionado.");
          setIsLoadingPdf(false);
          return;
        }
        await updateTemplatePdf(user.uid, editingTemplate.id, base64Data);
        setEditingTemplate(prev => prev ? { ...prev, pdfData: base64Data } : null);
        await fetchData();
        toast.success("Arquivo PDF vinculado com sucesso ao template!");
        setIsLoadingPdf(false);
      };
      reader.onerror = () => {
        toast.error("Erro ao processar o arquivo.");
        setIsLoadingPdf(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("Erro ao atualizar PDF:", err);
      toast.error("Erro ao atualizar PDF: " + err.message);
      setIsLoadingPdf(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFile || !formData.name || !formData.operatorId) return;
    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        if (!base64Data) {
          toast.error("Erro ao ler o arquivo selecionado.");
          setIsUploading(false);
          return;
        }
        
        try {
          // Saves template metadata and splits into chunks if > 300KB to respect Firestore limits
          await saveTemplateWithPdf(
            user.uid,
            {
              name: formData.name,
              operatorId: formData.operatorId,
              category: formData.category,
              version: formData.version,
              validity: formData.validity,
              tableId: formData.tableId,
              status: formData.status
            },
            base64Data
          );
          
          setFormData({ name: '', operatorId: '', category: '', version: '', validity: '', tableId: '', status: 'Ativo' });
          setSelectedFile(null);
          await fetchData();
          toast.success('Template enviado e processado com sucesso');
        } catch (saveErr: any) {
          console.error("Erro ao salvar template:", saveErr);
          toast.error('Erro ao salvar template: ' + saveErr.message);
        } finally {
          setIsUploading(false);
        }
      };
      
      reader.onerror = () => {
        toast.error("Erro ao ler o arquivo.");
        setIsUploading(false);
      };
      
      reader.readAsDataURL(selectedFile);
    } catch (err: any) {
      toast.error('Erro no upload: ' + err.message);
      setIsUploading(false);
    }
  };

  const duplicateTemplate = async (template: Template) => {
    if (!user) return;
    try {
      await duplicateTemplateWithPdf(user.uid, template);
      await fetchData();
      toast.success('Template duplicado com sucesso');
    } catch (e: any) {
      toast.error('Erro ao duplicar: ' + e.message);
    }
  };

  const deleteTemplate = (template: Template) => {
    setTemplateToDelete(template);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTemplateWithPdf(templateToDelete.id);
      if (editingTemplate && editingTemplate.id === templateToDelete.id) {
        setEditingTemplate(null);
        setSelectedFieldId(null);
      }
      await fetchData();
      toast.success(`Template "${templateToDelete.name}" excluído com sucesso.`);
      setTemplateToDelete(null);
    } catch (e: any) {
      console.error('Erro ao excluir template:', e);
      toast.error('Erro ao excluir template: ' + (e?.message || 'Falha na exclusão'));
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleStatus = async (template: Template) => {
    try {
      const newStatus = template.status === 'Ativo' ? 'Inativo' : 'Ativo';
      await updateDoc(doc(db, 'templates', template.id), { status: newStatus });
      fetchData();
      toast.success(`Status alterado para ${newStatus}`);
    } catch (e: any) {
      toast.error('Erro ao alterar status');
    }
  };

  type InteractionMode = 
    | 'idle' 
    | 'move' 
    | 'resize-nw' 
    | 'resize-ne' 
    | 'resize-se' 
    | 'resize-sw' 
    | 'resize-n' 
    | 'resize-s' 
    | 'resize-e' 
    | 'resize-w';

  interface InteractionState {
    fieldId: string;
    mode: InteractionMode;
    startClientX: number;
    startClientY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
    hasMoved: boolean;
  }

  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  interactionRef.current = interaction;
  const lastInteractionTimeRef = useRef<number>(0);

  // Refs to avoid stale closures in window event listeners
  const editingTemplateRef = useRef<Template | null>(editingTemplate);
  editingTemplateRef.current = editingTemplate;

  const smartGuidesEnabledRef = useRef<boolean>(smartGuidesEnabled);
  smartGuidesEnabledRef.current = smartGuidesEnabled;

  const currentPageRef = useRef<number>(currentPage);
  currentPageRef.current = currentPage;

  const pdfGuidesRef = useRef<{ vertical: PdfGuideTarget[]; horizontal: PdfGuideTarget[] }>(pdfGuides);
  pdfGuidesRef.current = pdfGuides;

  const snapSensitivityRef = useRef<number>(snapSensitivity);
  snapSensitivityRef.current = snapSensitivity;

  // Extract PDF guide lines (margins, text labels, boxes) when PDF or page changes
  useEffect(() => {
    let isCurrent = true;
    extractPdfGuidesFromDocument(pdfJsDoc, currentPage).then(guides => {
      if (isCurrent) {
        setPdfGuides(guides);
      }
    }).catch(err => {
      console.warn("Erro ao extrair guias do documento PDF:", err);
    });
    return () => {
      isCurrent = false;
    };
  }, [pdfJsDoc, currentPage]);

  const handleStartInteraction = (
    e: React.MouseEvent | React.TouchEvent,
    field: TemplateField,
    mode: InteractionMode
  ) => {
    e.stopPropagation();
    setSelectedFieldId(field.id);

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const state: InteractionState = {
      fieldId: field.id,
      mode,
      startClientX: clientX,
      startClientY: clientY,
      initialX: field.x,
      initialY: field.y,
      initialWidth: field.width,
      initialHeight: field.height,
      hasMoved: false
    };

    interactionRef.current = state;
    setInteraction(state);
    lastInteractionTimeRef.current = Date.now();
  };

  useEffect(() => {
    if (!interaction) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const current = interactionRef.current;
      if (!current || !containerRef.current) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const dx = clientX - current.startClientX;
      const dy = clientY - current.startClientY;
      if (!current.hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        current.hasMoved = true;
      }

      const rect = containerRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const deltaXPercent = (dx / rect.width) * 100;
      const deltaYPercent = (dy / rect.height) * 100;
      const MIN_W = 1.2;
      const MIN_H = 0.8;

      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

      const rawRect = {
        x: current.initialX,
        y: current.initialY,
        width: current.initialWidth,
        height: current.initialHeight
      };

      if (current.mode === 'move') {
        rawRect.x = clamp(current.initialX + deltaXPercent, 0, 100 - current.initialWidth);
        rawRect.y = clamp(current.initialY + deltaYPercent, 0, 100 - current.initialHeight);
      } else if (current.mode === 'resize-e') {
        rawRect.width = clamp(current.initialWidth + deltaXPercent, MIN_W, 100 - current.initialX);
      } else if (current.mode === 'resize-w') {
        const maxDeltaX = current.initialWidth - MIN_W;
        const actDeltaX = clamp(deltaXPercent, -current.initialX, maxDeltaX);
        rawRect.x = current.initialX + actDeltaX;
        rawRect.width = current.initialWidth - actDeltaX;
      } else if (current.mode === 'resize-s') {
        rawRect.height = clamp(current.initialHeight + deltaYPercent, MIN_H, 100 - current.initialY);
      } else if (current.mode === 'resize-n') {
        const maxDeltaY = current.initialHeight - MIN_H;
        const actDeltaY = clamp(deltaYPercent, -current.initialY, maxDeltaY);
        rawRect.y = current.initialY + actDeltaY;
        rawRect.height = current.initialHeight - actDeltaY;
      } else if (current.mode === 'resize-se') {
        rawRect.width = clamp(current.initialWidth + deltaXPercent, MIN_W, 100 - current.initialX);
        rawRect.height = clamp(current.initialHeight + deltaYPercent, MIN_H, 100 - current.initialY);
      } else if (current.mode === 'resize-sw') {
        const maxDeltaX = current.initialWidth - MIN_W;
        const actDeltaX = clamp(deltaXPercent, -current.initialX, maxDeltaX);
        rawRect.x = current.initialX + actDeltaX;
        rawRect.width = current.initialWidth - actDeltaX;
        rawRect.height = clamp(current.initialHeight + deltaYPercent, MIN_H, 100 - current.initialY);
      } else if (current.mode === 'resize-ne') {
        rawRect.width = clamp(current.initialWidth + deltaXPercent, MIN_W, 100 - current.initialX);
        const maxDeltaY = current.initialHeight - MIN_H;
        const actDeltaY = clamp(deltaYPercent, -current.initialY, maxDeltaY);
        rawRect.y = current.initialY + actDeltaY;
        rawRect.height = current.initialHeight - actDeltaY;
      } else if (current.mode === 'resize-nw') {
        const maxDeltaX = current.initialWidth - MIN_W;
        const actDeltaX = clamp(deltaXPercent, -current.initialX, maxDeltaX);
        rawRect.x = current.initialX + actDeltaX;
        rawRect.width = current.initialWidth - actDeltaX;
        const maxDeltaY = current.initialHeight - MIN_H;
        const actDeltaY = clamp(deltaYPercent, -current.initialY, maxDeltaY);
        rawRect.y = current.initialY + actDeltaY;
        rawRect.height = current.initialHeight - actDeltaY;
      }

      let finalRect = rawRect;
      let guides: { type: 'vertical' | 'horizontal'; pos: number; label: string }[] = [];

      if (smartGuidesEnabledRef.current && editingTemplateRef.current) {
        const otherFields = (editingTemplateRef.current.fields || []).filter(
          f => f.id !== current.fieldId && ((f.pageNumber || 1) === currentPageRef.current)
        );

        const snapResult = calculateSnapping(
          current.mode,
          rawRect,
          pdfGuidesRef.current,
          otherFields,
          snapSensitivityRef.current
        );

        finalRect = snapResult.rect;
        guides = snapResult.activeGuides;
      }

      setActiveGuides(guides);

      setEditingTemplate(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          fields: (prev.fields || []).map(f => f.id === current.fieldId ? {
            ...f,
            x: Math.round(finalRect.x * 10) / 10,
            y: Math.round(finalRect.y * 10) / 10,
            width: Math.round(finalRect.width * 10) / 10,
            height: Math.round(finalRect.height * 10) / 10
          } : f)
        };
      });
    };

    const handlePointerUp = () => {
      lastInteractionTimeRef.current = Date.now();
      setActiveGuides([]);
      setInteraction(null);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('touchcancel', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('touchcancel', handlePointerUp);
    };
  }, [interaction]);

  const addField = (e: React.MouseEvent) => {
    if (!editingTemplate || !containerRef.current) return;
    if (interactionRef.current?.hasMoved || (Date.now() - lastInteractionTimeRef.current < 250)) {
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    let x = Math.max(0, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100));
    let y = Math.max(0, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));

    // Magnetic snap on click placement if smart guides are active
    if (smartGuidesEnabledRef.current) {
      const snapDist = snapSensitivityRef.current;
      for (const vt of pdfGuidesRef.current.vertical) {
        if (Math.abs(x - vt.pos) < snapDist) {
          x = vt.pos;
          break;
        }
      }
      for (const ht of pdfGuidesRef.current.horizontal) {
        if (Math.abs(y - ht.pos) < snapDist) {
          y = ht.pos;
          break;
        }
      }
    }
    
    const newField: TemplateField = {
      id: Date.now().toString(),
      name: 'Novo Campo',
      mappedTo: ALL_AVAILABLE_MAPPINGS[0].value,
      pageNumber: currentPage,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: 25,
      height: 3,
      fontSize: 10,
      alignment: 'left',
      isMultiline: false,
      isCheckbox: false,
      checkboxMarker: 'X',
      isList: false,
      maxRows: 5,
      rowSpacing: 3.5
    };
    
    setEditingTemplate({
      ...editingTemplate,
      fields: [...(editingTemplate.fields || []), newField]
    });
    setSelectedFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<TemplateField>) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      fields: editingTemplate.fields.map(f => {
        if (f.id !== id) return f;
        const updated = { ...f, ...updates };
        // Auto-configure list defaults if mapping to procedure
        if (updates.mappedTo && updates.mappedTo.startsWith('procedure.')) {
          if (updated.isList === undefined) updated.isList = true;
          if (!updated.maxRows) updated.maxRows = 5;
          if (!updated.rowSpacing) updated.rowSpacing = 3.5;
        }
        return updated;
      })
    });
  };

  const removeField = (id: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      fields: editingTemplate.fields.filter(f => f.id !== id)
    });
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
    setSelectedFieldIds(prev => prev.filter(item => item !== id));
  };

  const round1 = (v: number) => Math.round(v * 10) / 10;

  // Alignment functions
  const alignSelected = (dir: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom' | 'page-center-x') => {
    if (!editingTemplate) return;
    const targetIds = selectedFieldIds.length > 0 ? selectedFieldIds : (selectedFieldId ? [selectedFieldId] : []);
    if (targetIds.length === 0) {
      toast.error("Selecione um ou mais campos para alinhar");
      return;
    }

    const currentFields = editingTemplate.fields || [];
    const selectedFields = currentFields.filter(f => targetIds.includes(f.id));

    if (selectedFields.length === 1 || dir === 'page-center-x') {
      // Align relative to page
      const updatedFields = currentFields.map(f => {
        if (!targetIds.includes(f.id)) return f;
        if (dir === 'left') return { ...f, x: 5 };
        if (dir === 'right') return { ...f, x: round1(95 - f.width) };
        if (dir === 'top') return { ...f, y: 5 };
        if (dir === 'bottom') return { ...f, y: round1(95 - f.height) };
        if (dir === 'center-x' || dir === 'page-center-x') return { ...f, x: round1(50 - f.width / 2) };
        if (dir === 'center-y') return { ...f, y: round1(50 - f.height / 2) };
        return f;
      });
      setEditingTemplate({ ...editingTemplate, fields: updatedFields });
      toast.success("Campo alinhado com a página");
      return;
    }

    // Align relative to each other
    let updatedFields = [...currentFields];
    if (dir === 'left') {
      const minX = Math.min(...selectedFields.map(f => f.x));
      updatedFields = currentFields.map(f => targetIds.includes(f.id) ? { ...f, x: minX } : f);
      toast.success(`${selectedFields.length} campos alinhados à esquerda`);
    } else if (dir === 'right') {
      const maxRight = Math.max(...selectedFields.map(f => f.x + f.width));
      updatedFields = currentFields.map(f => targetIds.includes(f.id) ? { ...f, x: round1(maxRight - f.width) } : f);
      toast.success(`${selectedFields.length} campos alinhados à direita`);
    } else if (dir === 'center-x') {
      const avgCenter = selectedFields.reduce((acc, f) => acc + (f.x + f.width / 2), 0) / selectedFields.length;
      updatedFields = currentFields.map(f => targetIds.includes(f.id) ? { ...f, x: round1(avgCenter - f.width / 2) } : f);
      toast.success(`${selectedFields.length} campos centralizados horizontalmente`);
    } else if (dir === 'top') {
      const minY = Math.min(...selectedFields.map(f => f.y));
      updatedFields = currentFields.map(f => targetIds.includes(f.id) ? { ...f, y: minY } : f);
      toast.success(`${selectedFields.length} campos alinhados ao topo`);
    } else if (dir === 'bottom') {
      const maxBottom = Math.max(...selectedFields.map(f => f.y + f.height));
      updatedFields = currentFields.map(f => targetIds.includes(f.id) ? { ...f, y: round1(maxBottom - f.height) } : f);
      toast.success(`${selectedFields.length} campos alinhados à base`);
    } else if (dir === 'center-y') {
      const avgMiddle = selectedFields.reduce((acc, f) => acc + (f.y + f.height / 2), 0) / selectedFields.length;
      updatedFields = currentFields.map(f => targetIds.includes(f.id) ? { ...f, y: round1(avgMiddle - f.height / 2) } : f);
      toast.success(`${selectedFields.length} campos centralizados verticalmente`);
    }

    setEditingTemplate({ ...editingTemplate, fields: updatedFields });
  };

  const distributeSelected = (axis: 'horizontal' | 'vertical') => {
    if (!editingTemplate) return;
    const targetIds = selectedFieldIds.length > 0 ? selectedFieldIds : (selectedFieldId ? [selectedFieldId] : []);
    if (targetIds.length < 3) {
      toast.error("Selecione pelo menos 3 campos para distribuir");
      return;
    }

    const currentFields = editingTemplate.fields || [];
    const selected = currentFields.filter(f => targetIds.includes(f.id));

    if (axis === 'horizontal') {
      const sorted = [...selected].sort((a, b) => a.x - b.x);
      const firstX = sorted[0].x;
      const lastX = sorted[sorted.length - 1].x;
      const span = lastX - firstX;
      const step = span / (sorted.length - 1);

      const posMap: Record<string, number> = {};
      sorted.forEach((f, idx) => {
        posMap[f.id] = round1(firstX + (idx * step));
      });

      const updated = currentFields.map(f => posMap[f.id] !== undefined ? { ...f, x: posMap[f.id] } : f);
      setEditingTemplate({ ...editingTemplate, fields: updated });
      toast.success("Campos distribuídos uniformemente na horizontal");
    } else {
      const sorted = [...selected].sort((a, b) => a.y - b.y);
      const firstY = sorted[0].y;
      const lastY = sorted[sorted.length - 1].y;
      const span = lastY - firstY;
      const step = span / (sorted.length - 1);

      const posMap: Record<string, number> = {};
      sorted.forEach((f, idx) => {
        posMap[f.id] = round1(firstY + (idx * step));
      });

      const updated = currentFields.map(f => posMap[f.id] !== undefined ? { ...f, y: posMap[f.id] } : f);
      setEditingTemplate({ ...editingTemplate, fields: updated });
      toast.success("Campos distribuídos uniformemente na vertical");
    }
  };

  const matchDimensions = (dimension: 'width' | 'height') => {
    if (!editingTemplate) return;
    const targetIds = selectedFieldIds.length > 0 ? selectedFieldIds : (selectedFieldId ? [selectedFieldId] : []);
    if (targetIds.length < 2) {
      toast.error("Selecione pelo menos 2 campos para igualar dimensões");
      return;
    }

    const currentFields = editingTemplate.fields || [];
    const active = currentFields.find(f => f.id === selectedFieldId) || currentFields.find(f => targetIds.includes(f.id));
    if (!active) return;

    const targetVal = dimension === 'width' ? active.width : active.height;
    const updated = currentFields.map(f => {
      if (!targetIds.includes(f.id)) return f;
      return dimension === 'width' ? { ...f, width: targetVal } : { ...f, height: targetVal };
    });

    setEditingTemplate({ ...editingTemplate, fields: updated });
    toast.success(`Campos com ${dimension === 'width' ? 'largura' : 'altura'} igualada a ${targetVal}%`);
  };

  const handleDuplicateCurrentPage = async () => {
    if (!editingTemplate || !user) return;
    setIsDuplicatingPage(true);
    try {
      const source = sanitizedPdfSource || await getTemplatePdfSource(editingTemplate);
      if (!source) {
        toast.error("Arquivo PDF não encontrado para duplicação");
        return;
      }

      const { PDFDocument } = await import('pdf-lib');
      let pdfDoc: any;
      if (typeof source === 'string') {
        const trimmed = source.trim();
        if (trimmed.startsWith('data:') || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('blob:'))) {
          const bytes = base64ToUint8Array(trimmed);
          pdfDoc = await PDFDocument.load(bytes);
        } else {
          const res = await fetch(trimmed);
          const ab = await res.arrayBuffer();
          pdfDoc = await PDFDocument.load(ab);
        }
      } else {
        pdfDoc = await PDFDocument.load(source);
      }

      const sourcePageIndex = Math.max(0, Math.min(pdfDoc.getPageCount() - 1, currentPage - 1));
      const [copiedPage] = await pdfDoc.copyPages(pdfDoc, [sourcePageIndex]);
      const insertPageIndex = currentPage;
      pdfDoc.insertPage(insertPageIndex, copiedPage);

      const pdfBytes = await pdfDoc.save();
      let binary = '';
      const bytes = new Uint8Array(pdfBytes);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const newBase64 = `data:application/pdf;base64,${btoa(binary)}`;

      const newPageNum = currentPage + 1;
      const currentFields = editingTemplate.fields || [];

      // Shift existing fields that were on pages >= newPageNum
      const shiftedFields = currentFields.map(f => {
        const p = f.pageNumber || 1;
        if (p >= newPageNum) {
          return { ...f, pageNumber: p + 1 };
        }
        return f;
      });

      // Clone header non-list fields to new page
      const clonedHeaderFields: TemplateField[] = currentFields
        .filter(f => (f.pageNumber || 1) === currentPage && !f.mappedTo.startsWith('procedure.') && !f.mappedTo.startsWith('opme.') && !f.isList)
        .map(f => ({
          ...f,
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          pageNumber: newPageNum
        }));

      const finalFields = [...shiftedFields, ...clonedHeaderFields];

      await updateTemplatePdf(user.uid, editingTemplate.id, newBase64);
      await updateDoc(doc(db, 'templates', editingTemplate.id), {
        fields: finalFields
      });

      setEditingTemplate(prev => prev ? {
        ...prev,
        pdfData: newBase64,
        fields: finalFields
      } : null);

      setNumPages(pdfDoc.getPageCount());
      setCurrentPage(newPageNum);
      await fetchData();
      toast.success(`Página ${currentPage} duplicada com sucesso! Criada a Página ${newPageNum} com os cabeçalhos clonados.`);
    } catch (err: any) {
      console.error("Erro ao duplicar página:", err);
      toast.error("Erro ao duplicar página: " + err.message);
    } finally {
      setIsDuplicatingPage(false);
    }
  };

  const handleTestPreview = async () => {
    if (!editingTemplate) return;
    setIsGeneratingTest(true);
    try {
      const source = sanitizedPdfSource || await getTemplatePdfSource(editingTemplate);
      if (!source) {
        toast.error("Arquivo PDF não encontrado");
        return;
      }
      const { pdfBytes, warnings } = await generateFilledPdf(
        source, 
        editingTemplate.fields || [], 
        SAMPLE_TEST_DATA,
        editingTemplate.continuationConfig
      );
      setTestWarnings(warnings);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setTestPdfUrl(url);
    } catch (e: any) {
      toast.error("Erro ao gerar preview com dados de teste: " + e.message);
    } finally {
      setIsGeneratingTest(false);
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.id) {
      toast.error("Identificador do template inválido.");
      return;
    }
    try {
      await updateDoc(doc(db, 'templates', editingTemplate.id), {
        fields: editingTemplate.fields || [],
        continuationConfig: editingTemplate.continuationConfig || { enabled: true, mode: 'duplicate_page', sourcePage: 1 }
      });
      setEditingTemplate(null);
      setSelectedFieldId(null);
      setSelectedFieldIds([]);
      fetchData();
      toast.success('Mapeamento salvo com sucesso');
    } catch (e: any) {
      toast.error('Erro ao salvar mapeamento: ' + e.message);
    }
  };

  const handleApplyAutoDetectedFields = (newFields: TemplateField[], replaceExisting: boolean) => {
    setEditingTemplate(prev => {
      if (!prev) return null;
      let updated: TemplateField[];
      if (replaceExisting) {
        updated = newFields;
      } else {
        const existingKeySet = new Set(prev.fields.map(f => `${f.pageNumber || 1}_${f.mappedTo}`));
        const nonDuplicates = newFields.filter(f => !existingKeySet.has(`${f.pageNumber || 1}_${f.mappedTo}`));
        updated = [...prev.fields, ...nonDuplicates];
      }
      return {
        ...prev,
        fields: updated
      };
    });
    if (newFields.length > 0) {
      setSelectedFieldId(newFields[0].id);
      setSelectedFieldIds(newFields.map(f => f.id));
    }
  };

  const sanitizedPdfSource = useMemo(() => {
    if (!editingTemplate) return null;
    const raw = editingTemplate.pdfData || editingTemplate.pdfUrl || '';
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.length < 20) return null;
    return normalizePdfSource(trimmed);
  }, [editingTemplate?.pdfData, editingTemplate?.pdfUrl]);

  const pdfDocumentData = useMemo(() => {
    if (!sanitizedPdfSource) return null;
    if (sanitizedPdfSource.startsWith('data:')) {
      try {
        const clean = sanitizedPdfSource.replace(/^data:[^;]+;base64,/, '').trim();
        const binary = atob(clean);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return { data: bytes };
      } catch (e) {
        return sanitizedPdfSource;
      }
    }
    return sanitizedPdfSource;
  }, [sanitizedPdfSource]);

  if (editingTemplate) {
    const activeField = editingTemplate.fields?.find(f => f.id === selectedFieldId);
    const currentPageFields = editingTemplate.fields?.filter(f => (!f.pageNumber && currentPage === 1) || f.pageNumber === currentPage) || [];

    return (
      <div className="space-y-6">
        {/* Test PDF Modal */}
        <PdfPreviewModal
          isOpen={!!testPdfUrl}
          onClose={() => {
            if (testPdfUrl) {
              URL.revokeObjectURL(testPdfUrl);
              setTestPdfUrl(null);
            }
          }}
          pdfSource={testPdfUrl}
          title="Pré-visualização com Dados de Teste"
          subtitle="Conferência de posições, quebras de linha e repetições na folha oficial"
          filename={`Teste_${editingTemplate.name}.pdf`}
          warnings={testWarnings}
        />

        {/* Delete Modal inside Editor */}
        {templateToDelete && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 leading-snug">
                    Excluir Template
                  </h3>
                  <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                    Tem certeza que deseja excluir o template <strong className="text-gray-900">{templateToDelete.name}</strong>?
                  </p>
                  <p className="text-[11px] text-red-600 mt-2 bg-red-50 p-2 rounded border border-red-100">
                    ⚠️ Esta ação removerá permanentemente o arquivo PDF e todos os campos mapeados associados.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() => setTemplateToDelete(null)}
                  className="text-xs text-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? 'Excluindo...' : 'Sim, Excluir Template'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Continuation Config Modal */}
        {showContinuationModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 leading-tight">
                      Folha de Continuação / Excedentes
                    </h3>
                    <p className="text-xs text-gray-500">
                      Defina como solicitações com itens excedentes de Procedimentos/OPME serão tratadas
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContinuationModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4 py-4">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/70 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.continuationConfig?.enabled ?? true}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setEditingTemplate(prev => prev ? {
                        ...prev,
                        continuationConfig: {
                          ...(prev.continuationConfig || { mode: 'duplicate_page', sourcePage: 1 }),
                          enabled
                        }
                      } : null);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-gray-900">
                      Ativar geração automática de páginas para itens excedentes
                    </span>
                    <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                      Quando o médico solicitar mais procedimentos ou itens de OPME do que cabem no formulário original, o sistema gerará automaticamente as folhas adicionais.
                    </p>
                  </div>
                </label>

                {(editingTemplate.continuationConfig?.enabled ?? true) && (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-semibold text-gray-800">
                      Escolha o formato da folha de continuação:
                    </div>

                    <div
                      onClick={() => {
                        setEditingTemplate(prev => prev ? {
                          ...prev,
                          continuationConfig: {
                            ...(prev.continuationConfig || {}),
                            enabled: true,
                            mode: 'duplicate_page'
                          }
                        } : null);
                      }}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        (editingTemplate.continuationConfig?.mode || 'duplicate_page') === 'duplicate_page'
                          ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <span>📋</span> Duplicar Folha do Formulário (Recomendado)
                        </span>
                        {(editingTemplate.continuationConfig?.mode || 'duplicate_page') === 'duplicate_page' && (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">Selecionado</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                        Clona a folha oficial da operadora com os dados do cabeçalho preenchidos e lista os procedimentos/materiais a partir do limite da primeira página. Aceito universalmente por convênios.
                      </p>
                    </div>

                    <div
                      onClick={() => {
                        setEditingTemplate(prev => prev ? {
                          ...prev,
                          continuationConfig: {
                            ...(prev.continuationConfig || {}),
                            enabled: true,
                            mode: 'annex_sheet'
                          }
                        } : null);
                      }}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        editingTemplate.continuationConfig?.mode === 'annex_sheet'
                          ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-500'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <span>📑</span> Gerar Folha Anexa Padronizada
                        </span>
                        {editingTemplate.continuationConfig?.mode === 'annex_sheet' && (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">Selecionado</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                        Anexa uma folha suplementar timbrada com os dados do paciente, médico solicitante e tabela organizada contendo todos os procedimentos e materiais excedentes.
                      </p>
                    </div>

                    {numPages > 1 && (
                      <div className="pt-2">
                        <Label className="text-xs text-gray-700 font-medium">Página base para replicação:</Label>
                        <select
                          value={editingTemplate.continuationConfig?.sourcePage || 1}
                          onChange={(e) => {
                            const p = parseInt(e.target.value, 10) || 1;
                            setEditingTemplate(prev => prev ? {
                              ...prev,
                              continuationConfig: {
                                ...(prev.continuationConfig || { enabled: true, mode: 'duplicate_page' }),
                                sourcePage: p
                              }
                            } : null);
                          }}
                          className="mt-1 w-full text-xs rounded-md border-gray-300 bg-white py-1.5 px-2.5 shadow-2xs focus:border-indigo-500 focus:ring-indigo-500"
                        >
                          {Array.from({ length: numPages }).map((_, idx) => (
                            <option key={idx + 1} value={idx + 1}>
                              Página {idx + 1} do formulário
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowContinuationModal(false)}
                  className="text-xs"
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowContinuationModal(false);
                    toast.success("Configurações de continuação aplicadas ao template.");
                  }}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Confirmar Configuração
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Auto Detect Fields Modal */}
        <AutoDetectFieldsModal
          isOpen={showAutoDetectModal}
          onClose={() => setShowAutoDetectModal(false)}
          pdfSource={pdfDocumentData || sanitizedPdfSource}
          pdfJsDoc={pdfJsDoc}
          currentPage={currentPage}
          numPages={numPages}
          existingFields={editingTemplate.fields || []}
          onApplyFields={handleApplyAutoDetectedFields}
        />

        {/* Editor Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3.5 rounded-[10px] border border-[#E2E8F0] shadow-2xs">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setEditingTemplate(null); setSelectedFieldId(null); setSelectedFieldIds([]); }} className="text-[#64748B]">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Button>
            <div>
              <h1 className="text-[16px] font-bold text-[#0F172A] leading-tight">Mapeamento: {editingTemplate.name}</h1>
              <p className="text-[11px] text-[#64748B]">
                {editingTemplate.fields?.length || 0} campos mapeados • {currentPageFields.length} nesta página
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Page navigation & Duplication */}
            <div className="flex items-center gap-1.5 bg-[#F8FAFC] px-2 py-1 rounded-[6px] border border-[#E2E8F0]">
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={currentPage <= 1} 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="h-6 w-6 p-0 text-[#64748B]"
                title="Página anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-semibold text-[#334155] px-1">
                Página {currentPage} de {numPages}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={currentPage >= numPages} 
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                className="h-6 w-6 p-0 text-[#64748B]"
                title="Próxima página"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicateCurrentPage}
                disabled={isDuplicatingPage || isLoadingPdf}
                title="Duplicar página atual no PDF e clonar os cabeçalhos"
                className="h-6 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-50 border-slate-300 ml-1 px-2"
              >
                <Copy className="h-3 w-3 mr-1 text-blue-600" />
                {isDuplicatingPage ? 'Duplicando...' : 'Duplicar Página'}
              </Button>
            </div>

            {/* Smart Guides Toggle & Sensitivity */}
            <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-1 rounded-[8px] border border-[#E2E8F0]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSmartGuidesEnabled(p => !p)}
                className={`h-[30px] px-2.5 text-[12px] font-medium transition-colors rounded-[6px] ${
                  smartGuidesEnabled 
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs hover:bg-indigo-700 hover:text-white' 
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
                title="Ativa ou desativa atração magnética inteligente no arraste e redimensionamento"
              >
                <Magnet className={`mr-1.5 h-3.5 w-3.5 ${smartGuidesEnabled ? 'text-white' : 'text-slate-500'}`} />
                Guias Magnéticas: {smartGuidesEnabled ? 'Ativas' : 'Desativadas'}
              </Button>

              {smartGuidesEnabled && (
                <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5" title="Força da atração magnética">
                  {(['0.8', '1.5', '2.5'] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSnapSensitivity(parseFloat(val))}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        snapSensitivity === parseFloat(val) 
                          ? 'bg-indigo-100 text-indigo-800 font-bold' 
                          : 'hover:bg-slate-200 text-slate-500'
                      }`}
                    >
                      {val === '0.8' ? 'Fina' : val === '1.5' ? 'Padrão' : 'Forte'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Show PDF Grid Overlay */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGridOverlay(p => !p)}
              className={`h-[34px] text-[12px] font-medium border transition-colors ${
                showGridOverlay 
                  ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold' 
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
              title="Visualizar todas as linhas e colunas detectadas no formulário PDF"
            >
              <Eye className={`mr-1.5 h-3.5 w-3.5 ${showGridOverlay ? 'text-blue-600' : 'text-slate-400'}`} />
              Grade do PDF
              {(pdfGuides.vertical.length + pdfGuides.horizontal.length > 0) && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded-full font-mono font-medium">
                  {pdfGuides.vertical.length + pdfGuides.horizontal.length}
                </span>
              )}
            </Button>

            {/* Continuation & Overflow Config */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowContinuationModal(true)}
              className="h-[34px] text-[12px] font-medium text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 border-indigo-200"
              title="Configurações de duplicação automática ou folha anexa para excesso de procedimentos/OPME"
            >
              <Layers className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
              Excedentes & Anexos
            </Button>

            {/* Automatic Field Detection Modal Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAutoDetectModal(true)}
              disabled={isLoadingPdf || !sanitizedPdfSource}
              className="h-[34px] text-[12px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200 shadow-2xs transition-colors"
              title="Identificar automaticamente campos e coordenadas via IA (Gemini) e formulários nativos"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-purple-600" />
              Identificar Campos (IA)
            </Button>
          </div>

          <div className="flex items-center gap-2.5">
            <label className="cursor-pointer">
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                onChange={handleReuploadPdfForEditingTemplate} 
              />
              <span className="inline-flex items-center justify-center h-[34px] px-3 text-[12px] font-medium text-[#475569] border border-[#CBD5E1] bg-white rounded-[8px] hover:bg-[#F8FAFC] transition shadow-2xs">
                <UploadCloud className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
                Trocar PDF
              </span>
            </label>

            <Button 
              variant="outline" 
              onClick={handleTestPreview} 
              disabled={isGeneratingTest || isLoadingPdf || !sanitizedPdfSource}
              className="h-[34px] text-[12px] font-medium text-[#1E5FA6] border-[#BFDBFE] hover:bg-[#EFF6FF]"
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              {isGeneratingTest ? 'Gerando...' : 'Visualizar com Dados de Teste'}
            </Button>

            <Button 
              onClick={saveTemplate} 
              className="h-[34px] text-[12px] font-semibold bg-[#15803D] hover:bg-[#166534] text-white shadow-2xs"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar Mapeamento
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTemplateToDelete(editingTemplate)}
              title="Excluir este template"
              className="h-[34px] text-[12px] text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>
          </div>
        </div>

        {/* Smart Alignment & Distribution Bar */}
        <div className="bg-white p-2.5 rounded-[10px] border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
              Alinhamento Automático:
            </span>
            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {(selectedFieldIds.length > 0 ? selectedFieldIds : (selectedFieldId ? [selectedFieldId] : [])).length} campo(s) selecionado(s)
            </span>
            {currentPageFields.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const ids = currentPageFields.map(f => f.id);
                  setSelectedFieldIds(ids);
                  if (ids.length > 0) setSelectedFieldId(ids[0]);
                }}
                className="h-6 text-[11px] px-2 text-indigo-600 hover:bg-indigo-50"
              >
                Selecionar Todos da Página
              </Button>
            )}
            {(selectedFieldIds.length > 0 || selectedFieldId) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFieldId(null);
                  setSelectedFieldIds([]);
                }}
                className="h-6 text-[11px] px-2 text-slate-500 hover:bg-slate-100"
              >
                Limpar Seleção
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <div className="flex items-center gap-0.5 bg-slate-50 p-1 rounded-md border border-slate-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alignSelected('left')}
                title="Alinhar à Esquerda (se múltiplos, alinha à esquerda comum; se 1, alinha à margem da página)"
                className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200 hover:text-slate-900"
              >
                <AlignLeft className="h-3.5 w-3.5 mr-1 text-slate-600" />
                Esq.
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alignSelected('center-x')}
                title="Centralizar Horizontalmente"
                className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200 hover:text-slate-900"
              >
                <AlignCenter className="h-3.5 w-3.5 mr-1 text-slate-600" />
                Centro X
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alignSelected('right')}
                title="Alinhar à Direita"
                className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200 hover:text-slate-900"
              >
                <AlignRight className="h-3.5 w-3.5 mr-1 text-slate-600" />
                Dir.
              </Button>
            </div>

            <div className="flex items-center gap-0.5 bg-slate-50 p-1 rounded-md border border-slate-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alignSelected('top')}
                title="Alinhar ao Topo"
                className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200 hover:text-slate-900"
              >
                Topo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alignSelected('center-y')}
                title="Centralizar Verticalmente"
                className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200 hover:text-slate-900"
              >
                Centro Y
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => alignSelected('bottom')}
                title="Alinhar à Base"
                className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200 hover:text-slate-900"
              >
                Base
              </Button>
            </div>

            <div className="flex items-center gap-0.5 bg-slate-50 p-1 rounded-md border border-slate-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => distributeSelected('horizontal')}
                disabled={(selectedFieldIds.length > 0 ? selectedFieldIds : (selectedFieldId ? [selectedFieldId] : [])).length < 3}
                title="Distribuir Horizontalmente (requer 3 ou mais campos selecionados)"
                className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1 text-slate-600" />
                Distribuir H
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => distributeSelected('vertical')}
                disabled={(selectedFieldIds.length > 0 ? selectedFieldIds : (selectedFieldId ? [selectedFieldId] : [])).length < 3}
                title="Distribuir Verticalmente (requer 3 ou mais campos selecionados)"
                className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-slate-600" />
                Distribuir V
              </Button>
            </div>

            <div className="flex items-center gap-0.5 bg-slate-50 p-1 rounded-md border border-slate-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => matchDimensions('width')}
                disabled={(selectedFieldIds.length > 0 ? selectedFieldIds : (selectedFieldId ? [selectedFieldId] : [])).length < 2}
                title="Igualar Largura com o campo ativo"
                className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                <Maximize2 className="h-3 w-3 mr-1 text-slate-600" />
                Igualar Largura
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => matchDimensions('height')}
                disabled={(selectedFieldIds.length > 0 ? selectedFieldIds : (selectedFieldId ? [selectedFieldId] : [])).length < 2}
                title="Igualar Altura com o campo ativo"
                className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                Igualar Altura
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          {/* PDF Canvas View */}
          <div className="xl:col-span-3 overflow-auto bg-gray-200 p-6 rounded-xl shadow-inner border border-gray-300 flex flex-col items-center">
            <div className="text-xs text-gray-600 mb-3 bg-white/90 backdrop-blur px-4 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
              <span>💡</span>
              <span><strong>Mover:</strong> Clique e arraste um campo. <strong>Redimensionar:</strong> Puxe os cantos ou laterais do campo selecionado.</span>
            </div>

            <div 
              ref={containerRef} 
              className="relative inline-block cursor-crosshair shadow-2xl bg-white select-none min-w-[300px] min-h-[400px]"
              onClick={(e) => {
                // Only add if clicking directly on the canvas, not on an existing field
                if ((e.target as HTMLElement).closest('.pdf-field')) return;
                if (selectedFieldIds.length > 0 || selectedFieldId) {
                  setSelectedFieldId(null);
                  setSelectedFieldIds([]);
                  return;
                }
                addField(e);
              }}
            >
              {/* PDF Document Detected Lines & Grid Overlay */}
              {showGridOverlay && (
                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                  {pdfGuides.vertical.map((g, idx) => (
                    <div
                      key={`grid-v-${idx}`}
                      className="absolute top-0 bottom-0 border-l border-dashed border-indigo-400/40"
                      style={{ left: `${g.pos}%` }}
                    >
                      <span className="absolute top-1 left-1 text-[8px] font-mono text-indigo-600/80 bg-white/85 px-1 py-0.2 rounded shadow-xs leading-none">
                        {g.pos}%
                      </span>
                    </div>
                  ))}
                  {pdfGuides.horizontal.map((g, idx) => (
                    <div
                      key={`grid-h-${idx}`}
                      className="absolute left-0 right-0 border-t border-dashed border-indigo-400/40"
                      style={{ top: `${g.pos}%` }}
                    >
                      <span className="absolute left-1 top-0.5 text-[8px] font-mono text-indigo-600/80 bg-white/85 px-1 py-0.2 rounded shadow-xs leading-none">
                        {g.pos}%
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Active Magnetic Smart Guides Overlay */}
              {activeGuides.map((guide, gIdx) => {
                if (guide.type === 'vertical') {
                  return (
                    <div
                      key={`guide-v-${gIdx}`}
                      className="absolute top-0 bottom-0 pointer-events-none z-50 flex flex-col items-center"
                      style={{ left: `${guide.pos}%`, width: '1px' }}
                    >
                      <div className="w-[2px] h-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.9)]" />
                      {guide.label && (
                        <div className="absolute top-2 -translate-x-1/2 bg-indigo-700 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap flex items-center gap-1 border border-indigo-400/40">
                          <Magnet className="w-2.5 h-2.5 text-indigo-200 animate-pulse" />
                          <span>{guide.label}</span>
                          <span className="opacity-80 font-mono">({guide.pos.toFixed(1)}%)</span>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={`guide-h-${gIdx}`}
                      className="absolute left-0 right-0 pointer-events-none z-50 flex items-center"
                      style={{ top: `${guide.pos}%`, height: '1px' }}
                    >
                      <div className="h-[2px] w-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.9)]" />
                      {guide.label && (
                        <div className="absolute left-2 -translate-y-1/2 bg-indigo-700 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap flex items-center gap-1 border border-indigo-400/40">
                          <Magnet className="w-2.5 h-2.5 text-indigo-200 animate-pulse" />
                          <span>{guide.label}</span>
                          <span className="opacity-80 font-mono">({guide.pos.toFixed(1)}%)</span>
                        </div>
                      )}
                    </div>
                  );
                }
              })}

              {isLoadingPdf ? (
                <div className="p-16 flex flex-col items-center justify-center text-center space-y-3 bg-white w-[820px] min-h-[500px]">
                  <div className="w-8 h-8 border-3 border-[#1E5FA6] border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-[13px] font-semibold text-[#0F172A]">Carregando arquivo PDF do template...</div>
                  <div className="text-[11px] text-[#64748B]">Buscando e montando documento para mapeamento de campos</div>
                </div>
              ) : sanitizedPdfSource ? (
                <Document 
                  file={pdfDocumentData || sanitizedPdfSource} 
                  loading={<div className="p-16 text-sm text-gray-500 flex items-center justify-center w-[820px] min-h-[500px]">Carregando visualização do PDF...</div>}
                  onLoadSuccess={(pdf) => {
                    setNumPages(pdf.numPages);
                    setPdfJsDoc(pdf);
                  }}
                  onLoadError={(err) => {
                    console.error("Erro ao renderizar PDF:", err);
                    toast.error("Não foi possível renderizar o arquivo PDF deste template.");
                  }}
                >
                  <Page pageNumber={currentPage} width={820} renderTextLayer={false} renderAnnotationLayer={false} />
                </Document>
              ) : (
                <div className="p-16 flex flex-col items-center justify-center text-center space-y-4 bg-white w-[820px] min-h-[500px] border border-dashed border-gray-300 rounded-lg">
                  <FileText className="w-12 h-12 text-[#94A3B8]" />
                  <div>
                    <div className="text-[14px] font-semibold text-[#0F172A]">Nenhum arquivo PDF encontrado para este template</div>
                    <div className="text-[12px] text-[#64748B] mt-1 max-w-md">
                      Este template foi criado sem um arquivo anexado ou o arquivo precisa ser reenviado. Selecione o arquivo PDF abaixo:
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      className="hidden" 
                      onChange={handleReuploadPdfForEditingTemplate} 
                    />
                    <div className="inline-flex items-center justify-center px-4 py-2.5 bg-[#1E5FA6] text-white text-xs font-semibold rounded-lg hover:bg-[#164980] transition shadow-sm">
                      <UploadCloud className="w-4 h-4 mr-2" />
                      Vincular Arquivo PDF a este Template
                    </div>
                  </label>
                </div>
              )}
              
              {currentPageFields.map(field => {
                const isSelected = selectedFieldIds.includes(field.id) || selectedFieldId === field.id;
                const isRepetitive = field.isList || field.mappedTo.startsWith('procedure.');
                const ghostRows = isRepetitive ? Math.min(field.maxRows || 5, 8) : 1;
                const stepSpacing = field.rowSpacing || 3.5;
                const isBeingInteracted = interaction?.fieldId === field.id;

                return (
                  <React.Fragment key={field.id}>
                    {/* Ghost preview of repeating rows for procedure lists */}
                    {isRepetitive && ghostRows > 1 && Array.from({ length: ghostRows - 1 }).map((_, rIdx) => (
                      <div
                        key={`ghost-${field.id}-${rIdx}`}
                        className="absolute border border-dashed border-blue-300 bg-blue-50/20 pointer-events-none rounded"
                        style={{
                          left: `${field.x}%`,
                          top: `${field.y + (rIdx + 1) * stepSpacing}%`,
                          width: `${field.width}%`,
                          height: `${field.height}%`
                        }}
                      >
                        <span className="text-[9px] text-blue-400 pl-1">Linha {rIdx + 2}</span>
                      </div>
                    ))}

                    <div 
                      className={`pdf-field absolute border-2 rounded select-none touch-none transition-shadow ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-500/30 ring-2 ring-blue-400/60 ring-offset-1 z-20 shadow-md cursor-move' 
                          : 'border-blue-400 bg-blue-400/15 hover:bg-blue-400/25 z-10 cursor-pointer'
                      }`}
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`
                      }}
                      onMouseDown={(e) => {
                        if (!selectedFieldIds.includes(field.id)) {
                          setSelectedFieldIds([field.id]);
                        }
                        handleStartInteraction(e, field, 'move');
                      }}
                      onTouchStart={(e) => {
                        if (!selectedFieldIds.includes(field.id)) {
                          setSelectedFieldIds([field.id]);
                        }
                        handleStartInteraction(e, field, 'move');
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (e.shiftKey) {
                          setSelectedFieldIds(prev => 
                            prev.includes(field.id) ? prev.filter(id => id !== field.id) : [...prev, field.id]
                          );
                          setSelectedFieldId(field.id);
                        } else {
                          setSelectedFieldId(field.id);
                          setSelectedFieldIds([field.id]);
                        }
                      }}
                      title={`${field.mappedTo} - Clique para selecionar (Shift+clique para múltiplos) ou arraste para mover`}
                    >
                      {/* Field Tag Header */}
                      <div className="absolute -top-5 left-0 flex items-center gap-1 pointer-events-none">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap shadow-sm ${
                          isSelected ? 'bg-blue-700 text-white' : 'bg-gray-800 text-white'
                        }`}>
                          {field.isCheckbox ? `[${field.checkboxMarker || 'X'}] ` : ''}
                          {field.mappedTo.split('.').pop()}
                          {field.isMultiline ? ' ↵' : ''}
                          {isRepetitive ? ` (x${field.maxRows || 5})` : ''}
                        </span>
                      </div>

                      {/* Interactive Handles for Selected Field */}
                      {isSelected && (
                        <>
                          {/* 4 Corner Resize Handles */}
                          <div 
                            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-600 border-2 border-white rounded-full shadow-md cursor-nwse-resize z-30 hover:scale-125 transition-transform" 
                            title="Redimensionar Canto Superior Esquerdo"
                            onMouseDown={(e) => handleStartInteraction(e, field, 'resize-nw')}
                            onTouchStart={(e) => handleStartInteraction(e, field, 'resize-nw')}
                          />
                          <div 
                            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-600 border-2 border-white rounded-full shadow-md cursor-nesw-resize z-30 hover:scale-125 transition-transform" 
                            title="Redimensionar Canto Superior Direito"
                            onMouseDown={(e) => handleStartInteraction(e, field, 'resize-ne')}
                            onTouchStart={(e) => handleStartInteraction(e, field, 'resize-ne')}
                          />
                          <div 
                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-600 border-2 border-white rounded-full shadow-md cursor-nwse-resize z-30 hover:scale-125 transition-transform" 
                            title="Redimensionar Canto Inferior Direito (Comprimento e Altura)"
                            onMouseDown={(e) => handleStartInteraction(e, field, 'resize-se')}
                            onTouchStart={(e) => handleStartInteraction(e, field, 'resize-se')}
                          />
                          <div 
                            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-600 border-2 border-white rounded-full shadow-md cursor-nesw-resize z-30 hover:scale-125 transition-transform" 
                            title="Redimensionar Canto Inferior Esquerdo"
                            onMouseDown={(e) => handleStartInteraction(e, field, 'resize-sw')}
                            onTouchStart={(e) => handleStartInteraction(e, field, 'resize-sw')}
                          />

                          {/* 4 Edge Handles for Length & Height */}
                          <div 
                            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-4 bg-blue-600 border border-white rounded-xs shadow cursor-ew-resize z-30 hover:bg-blue-700 hover:scale-110 transition-transform" 
                            title="Alterar Comprimento / Largura"
                            onMouseDown={(e) => handleStartInteraction(e, field, 'resize-e')}
                            onTouchStart={(e) => handleStartInteraction(e, field, 'resize-e')}
                          />
                          <div 
                            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-4 bg-blue-600 border border-white rounded-xs shadow cursor-ew-resize z-30 hover:bg-blue-700 hover:scale-110 transition-transform" 
                            title="Alterar Comprimento / Largura"
                            onMouseDown={(e) => handleStartInteraction(e, field, 'resize-w')}
                            onTouchStart={(e) => handleStartInteraction(e, field, 'resize-w')}
                          />
                          <div 
                            className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-4 h-2.5 bg-blue-600 border border-white rounded-xs shadow cursor-ns-resize z-30 hover:bg-blue-700 hover:scale-110 transition-transform" 
                            title="Alterar Altura"
                            onMouseDown={(e) => handleStartInteraction(e, field, 'resize-s')}
                            onTouchStart={(e) => handleStartInteraction(e, field, 'resize-s')}
                          />
                          <div 
                            className="absolute left-1/2 -top-1.5 -translate-x-1/2 w-4 h-2.5 bg-blue-600 border border-white rounded-xs shadow cursor-ns-resize z-30 hover:bg-blue-700 hover:scale-110 transition-transform" 
                            title="Alterar Altura"
                            onMouseDown={(e) => handleStartInteraction(e, field, 'resize-n')}
                            onTouchStart={(e) => handleStartInteraction(e, field, 'resize-n')}
                          />
                        </>
                      )}

                      {/* Real-time Dimensions Badge during Move/Resize */}
                      {isBeingInteracted && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur text-white text-[9px] font-mono px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap z-40">
                          X: {field.x.toFixed(1)}% | Y: {field.y.toFixed(1)}% | L: {field.width.toFixed(1)}% | A: {field.height.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          
          {/* Properties Side Panel */}
          <div className="xl:col-span-1 space-y-4">
            {activeField ? (
              <Card className="border-blue-200 shadow-md">
                <CardHeader className="py-3 px-4 bg-blue-50/60 border-b border-blue-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-blue-900">Propriedades do Campo</CardTitle>
                    <p className="text-[11px] text-blue-700">Ajuste fino visual e regras de preenchimento</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => removeField(activeField.id)}
                  >
                    Excluir
                  </Button>
                </CardHeader>
                
                <CardContent className="p-4 space-y-4 text-xs">
                  {/* Mapped attribute */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700">Dado do Sistema (Atribuição)</Label>
                    <select 
                      className="w-full text-xs p-2 border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                      value={activeField.mappedTo}
                      onChange={(e) => updateField(activeField.id, { mappedTo: e.target.value })}
                    >
                      {AVAILABLE_MAPPINGS_GROUPED.map(group => (
                        <optgroup key={group.group} label={group.group}>
                          {group.items.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Positioning Nudge & Dimensions */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-gray-700">Posição & Dimensões</Label>
                      <span className="text-[10px] text-gray-400">Valores em %</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-gray-500">X (Esquerda)</Label>
                        <div className="flex items-center mt-1">
                          <button 
                            type="button" 
                            className="px-2 py-1 bg-gray-100 border border-r-0 border-gray-300 rounded-l hover:bg-gray-200"
                            onClick={() => updateField(activeField.id, { x: Math.max(0, Math.round((activeField.x - 0.5) * 10) / 10) })}
                          >-</button>
                          <Input 
                            type="number" 
                            step="0.5" 
                            value={activeField.x} 
                            onChange={(e) => updateField(activeField.id, { x: Number(e.target.value) })} 
                            className="h-8 text-xs text-center rounded-none border-gray-300" 
                          />
                          <button 
                            type="button" 
                            className="px-2 py-1 bg-gray-100 border border-l-0 border-gray-300 rounded-r hover:bg-gray-200"
                            onClick={() => updateField(activeField.id, { x: Math.min(100, Math.round((activeField.x + 0.5) * 10) / 10) })}
                          >+</button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-[11px] text-gray-500">Y (Topo)</Label>
                        <div className="flex items-center mt-1">
                          <button 
                            type="button" 
                            className="px-2 py-1 bg-gray-100 border border-r-0 border-gray-300 rounded-l hover:bg-gray-200"
                            onClick={() => updateField(activeField.id, { y: Math.max(0, Math.round((activeField.y - 0.5) * 10) / 10) })}
                          >-</button>
                          <Input 
                            type="number" 
                            step="0.5" 
                            value={activeField.y} 
                            onChange={(e) => updateField(activeField.id, { y: Number(e.target.value) })} 
                            className="h-8 text-xs text-center rounded-none border-gray-300" 
                          />
                          <button 
                            type="button" 
                            className="px-2 py-1 bg-gray-100 border border-l-0 border-gray-300 rounded-r hover:bg-gray-200"
                            onClick={() => updateField(activeField.id, { y: Math.min(100, Math.round((activeField.y + 0.5) * 10) / 10) })}
                          >+</button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-[11px] text-gray-500">Largura (%)</Label>
                        <Input 
                          type="number" 
                          step="1" 
                          value={activeField.width} 
                          onChange={(e) => updateField(activeField.id, { width: Number(e.target.value) })} 
                          className="h-8 text-xs mt-1" 
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-gray-500">Altura (%)</Label>
                        <Input 
                          type="number" 
                          step="0.5" 
                          value={activeField.height} 
                          onChange={(e) => updateField(activeField.id, { height: Number(e.target.value) })} 
                          className="h-8 text-xs mt-1" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Typography & Alignment */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <Label className="text-xs font-semibold text-gray-700">Tipografia & Alinhamento</Label>
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        <Label className="text-[11px] text-gray-500">Tamanho da Fonte (pt)</Label>
                        <Input 
                          type="number" 
                          value={activeField.fontSize || 10} 
                          onChange={(e) => updateField(activeField.id, { fontSize: Number(e.target.value) })} 
                          className="h-8 text-xs mt-1" 
                        />
                      </div>

                      <div>
                        <Label className="text-[11px] text-gray-500">Alinhamento</Label>
                        <div className="flex rounded-md border border-gray-300 overflow-hidden mt-1">
                          <button 
                            type="button" 
                            className={`flex-1 py-1.5 flex justify-center ${(!activeField.alignment || activeField.alignment === 'left') ? 'bg-blue-50 text-blue-600 font-semibold' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                            onClick={() => updateField(activeField.id, { alignment: 'left' })}
                          >
                            <AlignLeft className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            type="button" 
                            className={`flex-1 py-1.5 flex justify-center border-l border-r border-gray-300 ${activeField.alignment === 'center' ? 'bg-blue-50 text-blue-600 font-semibold' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                            onClick={() => updateField(activeField.id, { alignment: 'center' })}
                          >
                            <AlignCenter className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            type="button" 
                            className={`flex-1 py-1.5 flex justify-center ${activeField.alignment === 'right' ? 'bg-blue-50 text-blue-600 font-semibold' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                            onClick={() => updateField(activeField.id, { alignment: 'right' })}
                          >
                            <AlignRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Special formats: Multiline / Checkbox / List */}
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <Label className="text-xs font-semibold text-gray-700">Comportamento do Campo</Label>

                    {/* Multiline Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={Boolean(activeField.isMultiline)} 
                        onChange={(e) => updateField(activeField.id, { isMultiline: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700 font-medium">Texto longo (quebra automática de linha)</span>
                    </label>

                    {/* Checkbox Toggle */}
                    <div className="space-y-2 bg-gray-50 p-2.5 rounded-md border border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={Boolean(activeField.isCheckbox)} 
                          onChange={(e) => updateField(activeField.id, { isCheckbox: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-800 font-medium">Tratar como Checkbox / Opção</span>
                      </label>

                      {activeField.isCheckbox && (
                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-200">
                          <div>
                            <Label className="text-[10px] text-gray-500">Marcar se for:</Label>
                            <Input 
                              placeholder="Ex: Eletivo, M, Urgência" 
                              value={activeField.checkboxMatchValue || ''} 
                              onChange={(e) => updateField(activeField.id, { checkboxMatchValue: e.target.value })}
                              className="h-7 text-xs mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-500">Símbolo do Marcador</Label>
                            <select 
                              value={activeField.checkboxMarker || 'X'} 
                              onChange={(e) => updateField(activeField.id, { checkboxMarker: e.target.value })}
                              className="w-full h-7 text-xs border border-gray-300 rounded mt-0.5 px-1 bg-white"
                            >
                              <option value="X">X (Letra X)</option>
                              <option value="✓">✓ (Visto / Check)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* List / Repetitive Toggle */}
                    <div className="space-y-2 bg-blue-50/50 p-2.5 rounded-md border border-blue-100">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={Boolean(activeField.isList || activeField.mappedTo.startsWith('procedure.'))} 
                          onChange={(e) => updateField(activeField.id, { isList: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-blue-900 font-medium">Repetir em Lista (Procedimentos)</span>
                      </label>

                      {(activeField.isList || activeField.mappedTo.startsWith('procedure.')) && (
                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-blue-200/60">
                          <div>
                            <Label className="text-[10px] text-gray-500">Máx. Linhas</Label>
                            <Input 
                              type="number" 
                              value={activeField.maxRows || 5} 
                              onChange={(e) => updateField(activeField.id, { maxRows: Number(e.target.value) })}
                              className="h-7 text-xs mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-500">Espaço Linhas (%)</Label>
                            <Input 
                              type="number" 
                              step="0.5" 
                              value={activeField.rowSpacing || 3.5} 
                              onChange={(e) => updateField(activeField.id, { rowSpacing: Number(e.target.value) })}
                              className="h-7 text-xs mt-0.5"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs" 
                    onClick={() => setSelectedFieldId(null)}
                  >
                    Concluir Edição do Campo
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold text-gray-900">Campos Desta Página ({currentPageFields.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-3 max-h-[600px] overflow-y-auto space-y-2">
                  {currentPageFields.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500 border border-dashed rounded-lg">
                      Nenhum campo nesta página ainda. Clique em qualquer local do PDF para adicionar o primeiro.
                    </div>
                  ) : (
                    currentPageFields.map(field => (
                      <div 
                        key={field.id} 
                        onClick={() => setSelectedFieldId(field.id)}
                        className="p-2.5 rounded-md border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                      >
                        <div className="truncate pr-2">
                          <p className="font-medium text-gray-800 truncate">{field.mappedTo}</p>
                          <p className="text-[10px] text-gray-400">X: {field.x}% • Y: {field.y}% • Fonte: {field.fontSize}pt</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeField(field.id);
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Templates de Guias PDF</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Mapeamento visual de coordenadas sobre guias oficiais das operadoras</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="border-[#E2E8F0]">
            <CardHeader className="py-4 px-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <CardTitle className="text-[14px] font-bold text-[#0F172A]">Cadastrar Novo Template</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Nome do Formulário *</Label>
                  <Input 
                    required 
                    placeholder="Ex: Guia SP/SADT Unimed Goiânia" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="h-[38px] text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Operadora Relacionada *</Label>
                  <select 
                    required
                    className="w-full h-[38px] rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-1 text-[13px] text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                    value={formData.operatorId}
                    onChange={e => setFormData({...formData, operatorId: e.target.value})}
                  >
                    <option value="">Selecione uma operadora...</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-semibold text-[#475569]">Categoria</Label>
                    <Input 
                      placeholder="Ex: Internação" 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value})} 
                      className="h-[38px] text-[13px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-semibold text-[#475569]">Versão</Label>
                    <Input 
                      placeholder="Ex: 2026.1" 
                      value={formData.version} 
                      onChange={e => setFormData({...formData, version: e.target.value})} 
                      className="h-[38px] text-[13px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Tabela Associada (Opcional)</Label>
                  <select 
                    className="w-full h-[38px] rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-1 text-[13px] text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                    value={formData.tableId}
                    onChange={e => setFormData({...formData, tableId: e.target.value})}
                  >
                    <option value="">Nenhuma...</option>
                    {tables.filter(t => t.operatorId === formData.operatorId).map(t => (
                      <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Arquivo PDF Original *</Label>
                  <div className="mt-1 flex justify-center px-4 pt-4 pb-4 border-2 border-[#CBD5E1] border-dashed rounded-[8px] relative hover:bg-[#F8FAFC] transition-colors cursor-pointer bg-white">
                    <div className="space-y-1.5 text-center">
                      <UploadCloud className="mx-auto h-8 w-8 text-[#1E5FA6]" />
                      <div className="flex text-[12px] text-[#475569] justify-center">
                        <label className="relative cursor-pointer bg-transparent rounded-[4px] font-semibold text-[#1E5FA6] hover:underline focus-within:outline-none">
                          <span>{selectedFile ? selectedFile.name : 'Selecionar arquivo PDF'}</span>
                          <input type="file" className="sr-only" accept="application/pdf" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                        </label>
                      </div>
                      {!selectedFile && <p className="text-[11px] text-[#94A3B8]">PDF em branco fornecido pela operadora</p>}
                    </div>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-[38px] text-[13px] font-semibold" 
                  disabled={isUploading || !selectedFile}
                >
                  {isUploading ? 'Enviando...' : 'Fazer Upload e Iniciar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-[#E2E8F0]">
            <CardHeader className="py-4 px-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <CardTitle className="text-[14px] font-bold text-[#0F172A]">Templates Cadastrados</CardTitle>
            </CardHeader>
            <div className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between items-center py-2">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-64" />
                      </div>
                      <Skeleton className="h-9 w-32 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <EmptyState 
                  icon={<LayoutTemplate className="h-8 w-8" />}
                  title="Nenhum template cadastrado"
                  description="Você ainda não enviou nenhum formulário PDF. Utilize a barra ao lado para fazer upload de um template em branco da operadora."
                />
              ) : (
                <div className="p-4 space-y-5">
                  {operators.map(operator => {
                    const operatorTemplates = templates.filter(t => t.operatorId === operator.id);
                    if (operatorTemplates.length === 0) return null;
                    
                    return (
                      <div key={operator.id} className="space-y-2.5">
                        <h3 className="font-semibold text-[13px] text-[#475569] uppercase tracking-wide border-b border-[#E2E8F0] pb-1.5 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#1E5FA6]"></span>
                          {operator.name}
                        </h3>
                        <div className="space-y-2">
                          {operatorTemplates.map(tpl => (
                            <div key={tpl.id} className="p-3.5 rounded-[8px] border border-[#E2E8F0] bg-white flex flex-col sm:flex-row sm:items-center justify-between hover:border-[#BFDBFE] transition-colors gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-[13px] text-[#0F172A]">{tpl.name}</h4>
                                  <span className={`inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold ${tpl.status === 'Ativo' ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]' : 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'}`}>
                                    {tpl.status || 'Ativo'}
                                  </span>
                                  {tpl.version && (
                                    <span className="inline-flex items-center rounded-[4px] bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#1E5FA6] border border-[#BFDBFE]">
                                      v{tpl.version}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[12px] text-[#64748B] mt-0.5">
                                  {tpl.category && <span className="mr-3">Categoria: {tpl.category}</span>}
                                  <span>Campos configurados: <strong className="text-[#334155]">{tpl.fields?.length || 0}</strong></span>
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handlePreviewTemplate(tpl)} 
                                  disabled={isLoadingPreviewId === tpl.id}
                                  title="Visualizar documento PDF"
                                  className="h-[30px] text-[11px] text-[#334155] border-[#CBD5E1] hover:bg-[#F1F5F9]"
                                >
                                  {isLoadingPreviewId === tpl.id ? (
                                    <span className="inline-block w-3 h-3 border-2 border-[#1E5FA6] border-t-transparent rounded-full animate-spin mr-1" />
                                  ) : (
                                    <Eye className="mr-1 h-3.5 w-3.5 text-[#1E5FA6]" />
                                  )}
                                  Visualizar
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => toggleStatus(tpl)} 
                                  title={tpl.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                                  className="h-[30px] text-[11px] text-[#64748B]"
                                >
                                  {tpl.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => duplicateTemplate(tpl)}
                                  className="h-[30px] text-[11px] text-[#475569] border-[#CBD5E1]"
                                >
                                  Duplicar
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleOpenEditor(tpl)}
                                  className="h-[30px] text-[11px] font-semibold"
                                >
                                  <Edit3 className="mr-1 h-3.5 w-3.5" /> Mapear
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => deleteTemplate(tpl)}
                                  title="Excluir template"
                                  className="h-[30px] w-[30px] p-0 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Delete Modal for Template List */}
      {templateToDelete && !editingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in duration-150">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 leading-snug">
                  Excluir Template
                </h3>
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                  Tem certeza que deseja excluir o template <strong className="text-gray-900">{templateToDelete.name}</strong>?
                </p>
                <p className="text-[11px] text-red-600 mt-2 bg-red-50 p-2 rounded border border-red-100">
                  ⚠️ Esta ação removerá permanentemente o arquivo PDF e todos os campos mapeados associados.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setTemplateToDelete(null)}
                className="text-xs text-gray-700"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir Template'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Direct Template PDF Preview Modal from List */}
      <PdfPreviewModal
        isOpen={!!previewTemplateFromList}
        onClose={() => setPreviewTemplateFromList(null)}
        pdfSource={previewTemplateFromList?.source || null}
        title={previewTemplateFromList ? `Visualização do Template: ${previewTemplateFromList.name}` : 'Visualização do Template'}
        subtitle="Visualização do documento base e formulário oficial da operadora"
        filename={previewTemplateFromList ? `Template_${previewTemplateFromList.name.replace(/\s+/g, '_')}.pdf` : 'Template.pdf'}
      />
    </div>
  );
}
