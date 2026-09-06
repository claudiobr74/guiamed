import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Search, Plus, Trash2, FileText, Star, ChevronUp, ChevronDown,
  Eye, Package, Sparkles, Building2, User, Stethoscope, AlertCircle, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { normalizeText } from '../lib/utils';
import { CID10Selector } from '../components/CID10Selector';
import { CID10Snapshot } from '../types/cid10';
import { generateFilledPdf, PdfGenerationData } from '../lib/pdfGenerator';
import { getTemplatePdfSource } from '../lib/templateStorage';
import PdfPreviewModal from '../components/PdfPreviewModal';

interface OpmeItem {
  id: string;
  description: string;
  quantity: number;
  manufacturer?: string;
  reference?: string;
  anvisa?: string;
  justification?: string;
}

interface ProcedureKit {
  id: string;
  name: string;
  procedures: any[];
  tableId?: string;
  cid?: string;
  indication?: string;
}

export default function NewRequest() {
  const { user, profile } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');

  const [clinicalData, setClinicalData] = useState<{
    indication: string;
    cid: string;
    cidCode: string;
    cidDescription: string;
    cidFull: string;
    cidSource: string;
    cidVersion: string;
    secondaryCid: string;
    secondaryCids: CID10Snapshot[];
    justification: string;
    date: string;
  }>({
    indication: '',
    cid: '',
    cidCode: '',
    cidDescription: '',
    cidFull: '',
    cidSource: 'CID-10 Brasil / DATASUS',
    cidVersion: '2008',
    secondaryCid: '',
    secondaryCids: [],
    justification: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Hospitalization Details
  const [showHospitalization, setShowHospitalization] = useState(false);
  const [hospitalization, setHospitalization] = useState({
    character: 'Eletivo',
    expectedDate: '',
    regime: 'Hospitalar',
    type: 'Cirúrgica',
    days: 1,
    accommodation: 'Apartamento',
    notes: ''
  });

  // OPME Details
  const [showOpme, setShowOpme] = useState(false);
  const [opmeList, setOpmeList] = useState<OpmeItem[]>([]);

  // Procedures
  const [allProcedures, setAllProcedures] = useState<any[]>([]);
  const [procSearch, setProcSearch] = useState('');
  const [selectedProcedures, setSelectedProcedures] = useState<any[]>([]);

  // Kits
  const [kits, setKits] = useState<ProcedureKit[]>([]);
  const [showKitModal, setShowKitModal] = useState(false);
  const [showSaveKitModal, setShowSaveKitModal] = useState(false);
  const [newKitName, setNewKitName] = useState('');

  // Generation & Preview
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);

  // Fetch initial base data
  useEffect(() => {
    if (!user) return;
    const fetchInitialData = async () => {
      const pQ = query(collection(db, 'patients'), where('doctorId', '==', user.uid));
      const pSnap = await getDocs(pQ);
      setPatients(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const oQ = query(collection(db, 'operators'), where('doctorId', '==', user.uid));
      const oSnap = await getDocs(oQ);
      setOperators(oSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const tableQ = query(collection(db, 'tables'), where('doctorId', '==', user.uid));
      const tableSnap = await getDocs(tableQ);
      setTables(tableSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const procQ = query(collection(db, 'procedures'), where('doctorId', '==', user.uid));
      const procSnap = await getDocs(procQ);
      setAllProcedures(procSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const kitsQ = query(collection(db, 'procedure_kits'), where('doctorId', '==', user.uid));
      const kitsSnap = await getDocs(kitsQ);
      setKits(kitsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProcedureKit)));
    };
    fetchInitialData();
  }, [user]);

  // Handle incoming duplicated request if navigated from History/Dashboard
  useEffect(() => {
    if (location.state?.duplicateRequest) {
      const dup = location.state.duplicateRequest;
      if (dup.patientId) setSelectedPatientId(dup.patientId);
      if (dup.operatorId) setSelectedOperatorId(dup.operatorId);
      if (dup.templateId) setSelectedTemplateId(dup.templateId);
      if (dup.procedureTableId) setSelectedTableId(dup.procedureTableId);
      if (dup.clinicalData) {
        setClinicalData(prev => ({
          ...prev,
          ...dup.clinicalData,
          date: new Date().toISOString().split('T')[0]
        }));
      }
      if (dup.procedures && Array.isArray(dup.procedures)) {
        setSelectedProcedures(dup.procedures);
        if (!dup.procedureTableId) {
          const tableIdFromProcedure = dup.procedures.find((p: any) => p?.tableId)?.tableId;
          if (tableIdFromProcedure) setSelectedTableId(tableIdFromProcedure);
        }
      }
      if (dup.opme && Array.isArray(dup.opme) && dup.opme.length > 0) {
        setOpmeList(dup.opme);
        setShowOpme(true);
      }
      if (dup.hospitalization) {
        setHospitalization(dup.hospitalization);
        setShowHospitalization(true);
      }
      toast.success("Dados da solicitação duplicada foram carregados.");
    }
  }, [location.state]);

  // Filter templates when operator changes & auto-select active template
  useEffect(() => {
    if (!user || !selectedOperatorId) {
      setTemplates([]);
      setSelectedTemplateId('');
      return;
    }
    const fetchTemplates = async () => {
      const tQ = query(collection(db, 'templates'), where('doctorId', '==', user.uid), where('operatorId', '==', selectedOperatorId));
      const tSnap = await getDocs(tQ);
      const loaded = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTemplates(loaded);

      // Auto-select template: active one or first one
      const active = loaded.find((t: any) => t.status === 'Ativo');
      if (active) {
        setSelectedTemplateId(active.id);
      } else if (loaded.length === 1) {
        setSelectedTemplateId(loaded[0].id);
      }
    };
    fetchTemplates();
  }, [user, selectedOperatorId]);

  // Keep procedure table aligned with the selected operator.
  useEffect(() => {
    if (!selectedOperatorId) {
      setSelectedTableId('');
      setProcSearch('');
      return;
    }
    if (tables.length === 0) return;

    const matchingTables = tables.filter(t => t.operatorId === selectedOperatorId);
    const currentIsValid = matchingTables.some(t => t.id === selectedTableId);
    if (currentIsValid) return;

    setSelectedTableId(matchingTables.length === 1 ? matchingTables[0].id : '');
    setProcSearch('');
    if (selectedProcedures.length > 0) {
      setSelectedProcedures([]);
    }
  }, [selectedOperatorId, tables, selectedTableId]);

  // Auto-fill Operator when Patient is chosen
  const handleSelectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    if (!patientId) return;

    const pat = patients.find(p => p.id === patientId);
    if (pat?.healthPlanName && operators.length > 0) {
      const pPlan = pat.healthPlanName.toLowerCase().trim();
      const matched = operators.find(op => {
        const opName = op.name.toLowerCase().trim();
        return opName === pPlan || pPlan.includes(opName) || opName.includes(pPlan);
      });

      if (matched) {
        setSelectedOperatorId(matched.id);
        toast.success(`Operadora "${matched.name}" sugerida pelo convênio do paciente.`);
      }
    }
  };

  const selectedPatient = useMemo(() => patients.find(p => p.id === selectedPatientId), [patients, selectedPatientId]);
  const operatorTables = useMemo(
    () => tables.filter(t => t.operatorId === selectedOperatorId),
    [tables, selectedOperatorId]
  );
  const selectedProcedureTable = useMemo(
    () => tables.find(t => t.id === selectedTableId),
    [tables, selectedTableId]
  );

  const handleSelectProcedureTable = (tableId: string) => {
    if (tableId === selectedTableId) return;
    if (selectedProcedures.length > 0) {
      setSelectedProcedures([]);
      toast('Os procedimentos foram limpos porque a tabela foi alterada.');
    }
    setSelectedTableId(tableId);
    setProcSearch('');
  };

  // Search Procedures
  const procResults = useMemo(() => {
    if (!selectedTableId || procSearch.length < 2) return [];
    const searchNorm = normalizeText(procSearch);
    return allProcedures.filter(p =>
      p.tableId === selectedTableId && (
        normalizeText(p.code).includes(searchNorm) ||
        normalizeText(p.description).includes(searchNorm) ||
        (p.synonym && normalizeText(p.synonym).includes(searchNorm))
      )
    ).slice(0, 15);
  }, [procSearch, allProcedures, selectedTableId]);

  const addProcedure = (proc: any) => {
    const isPrincipal = selectedProcedures.length === 0;
    setSelectedProcedures([...selectedProcedures, { ...proc, quantity: proc.defaultQuantity || 1, isPrincipal }]);
    setProcSearch('');
  };

  const updateProcQuantity = (index: number, qty: number) => {
    if (qty < 1) return;
    const newProcs = [...selectedProcedures];
    newProcs[index].quantity = qty;
    setSelectedProcedures(newProcs);
  };

  const removeProcedure = (index: number) => {
    const newProcs = [...selectedProcedures];
    const removedWasPrincipal = newProcs[index].isPrincipal;
    newProcs.splice(index, 1);
    if (removedWasPrincipal && newProcs.length > 0) {
      newProcs[0].isPrincipal = true;
    }
    setSelectedProcedures(newProcs);
  };

  const setPrincipalProcedure = (index: number) => {
    const newProcs = selectedProcedures.map((p, i) => ({
      ...p,
      isPrincipal: i === index
    }));
    setSelectedProcedures(newProcs);
  };

  const moveProcedure = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === selectedProcedures.length - 1) return;

    const newProcs = [...selectedProcedures];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newProcs[index];
    newProcs[index] = newProcs[targetIndex];
    newProcs[targetIndex] = temp;
    setSelectedProcedures(newProcs);
  };

  // OPME handlers
  const addOpmeItem = () => {
    setOpmeList([
      ...opmeList,
      { id: Date.now().toString(), description: '', quantity: 1 }
    ]);
  };

  const updateOpmeItem = (id: string, updates: Partial<OpmeItem>) => {
    setOpmeList(opmeList.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeOpmeItem = (id: string) => {
    setOpmeList(opmeList.filter(item => item.id !== id));
  };

  // Kit Handlers
  const handleApplyKit = (kit: ProcedureKit) => {
    if (kit.procedures && kit.procedures.length > 0) {
      const kitTableId = kit.tableId || kit.procedures.find((p: any) => p?.tableId)?.tableId || '';
      if (kitTableId) {
        const kitTable = tables.find(t => t.id === kitTableId);
        if (kitTable?.operatorId && kitTable.operatorId !== selectedOperatorId) {
          setSelectedOperatorId(kitTable.operatorId);
        }
        setSelectedTableId(kitTableId);
      }
      setSelectedProcedures(kit.procedures.map((p, idx) => ({ ...p, isPrincipal: idx === 0 })));
    }
    if (kit.cid) {
      setClinicalData(prev => ({
        ...prev,
        cid: kit.cid || prev.cid,
        cidCode: kit.cid || prev.cidCode
      }));
    }
    if (kit.indication) {
      setClinicalData(prev => ({ ...prev, indication: kit.indication || prev.indication }));
    }
    setShowKitModal(false);
    toast.success(`Kit "${kit.name}" aplicado.`);
  };

  const handleSaveAsKit = async () => {
    if (!newKitName.trim() || selectedProcedures.length === 0 || !user) return;
    try {
      const kitData = {
        doctorId: user.uid,
        name: newKitName.trim(),
        tableId: selectedTableId || selectedProcedures.find((p: any) => p?.tableId)?.tableId || '',
        procedures: selectedProcedures,
        cid: clinicalData.cidCode || clinicalData.cid || '',
        indication: clinicalData.indication || '',
        createdAt: new Date()
      };
      const docRef = await addDoc(collection(db, 'procedure_kits'), kitData);
      setKits([...kits, { id: docRef.id, ...kitData }]);
      setShowSaveKitModal(false);
      setNewKitName('');
      toast.success('Kit salvo com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao salvar kit: ' + e.message);
    }
  };

  // Build complete payload for PDF Generator
  const buildPdfPayload = (): PdfGenerationData => {
    return {
      patient: {
        name: selectedPatient?.name || '',
        cpf: selectedPatient?.cpf || '',
        birthDate: selectedPatient?.birthDate || '',
        gender: selectedPatient?.gender || '',
        healthPlanName: selectedPatient?.healthPlanName || '',
        healthPlanNumber: selectedPatient?.healthPlanNumber || '',
        healthPlanValidity: selectedPatient?.healthPlanValidity || '',
        phone: selectedPatient?.phone || '',
        email: selectedPatient?.email || ''
      },
      doctor: {
        name: profile?.name || '',
        crm: profile?.crm || '',
        specialty: profile?.specialty || '',
        signature: profile?.signature || ''
      },
      clinicalData: {
        indication: clinicalData.indication,
        cid: clinicalData.cidCode || clinicalData.cid,
        cidCode: clinicalData.cidCode || clinicalData.cid,
        cidDescription: clinicalData.cidDescription,
        cidFull: clinicalData.cidFull,
        cidSource: clinicalData.cidSource,
        cidVersion: clinicalData.cidVersion,
        secondaryCid: clinicalData.secondaryCid,
        secondaryCids: clinicalData.secondaryCids,
        justification: clinicalData.justification,
        date: clinicalData.date
      },
      procedures: selectedProcedures.map((p, idx) => ({
        code: p.code,
        description: p.description,
        quantity: p.quantity,
        isPrincipal: p.isPrincipal || idx === 0
      })),
      opme: opmeList.map(item => ({
        description: item.description,
        quantity: item.quantity,
        manufacturer: item.manufacturer,
        reference: item.reference,
        anvisa: item.anvisa,
        justification: item.justification
      })),
      hospitalization: {
        character: hospitalization.character,
        expectedDate: hospitalization.expectedDate,
        regime: hospitalization.regime,
        type: hospitalization.type,
        days: hospitalization.days,
        accommodation: hospitalization.accommodation,
        notes: hospitalization.notes
      }
    };
  };

  // Preview PDF Modal
  const handlePreviewPDF = async () => {
    if (!selectedPatientId || !selectedOperatorId || !selectedTemplateId) {
      toast.error("Selecione Paciente, Operadora e Template para pré-visualizar.");
      return;
    }
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) {
      toast.error("Template selecionado não encontrado.");
      return;
    }

    setIsPreviewing(true);
    try {
      const source = await getTemplatePdfSource(template);
      if (!source) throw new Error("Template sem arquivo PDF válido.");

      const payload = buildPdfPayload();
      const { pdfBytes, warnings } = await generateFilledPdf(
        source,
        template.fields || [],
        payload,
        template.continuationConfig
      );
      setPreviewWarnings(warnings);

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } catch (err: any) {
      toast.error("Erro ao gerar pré-visualização: " + err.message);
    } finally {
      setIsPreviewing(false);
    }
  };

  // Final generation, download, and Firestore save
  const handleGenerateAndSave = async () => {
    if (!selectedPatientId || !selectedOperatorId || !selectedTemplateId) {
      toast.error("Preencha Paciente, Operadora e Template.");
      return;
    }
    if (!selectedTableId) {
      toast.error("Selecione a tabela de procedimentos.");
      return;
    }
    if (selectedProcedures.length === 0) {
      toast.error("Adicione pelo menos um procedimento solicitado.");
      return;
    }

    setIsGenerating(true);
    try {
      const template = templates.find(t => t.id === selectedTemplateId);
      const operator = operators.find(o => o.id === selectedOperatorId);
      if (!template) throw new Error("Template selecionado não encontrado.");
      const source = await getTemplatePdfSource(template);
      if (!source) throw new Error("Template não possui arquivo PDF válido.");

      const payload = buildPdfPayload();
      const { pdfBytes } = await generateFilledPdf(
        source,
        template.fields || [],
        payload,
        template.continuationConfig
      );

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Solicitacao_${(selectedPatient?.name || 'Paciente').replace(/\s+/g, '_')}_${clinicalData.date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // Save to requests collection with full snapshot
      await addDoc(collection(db, 'requests'), {
        doctorId: user?.uid,
        patientId: selectedPatientId,
        patientName: selectedPatient?.name || '',
        operatorId: selectedOperatorId,
        operatorName: operator?.name || '',
        templateId: selectedTemplateId,
        templateName: template?.name || '',
        procedureTableId: selectedTableId,
        procedureTableName: selectedProcedureTable?.name || '',
        procedureTableVersion: selectedProcedureTable?.version || '',
        clinicalData,
        procedures: selectedProcedures,
        opme: opmeList,
        hospitalization,
        status: 'Gerado',
        createdAt: new Date()
      });

      toast.success("Solicitação salva no histórico e PDF gerado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar solicitação: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-20">
      {/* PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={!!previewPdfUrl}
        onClose={() => {
          if (previewPdfUrl) {
            URL.revokeObjectURL(previewPdfUrl);
            setPreviewPdfUrl(null);
          }
        }}
        pdfSource={previewPdfUrl}
        title="Pré-visualização da Solicitação"
        subtitle="Conferência fiel do formulário oficial antes de salvar ou imprimir"
        filename={`Solicitacao_${(selectedPatient?.name || 'Paciente').replace(/\s+/g, '_')}.pdf`}
        warnings={previewWarnings}
      />

      {/* Kit Picker Modal */}
      {showKitModal && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-[0_20px_40px_rgba(15,23,42,0.2)] w-full max-w-md p-5 space-y-4 border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-semibold text-[15px] text-[#0F172A] flex items-center gap-2">
                <Package className="h-4 w-4 text-[#1E5FA6]" /> Kits de Procedimentos
              </h3>
              <button onClick={() => setShowKitModal(false)} className="text-[#94A3B8] hover:text-[#475569] p-1 rounded-[4px]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {kits.length === 0 ? (
                <div className="text-center py-8 text-[12px] text-[#64748B]">
                  Nenhum kit cadastrado ainda. Selecione os procedimentos e clique em "Salvar como Kit".
                </div>
              ) : (
                kits.map(k => (
                  <div
                    key={k.id}
                    onClick={() => handleApplyKit(k)}
                    className="p-3 border border-[#E2E8F0] rounded-[8px] hover:border-[#1E5FA6] hover:bg-[#EFF6FF]/50 cursor-pointer transition-all"
                  >
                    <p className="font-semibold text-[13px] text-[#0F172A]">{k.name}</p>
                    <p className="text-[12px] text-[#64748B] mt-0.5">
                      {k.procedures?.length || 0} procedimentos {k.cid ? `• CID: ${k.cid}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>

            <Button variant="outline" className="w-full text-[12px]" onClick={() => setShowKitModal(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Save Kit Modal */}
      {showSaveKitModal && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-[0_20px_40px_rgba(15,23,42,0.2)] w-full max-w-sm p-5 space-y-4 border border-[#E2E8F0]">
            <div>
              <h3 className="font-semibold text-[15px] text-[#0F172A]">Salvar como Kit</h3>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                Salva os {selectedProcedures.length} procedimentos atuais para reutilização em solicitações futuras.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-[#475569]">Nome do Kit</Label>
              <Input
                placeholder="Ex: Artroplastia de Joelho, Colecistectomia"
                value={newKitName}
                onChange={e => setNewKitName(e.target.value)}
                autoFocus
                className="h-[38px] text-[13px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowSaveKitModal(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveAsKit} disabled={!newKitName.trim()}>
                Salvar Kit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Nova Solicitação Médica</h1>
            <span className="text-[11px] font-semibold text-[#1E5FA6] bg-[#EFF6FF] border border-[#BFDBFE]/60 px-2 py-0.5 rounded-[4px]">
              TISS Oficial
            </span>
          </div>
          <p className="text-[13px] text-[#64748B] mt-0.5">Preencha os dados clínicos para preenchimento automático da guia oficial em PDF</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handlePreviewPDF}
            disabled={isPreviewing}
            className="h-[38px] text-[13px] font-medium"
          >
            <Eye className="mr-1.5 h-4 w-4 text-[#1E5FA6]" />
            {isPreviewing ? 'Carregando...' : 'Visualizar PDF'}
          </Button>

          <Button
            className="h-[38px] text-[13px] font-semibold"
            onClick={handleGenerateAndSave}
            disabled={isGenerating}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            {isGenerating ? 'Gerando...' : 'Gerar e Salvar Solicitação'}
          </Button>
        </div>
      </div>

      {/* 1. Paciente */}
      <Card className="border-[#E2E8F0]">
        <CardHeader className="py-3.5 px-5 border-b border-[#E2E8F0] flex flex-row items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-[4px] bg-[#1E5FA6] text-white text-[11px] font-bold flex items-center justify-center">1</span>
            <CardTitle className="text-[14px] font-semibold text-[#0F172A] flex items-center gap-1.5">
              <User className="h-4 w-4 text-[#1E5FA6]" /> Paciente
            </CardTitle>
          </div>
          {selectedPatient && (
            <span className="text-[11px] text-[#1E5FA6] font-semibold bg-[#EFF6FF] border border-[#BFDBFE]/60 px-2.5 py-0.5 rounded-[4px]">
              Convênio: {selectedPatient.healthPlanName || 'Particular'}
            </span>
          )}
        </CardHeader>
        <CardContent className="p-5 space-y-3.5">
          <div>
            <Label className="text-[12px] font-semibold text-[#475569] mb-1.5 block">
              Selecionar Paciente <span className="text-[#DC2626]">*</span>
            </Label>
            <select
              className="flex h-[38px] w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-[13px] text-[#0F172A] transition-colors focus:border-[#1E5FA6] focus:ring-2 focus:ring-[#1E5FA6]/20 outline-none"
              value={selectedPatientId}
              onChange={e => handleSelectPatient(e.target.value)}
            >
              <option value="">Selecione o paciente cadastrado...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.cpf ? `• CPF: ${p.cpf}` : ''} {p.healthPlanName ? `• Convênio: ${p.healthPlanName}` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedPatient && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FAFC] p-3 rounded-[8px] text-[12px] text-[#334155] border border-[#E2E8F0]">
              <div>
                <span className="text-[#64748B] text-[11px] block font-medium">CPF:</span>
                <span className="font-mono font-semibold text-[#0F172A]">{selectedPatient.cpf || '-'}</span>
              </div>
              <div>
                <span className="text-[#64748B] text-[11px] block font-medium">Nº Carteira:</span>
                <span className="font-mono font-semibold text-[#0F172A]">{selectedPatient.healthPlanNumber || '-'}</span>
              </div>
              <div>
                <span className="text-[#64748B] text-[11px] block font-medium">Validade:</span>
                <span className="font-medium text-[#0F172A]">{selectedPatient.healthPlanValidity || '-'}</span>
              </div>
              <div>
                <span className="text-[#64748B] text-[11px] block font-medium">Data Nascimento:</span>
                <span className="font-medium text-[#0F172A]">{selectedPatient.birthDate || '-'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Convênio e Template Oficial */}
      <Card className="border-[#E2E8F0]">
        <CardHeader className="py-3.5 px-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-[4px] bg-[#1E5FA6] text-white text-[11px] font-bold flex items-center justify-center">2</span>
            <CardTitle className="text-[14px] font-semibold text-[#0F172A] flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-[#1E5FA6]" /> Convênio e Formulário da Operadora
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-[#475569]">
              Operadora de Saúde <span className="text-[#DC2626]">*</span>
            </Label>
            <select
              className="flex h-[38px] w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-[13px] text-[#0F172A] transition-colors focus:border-[#1E5FA6] focus:ring-2 focus:ring-[#1E5FA6]/20 outline-none"
              value={selectedOperatorId}
              onChange={e => setSelectedOperatorId(e.target.value)}
            >
              <option value="">Selecione a operadora...</option>
              {operators.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-[#475569]">
              Template do Formulário Oficial (PDF) <span className="text-[#DC2626]">*</span>
            </Label>
            <select
              className="flex h-[38px] w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-[13px] text-[#0F172A] transition-colors focus:border-[#1E5FA6] focus:ring-2 focus:ring-[#1E5FA6]/20 outline-none disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              disabled={!selectedOperatorId}
            >
              <option value="">{selectedOperatorId ? 'Selecione o template...' : 'Escolha a operadora primeiro'}</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.version ? `(v${t.version})` : ''} {t.status === 'Ativo' ? '• [Ativo]' : ''}
                </option>
              ))}
            </select>
            {selectedOperatorId && templates.length === 0 && (
              <p className="text-[11px] text-[#D97706] mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> Nenhum template cadastrado para esta operadora.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Dados Clínicos e CID-10 */}
      <Card className="border-[#E2E8F0]">
        <CardHeader className="py-3.5 px-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-[4px] bg-[#1E5FA6] text-white text-[11px] font-bold flex items-center justify-center">3</span>
            <CardTitle className="text-[14px] font-semibold text-[#0F172A] flex items-center gap-1.5">
              <Stethoscope className="h-4 w-4 text-[#1E5FA6]" /> Diagnóstico e Dados Clínicos
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-[#475569]">Indicação Clínica</Label>
            <Input
              placeholder="Ex: Gonartrose avançada refratária a tratamento conservador"
              value={clinicalData.indication}
              onChange={e => setClinicalData({...clinicalData, indication: e.target.value})}
              className="h-[38px] text-[13px]"
            />
          </div>

          {/* SELETOR OFICIAL CID-10 BRASIL (DATASUS) */}
          <div className="pt-1">
            <CID10Selector
              primaryCid={clinicalData.cidCode || clinicalData.cid}
              primaryCidDescription={clinicalData.cidDescription}
              secondaryCids={clinicalData.secondaryCids}
              onChange={(cidData) => {
                setClinicalData(prev => ({
                  ...prev,
                  cid: cidData.cidCode,
                  cidCode: cidData.cidCode,
                  cidDescription: cidData.cidDescription,
                  cidFull: cidData.cidFull,
                  cidSource: cidData.cidSource,
                  cidVersion: cidData.cidVersion,
                  secondaryCid: cidData.secondaryCid,
                  secondaryCids: cidData.secondaryCids
                }));
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-[#475569]">Justificativa Clínica Detalhada</Label>
            <textarea
              className="flex w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] transition-colors focus:border-[#1E5FA6] focus:ring-2 focus:ring-[#1E5FA6]/20 outline-none min-h-[75px]"
              placeholder="Descreva a história clínica, tratamentos prévios e fundamentação técnica do procedimento..."
              value={clinicalData.justification}
              onChange={e => setClinicalData({...clinicalData, justification: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-[#475569]">Data da Solicitação</Label>
              <Input
                type="date"
                value={clinicalData.date}
                onChange={e => setClinicalData({...clinicalData, date: e.target.value})}
                className="h-[38px] text-[13px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Procedimentos Solicitados & Kits */}
      <Card className="border-[#E2E8F0]">
        <CardHeader className="py-3.5 px-5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-[4px] bg-[#1E5FA6] text-white text-[11px] font-bold flex items-center justify-center">4</span>
            <CardTitle className="text-[14px] font-semibold text-[#0F172A] flex items-center gap-1.5">
              <Package className="h-4 w-4 text-[#1E5FA6]" /> Procedimentos Solicitados ({selectedProcedures.length})
            </CardTitle>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowKitModal(true)}
              className="h-8 text-[12px] text-[#1E5FA6] border-[#BFDBFE] bg-white hover:bg-[#EFF6FF]"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Usar Kit
            </Button>

            {selectedProcedures.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSaveKitModal(true)}
                className="h-8 text-[12px] text-[#475569] border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
              >
                Salvar como Kit
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-[#475569]">
              Tabela de procedimentos <span className="text-[#DC2626]">*</span>
            </Label>
            <select
              className="flex h-[38px] w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-1.5 text-[13px] text-[#0F172A] transition-colors focus:border-[#1E5FA6] focus:ring-2 focus:ring-[#1E5FA6]/20 outline-none disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
              value={selectedTableId}
              onChange={e => handleSelectProcedureTable(e.target.value)}
              disabled={!selectedOperatorId}
            >
              <option value="">{selectedOperatorId ? 'Selecione a tabela...' : 'Escolha a operadora primeiro'}</option>
              {operatorTables.map(table => (
                <option key={table.id} value={table.id}>
                  {table.name}{table.version ? ` • v${table.version}` : ''}{typeof table.count === 'number' ? ` • ${table.count} códigos` : ''}
                </option>
              ))}
            </select>
            {selectedOperatorId && operatorTables.length === 0 && (
              <p className="text-[11px] text-[#D97706] mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> Nenhuma tabela cadastrada para esta operadora. Importe uma em Configurações → Tabelas.
              </p>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <Input
              placeholder={selectedTableId ? "Buscar código ou descrição nesta tabela..." : "Selecione uma tabela para buscar procedimentos"}
              className="pl-9 h-[38px] text-[13px]"
              value={procSearch}
              onChange={e => setProcSearch(e.target.value)}
              disabled={!selectedTableId}
            />

            {procResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white rounded-[8px] shadow-[0_8px_20px_rgba(15,23,42,0.12)] border border-[#E2E8F0] max-h-60 overflow-y-auto divide-y divide-[#E2E8F0]/60 p-1">
                {procResults.map(proc => (
                  <div
                    key={proc.id}
                    className="px-3.5 py-2.5 hover:bg-[#EFF6FF] rounded-[6px] cursor-pointer flex flex-col transition-colors"
                    onClick={() => addProcedure(proc)}
                  >
                    <span className="font-semibold text-[13px] text-[#0F172A]">{proc.code} - {proc.description}</span>
                    {proc.synonym && <span className="text-[11px] text-[#64748B]">Sinônimo: {proc.synonym}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 mt-3">
            {selectedProcedures.map((proc, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-[8px] border transition-all ${
                  proc.isPrincipal ? 'bg-[#EFF6FF]/70 border-[#BFDBFE]' : 'bg-white border-[#E2E8F0]'
                }`}
              >
                <div className="flex-1 flex flex-col gap-1 pr-3 min-w-0">
                  <p className="font-semibold text-[13px] text-[#0F172A] flex items-center gap-2 flex-wrap">
                    {proc.isPrincipal && (
                      <span className="inline-flex items-center gap-1 bg-[#1E5FA6] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-[4px]">
                        <Star className="h-3 w-3 fill-current" /> PRINCIPAL
                      </span>
                    )}
                    <span className="font-mono text-[#1E5FA6]">{proc.code}</span>
                    <span className="text-[#334155]">{proc.description}</span>
                  </p>

                  {!proc.isPrincipal && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setPrincipalProcedure(index)}
                        className="text-[11px] text-[#1E5FA6] hover:underline font-semibold"
                      >
                        Definir como procedimento principal
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Reordering */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveProcedure(index, 'up')}
                      className="p-1 text-[#94A3B8] hover:text-[#0F172A] disabled:opacity-20 transition-colors"
                      title="Mover para cima"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === selectedProcedures.length - 1}
                      onClick={() => moveProcedure(index, 'down')}
                      className="p-1 text-[#94A3B8] hover:text-[#0F172A] disabled:opacity-20 transition-colors"
                      title="Mover para baixo"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#64748B] font-medium">Qtd:</span>
                    <div className="flex items-center bg-[#F8FAFC] border border-[#CBD5E1] rounded-[6px] overflow-hidden">
                      <button
                        type="button"
                        className="px-2 py-0.5 text-[#475569] hover:bg-[#E2E8F0] text-[12px] font-bold transition-colors"
                        onClick={() => updateProcQuantity(index, proc.quantity - 1)}
                      >-</button>
                      <span className="px-2 text-[12px] font-bold text-[#0F172A] min-w-[20px] text-center">{proc.quantity}</span>
                      <button
                        type="button"
                        className="px-2 py-0.5 text-[#475569] hover:bg-[#E2E8F0] text-[12px] font-bold transition-colors"
                        onClick={() => updateProcQuantity(index, proc.quantity + 1)}
                      >+</button>
                    </div>
                  </div>

                  {/* Remove */}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2]/60" onClick={() => removeProcedure(index)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {selectedProcedures.length === 0 && (
              <div className="text-center py-6 text-[12px] text-[#64748B] border border-dashed border-[#CBD5E1] rounded-[8px] bg-[#F8FAFC]">
                Nenhum procedimento adicionado. Digite o código TUSS ou nome acima, ou clique em "Usar Kit".
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 5. OPME (Opcional) */}
      <Card className="border-[#E2E8F0]">
        <CardHeader
          className="py-3 px-5 cursor-pointer hover:bg-[#F8FAFC] flex flex-row items-center justify-between transition-colors"
          onClick={() => setShowOpme(!showOpme)}
        >
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-[4px] bg-[#64748B] text-white text-[11px] font-bold flex items-center justify-center">5</span>
            <CardTitle className="text-[13px] font-semibold text-[#0F172A]">
              OPME / Materiais Especiais {opmeList.length > 0 ? `(${opmeList.length})` : '(Opcional)'}
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="text-[12px] text-[#1E5FA6] font-semibold pointer-events-none">
            {showOpme ? 'Ocultar' : '+ Adicionar OPME'}
          </Button>
        </CardHeader>

        {showOpme && (
          <CardContent className="p-5 space-y-3.5 border-t border-[#E2E8F0]">
            {opmeList.map((item, idx) => (
              <div key={item.id} className="p-3 bg-[#F8FAFC] rounded-[8px] border border-[#E2E8F0] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#334155]">Item #{idx + 1}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[#DC2626] hover:bg-[#FEE2E2]/60 text-[11px]" onClick={() => removeOpmeItem(item.id)}>
                    Remover
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-[11px] text-[#64748B] font-medium">Descrição do Material / Prótese</Label>
                    <Input
                      placeholder="Ex: Prótese total de joelho cimentada"
                      value={item.description}
                      onChange={e => updateOpmeItem(item.id, { description: e.target.value })}
                      className="h-[34px] text-[12px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-[#64748B] font-medium">Quantidade</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={e => updateOpmeItem(item.id, { quantity: Number(e.target.value) })}
                      className="h-[34px] text-[12px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-[#64748B] font-medium">Fabricante / Fornecedor</Label>
                    <Input
                      placeholder="Ex: Zimmer Biomet"
                      value={item.manufacturer || ''}
                      onChange={e => updateOpmeItem(item.id, { manufacturer: e.target.value })}
                      className="h-[34px] text-[12px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-[#64748B] font-medium">Código / Referência</Label>
                    <Input
                      placeholder="Ex: REF-9842"
                      value={item.reference || ''}
                      onChange={e => updateOpmeItem(item.id, { reference: e.target.value })}
                      className="h-[34px] text-[12px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-[#64748B] font-medium">Registro ANVISA</Label>
                    <Input
                      placeholder="Ex: 80123456789"
                      value={item.anvisa || ''}
                      onChange={e => updateOpmeItem(item.id, { anvisa: e.target.value })}
                      className="h-[34px] text-[12px]"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addOpmeItem} className="text-[12px]">
              <Plus className="h-3.5 w-3.5 mr-1 text-[#1E5FA6]" /> Adicionar Item de OPME
            </Button>
          </CardContent>
        )}
      </Card>

      {/* 6. Internação e Caráter de Atendimento (Opcional) */}
      <Card className="border-[#E2E8F0]">
        <CardHeader
          className="py-3 px-5 cursor-pointer hover:bg-[#F8FAFC] flex flex-row items-center justify-between transition-colors"
          onClick={() => setShowHospitalization(!showHospitalization)}
        >
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-[4px] bg-[#64748B] text-white text-[11px] font-bold flex items-center justify-center">6</span>
            <CardTitle className="text-[13px] font-semibold text-[#0F172A]">
              Internação e Caráter do Atendimento (Opcional)
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="text-[12px] text-[#1E5FA6] font-semibold pointer-events-none">
            {showHospitalization ? 'Ocultar' : 'Configurar'}
          </Button>
        </CardHeader>

        {showHospitalization && (
          <CardContent className="p-5 space-y-4 border-t border-[#E2E8F0]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#475569]">Caráter do Atendimento</Label>
                <div className="flex rounded-[8px] border border-[#CBD5E1] overflow-hidden p-0.5 bg-[#F8FAFC]">
                  <button
                    type="button"
                    onClick={() => setHospitalization({...hospitalization, character: 'Eletivo'})}
                    className={`flex-1 py-1.5 text-[12px] font-semibold rounded-[6px] transition-all ${hospitalization.character === 'Eletivo' ? 'bg-[#1E5FA6] text-white shadow-2xs' : 'text-[#475569] hover:text-[#0F172A]'}`}
                  >
                    Eletivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setHospitalization({...hospitalization, character: 'Urgência'})}
                    className={`flex-1 py-1.5 text-[12px] font-semibold rounded-[6px] transition-all ${hospitalization.character === 'Urgência' ? 'bg-[#D97706] text-white shadow-2xs' : 'text-[#475569] hover:text-[#0F172A]'}`}
                  >
                    Urgência / Emergência
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#475569]">Regime de Internação</Label>
                <select
                  className="w-full h-[38px] rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-1 text-[13px] text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                  value={hospitalization.regime}
                  onChange={e => setHospitalization({...hospitalization, regime: e.target.value})}
                >
                  <option value="Hospitalar">Hospitalar</option>
                  <option value="Hospital-Dia">Hospital-Dia</option>
                  <option value="Ambulatorial">Ambulatorial</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#475569]">Tipo de Internação</Label>
                <select
                  className="w-full h-[38px] rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-1 text-[13px] text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                  value={hospitalization.type}
                  onChange={e => setHospitalization({...hospitalization, type: e.target.value})}
                >
                  <option value="Cirúrgica">Cirúrgica</option>
                  <option value="Clínica">Clínica</option>
                  <option value="Obstétrica">Obstétrica</option>
                  <option value="Pediátrica">Pediátrica</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#475569]">Previsão de Diárias</Label>
                <Input
                  type="number"
                  value={hospitalization.days}
                  onChange={e => setHospitalization({...hospitalization, days: Number(e.target.value)})}
                  className="h-[38px] text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#475569]">Acomodação</Label>
                <select
                  className="w-full h-[38px] rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-1 text-[13px] text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                  value={hospitalization.accommodation}
                  onChange={e => setHospitalization({...hospitalization, accommodation: e.target.value})}
                >
                  <option value="Apartamento">Apartamento (Individual)</option>
                  <option value="Enfermaria">Enfermaria (Coletivo)</option>
                  <option value="UTI">UTI</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#475569]">Data Prevista de Internação</Label>
                <Input
                  type="date"
                  value={hospitalization.expectedDate}
                  onChange={e => setHospitalization({...hospitalization, expectedDate: e.target.value})}
                  className="h-[38px] text-[13px]"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border border-[#E2E8F0] p-3.5 rounded-[10px] shadow-[0_4px_20px_rgba(15,23,42,0.08)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-[#64748B]">
            Voltar
          </Button>
          <div className="hidden sm:flex items-center gap-2 text-[12px] text-[#64748B] pl-2 border-l border-[#E2E8F0]">
            <span>Paciente: <strong className="text-[#0F172A]">{selectedPatient ? selectedPatient.name.split(' ')[0] : 'Não selecionado'}</strong></span>
            <span>•</span>
            <span>Procedimentos: <strong className="text-[#0F172A]">{selectedProcedures.length}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handlePreviewPDF}
            disabled={isPreviewing}
            className="h-[38px] text-[13px] font-medium text-[#1E5FA6] border-[#BFDBFE] hover:bg-[#EFF6FF]"
          >
            <Eye className="mr-1.5 h-4 w-4" />
            {isPreviewing ? 'Carregando...' : 'Visualizar PDF'}
          </Button>

          <Button
            className="h-[38px] px-5 text-[13px] font-semibold shadow-xs"
            onClick={handleGenerateAndSave}
            disabled={isGenerating}
          >
            <FileText className="mr-1.5 h-4 w-4" />
            {isGenerating ? 'Gerando...' : 'Gerar e Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
