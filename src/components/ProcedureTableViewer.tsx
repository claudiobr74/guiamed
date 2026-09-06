import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  increment 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  UploadCloud, 
  ArrowLeft, 
  CheckCircle2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  FileSpreadsheet, 
  Layers, 
  Filter, 
  RefreshCw,
  Info,
  Calendar,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Operator } from '../pages/Operators';
import { parseProcedureRows, ParsedProcedure } from '../lib/procedureParser';
import SpreadsheetMappingModal from './SpreadsheetMappingModal';

export interface ProcedureItem {
  id: string;
  tableId: string;
  doctorId: string;
  code: string;
  description: string;
  synonym?: string;
  group?: string;
  subgroup?: string;
  defaultQuantity?: number;
  unit?: string;
  observation?: string;
  equivalentCode?: string;
  initialValidity?: string;
  finalValidity?: string;
  createdAt?: any;
}

export interface TableDef {
  id: string;
  name: string;
  operatorId: string;
  version: string;
  status: string;
  count?: number;
  description?: string;
  createdAt?: any;
}

interface ProcedureTableViewerProps {
  table: TableDef;
  operators: Operator[];
  onBack: () => void;
  onTableUpdated: (updated: Partial<TableDef>) => void;
  onTableDeleted: () => void;
}

export default function ProcedureTableViewer({
  table,
  operators,
  onBack,
  onTableUpdated,
  onTableDeleted
}: ProcedureTableViewerProps) {
  const { user } = useAuthStore();
  const [procedures, setProcedures] = useState<ProcedureItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Procedure Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<ProcedureItem | null>(null);
  const [viewingProcedure, setViewingProcedure] = useState<ProcedureItem | null>(null);
  const [procedureToDelete, setProcedureToDelete] = useState<ProcedureItem | null>(null);
  const [isDeletingProcedure, setIsDeletingProcedure] = useState(false);
  
  // Form State for Procedure (New/Edit)
  const [procForm, setProcForm] = useState({
    code: '',
    description: '',
    synonym: '',
    group: '',
    subgroup: '',
    defaultQuantity: 1,
    unit: '',
    equivalentCode: '',
    initialValidity: '',
    finalValidity: '',
    observation: ''
  });
  const [isSavingProcedure, setIsSavingProcedure] = useState(false);

  // Table Edit Modal
  const [isEditTableModalOpen, setIsEditTableModalOpen] = useState(false);
  const [tableForm, setTableForm] = useState({
    name: table.name,
    operatorId: table.operatorId,
    version: table.version || '',
    status: table.status || 'Ativa'
  });
  const [isSavingTable, setIsSavingTable] = useState(false);

  // Table Delete Modal
  const [isDeleteTableModalOpen, setIsDeleteTableModalOpen] = useState(false);
  const [isDeletingTable, setIsDeletingTable] = useState(false);

  // Mapping Modal
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [reimportMode, setReimportMode] = useState(false);

  const operatorName = operators.find(o => o.id === table.operatorId)?.name || 'Sem Operadora';

  // Check if current procedures in database appear to have numeric/code-only descriptions
  const hasSuspiciousDescriptions = useMemo(() => {
    if (procedures.length === 0) return false;
    const sample = procedures.slice(0, 30);
    const numericCount = sample.filter(p => {
      const desc = (p.description || '').trim();
      return /^\d+$/.test(desc) || desc === p.code || (desc.length <= 4 && !/[a-zA-Z]{3,}/.test(desc));
    }).length;
    return numericCount >= sample.length * 0.4;
  }, [procedures]);

  // Fetch Procedures for this table
  const fetchProcedures = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Query by tableId first
      const q = query(
        collection(db, 'procedures'),
        where('tableId', '==', table.id)
      );
      const snap = await getDocs(q);
      let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProcedureItem[];
      
      // If none found with tableId alone, try with doctorId as fallback
      if (items.length === 0) {
        const qDoc = query(
          collection(db, 'procedures'),
          where('doctorId', '==', user.uid),
          where('tableId', '==', table.id)
        );
        const snapDoc = await getDocs(qDoc);
        items = snapDoc.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProcedureItem[];
      }

      // Sort items alphabetically by code (natural numeric order)
      items.sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }));
      setProcedures(items);

      // If items count differs from table.count, update table document count
      if (items.length !== table.count && items.length > 0) {
        const tableRef = doc(db, 'tables', table.id);
        updateDoc(tableRef, { count: items.length }).catch(() => {});
        onTableUpdated({ count: items.length });
      }
    } catch (err: any) {
      console.error('Erro ao buscar procedimentos da tabela:', err);
      toast.error('Erro ao carregar procedimentos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcedures();
  }, [table.id, user]);

  // Unique groups for filtering
  const uniqueGroups = useMemo(() => {
    const groups = new Set<string>();
    procedures.forEach(p => {
      if (p.group && p.group.trim()) {
        groups.add(p.group.trim());
      }
    });
    return Array.from(groups).sort();
  }, [procedures]);

  // Filtered procedures
  const filteredProcedures = useMemo(() => {
    return procedures.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        q === '' ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.synonym && p.synonym.toLowerCase().includes(q)) ||
        (p.group && p.group.toLowerCase().includes(q)) ||
        (p.subgroup && p.subgroup.toLowerCase().includes(q)) ||
        (p.equivalentCode && p.equivalentCode.toLowerCase().includes(q));

      const matchesGroup = 
        selectedGroup === 'all' || 
        p.group === selectedGroup;

      return matchesSearch && matchesGroup;
    });
  }, [procedures, searchQuery, selectedGroup]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredProcedures.length / itemsPerPage) || 1;
  const paginatedProcedures = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProcedures.slice(start, start + itemsPerPage);
  }, [filteredProcedures, currentPage, itemsPerPage]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedGroup, itemsPerPage]);

  // Open New Procedure Modal
  const handleOpenNewModal = () => {
    setProcForm({
      code: '',
      description: '',
      synonym: '',
      group: '',
      subgroup: '',
      defaultQuantity: 1,
      unit: '',
      equivalentCode: '',
      initialValidity: '',
      finalValidity: '',
      observation: ''
    });
    setIsNewModalOpen(true);
  };

  // Open Edit Procedure Modal
  const handleOpenEditModal = (p: ProcedureItem) => {
    setEditingProcedure(p);
    setProcForm({
      code: p.code || '',
      description: p.description || '',
      synonym: p.synonym || '',
      group: p.group || '',
      subgroup: p.subgroup || '',
      defaultQuantity: p.defaultQuantity || 1,
      unit: p.unit || '',
      equivalentCode: p.equivalentCode || '',
      initialValidity: p.initialValidity || '',
      finalValidity: p.finalValidity || '',
      observation: p.observation || ''
    });
  };

  // Save Procedure (Create or Edit)
  const handleSaveProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!procForm.code.trim() || !procForm.description.trim()) {
      toast.error('Código e Descrição são obrigatórios.');
      return;
    }

    setIsSavingProcedure(true);
    try {
      if (editingProcedure) {
        // Update existing procedure
        const procRef = doc(db, 'procedures', editingProcedure.id);
        await updateDoc(procRef, {
          code: procForm.code.trim(),
          description: procForm.description.trim(),
          synonym: procForm.synonym.trim(),
          group: procForm.group.trim(),
          subgroup: procForm.subgroup.trim(),
          defaultQuantity: Number(procForm.defaultQuantity) || 1,
          unit: procForm.unit.trim(),
          equivalentCode: procForm.equivalentCode.trim(),
          initialValidity: procForm.initialValidity.trim(),
          finalValidity: procForm.finalValidity.trim(),
          observation: procForm.observation.trim(),
          updatedAt: new Date()
        });

        setProcedures(prev => prev.map(item => 
          item.id === editingProcedure.id 
            ? { ...item, ...procForm, defaultQuantity: Number(procForm.defaultQuantity) || 1 } 
            : item
        ));
        toast.success('Procedimento atualizado com sucesso!');
        setEditingProcedure(null);
      } else {
        // Create new procedure
        const docRef = await addDoc(collection(db, 'procedures'), {
          doctorId: user.uid,
          tableId: table.id,
          code: procForm.code.trim(),
          description: procForm.description.trim(),
          synonym: procForm.synonym.trim(),
          group: procForm.group.trim(),
          subgroup: procForm.subgroup.trim(),
          defaultQuantity: Number(procForm.defaultQuantity) || 1,
          unit: procForm.unit.trim(),
          equivalentCode: procForm.equivalentCode.trim(),
          initialValidity: procForm.initialValidity.trim(),
          finalValidity: procForm.finalValidity.trim(),
          observation: procForm.observation.trim(),
          createdAt: new Date()
        });

        const newProc: ProcedureItem = {
          id: docRef.id,
          doctorId: user.uid,
          tableId: table.id,
          ...procForm,
          defaultQuantity: Number(procForm.defaultQuantity) || 1
        };

        setProcedures(prev => [newProc, ...prev]);

        // Increment count in table doc
        const tableRef = doc(db, 'tables', table.id);
        await updateDoc(tableRef, {
          count: increment(1)
        });
        onTableUpdated({ count: (table.count || 0) + 1 });

        toast.success('Procedimento adicionado com sucesso!');
        setIsNewModalOpen(false);
      }
    } catch (err: any) {
      console.error('Erro ao salvar procedimento:', err);
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setIsSavingProcedure(false);
    }
  };

  // Delete Procedure
  const handleConfirmDeleteProcedure = async () => {
    if (!procedureToDelete) return;
    setIsDeletingProcedure(true);
    try {
      await deleteDoc(doc(db, 'procedures', procedureToDelete.id));
      
      setProcedures(prev => prev.filter(p => p.id !== procedureToDelete.id));

      // Decrement count in table doc
      const tableRef = doc(db, 'tables', table.id);
      await updateDoc(tableRef, {
        count: increment(-1)
      });
      onTableUpdated({ count: Math.max(0, (table.count || 1) - 1) });

      toast.success(`Procedimento ${procedureToDelete.code} excluído com sucesso.`);
      setProcedureToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir procedimento:', err);
      toast.error('Erro ao excluir: ' + err.message);
    } finally {
      setIsDeletingProcedure(false);
    }
  };

  // Save Table Info changes
  const handleSaveTableInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableForm.name.trim() || !tableForm.operatorId) {
      toast.error('Nome e Operadora são obrigatórios.');
      return;
    }

    setIsSavingTable(true);
    try {
      const tableRef = doc(db, 'tables', table.id);
      await updateDoc(tableRef, {
        name: tableForm.name.trim(),
        operatorId: tableForm.operatorId,
        version: tableForm.version.trim(),
        status: tableForm.status,
        updatedAt: new Date()
      });

      onTableUpdated(tableForm);
      toast.success('Informações da tabela atualizadas com sucesso!');
      setIsEditTableModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao atualizar tabela:', err);
      toast.error('Erro ao salvar tabela: ' + err.message);
    } finally {
      setIsSavingTable(false);
    }
  };

  // Delete entire Table and all its procedures
  const handleConfirmDeleteTable = async () => {
    if (!user) return;
    setIsDeletingTable(true);
    try {
      // 1. Fetch all procedures for this table to delete in batches
      const q = query(
        collection(db, 'procedures'),
        where('tableId', '==', table.id)
      );
      const snap = await getDocs(q);

      const chunks: any[][] = [];
      for (let i = 0; i < snap.docs.length; i += 400) {
        chunks.push(snap.docs.slice(i, i + 400));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }

      // 2. Delete the table document
      await deleteDoc(doc(db, 'tables', table.id));

      toast.success(`Tabela "${table.name}" e todos os seus procedimentos foram excluídos.`);
      setIsDeleteTableModalOpen(false);
      onTableDeleted();
    } catch (err: any) {
      console.error('Erro ao excluir tabela:', err);
      toast.error('Erro ao excluir tabela: ' + err.message);
    } finally {
      setIsDeletingTable(false);
    }
  };

  // Export procedures to CSV
  const handleExportCSV = () => {
    if (procedures.length === 0) {
      toast.error('Nenhum procedimento para exportar.');
      return;
    }

    const dataToExport = filteredProcedures.map(p => ({
      'Código': p.code,
      'Descrição': p.description,
      'Sinônimo': p.synonym || '',
      'Grupo': p.group || '',
      'Subgrupo': p.subgroup || '',
      'Qtd Padrão': p.defaultQuantity || 1,
      'Unidade': p.unit || '',
      'Cód Equivalente': p.equivalentCode || '',
      'Vigência Inicial': p.initialValidity || '',
      'Vigência Final': p.finalValidity || '',
      'Observação': p.observation || ''
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${table.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_procedimentos.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Arquivo CSV baixado com sucesso!');
  };

  // Handle Spreadsheet Import with Column Mapping
  const handleConfirmSpreadsheetImport = async (
    parsedProcedures: ParsedProcedure[], 
    replaceExisting: boolean,
    onProgress: (status: string) => void
  ) => {
    if (!user) return;

    if (replaceExisting) {
      onProgress('Limpando procedimentos anteriores da tabela...');
      const qOld = query(collection(db, 'procedures'), where('tableId', '==', table.id));
      const snapOld = await getDocs(qOld);
      for (let i = 0; i < snapOld.docs.length; i += 400) {
        const b = writeBatch(db);
        snapOld.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
        await b.commit();
      }
    }

    const chunks = [];
    for (let i = 0; i < parsedProcedures.length; i += 400) {
      chunks.push(parsedProcedures.slice(i, i + 400));
    }

    let insertedCount = 0;
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(p => {
        const procRef = doc(collection(db, 'procedures'));
        batch.set(procRef, {
          doctorId: user.uid,
          tableId: table.id,
          code: p.code,
          description: p.description,
          synonym: p.synonym || '',
          group: p.group || '',
          subgroup: p.subgroup || '',
          defaultQuantity: p.defaultQuantity || 1,
          unit: p.unit || '',
          observation: p.observation || '',
          equivalentCode: p.equivalentCode || '',
          initialValidity: p.initialValidity || '',
          finalValidity: p.finalValidity || '',
          createdAt: new Date()
        });
        insertedCount++;
      });

      await batch.commit();
      onProgress(`Gravando no banco... (${insertedCount}/${parsedProcedures.length})`);
    }

    const newTotal = replaceExisting ? insertedCount : (table.count || 0) + insertedCount;
    const tableRef = doc(db, 'tables', table.id);
    await updateDoc(tableRef, { count: newTotal });
    onTableUpdated({ count: newTotal });

    toast.success(`${insertedCount} procedimentos gravados com sucesso com descrições mapeadas!`);
    await fetchProcedures();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onBack}
            className="h-[36px] text-xs font-semibold text-[#475569] hover:text-[#0F172A] border-[#CBD5E1]"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar às Tabelas
          </Button>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">{table.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                table.status === 'Inativa' 
                  ? 'bg-gray-100 text-gray-700 border-gray-300' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {table.status || 'Ativa'}
              </span>
            </div>
            <p className="text-[12px] text-[#64748B] mt-0.5 flex items-center gap-2">
              <span>Operadora: <strong className="text-[#334155]">{operatorName}</strong></span>
              <span>•</span>
              <span>Versão: <strong className="text-[#334155]">{table.version || '1.0'}</strong></span>
              <span>•</span>
              <span>Total no banco: <strong className="text-[#1E5FA6]">{procedures.length} procedimentos</strong></span>
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpenNewModal}
            className="h-[36px] text-xs font-semibold bg-[#1E5FA6] hover:bg-[#184d85] text-white shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo Procedimento
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { setReimportMode(false); setIsMappingModalOpen(true); }}
            className="h-[36px] text-xs font-semibold text-[#334155] border-[#CBD5E1] hover:bg-gray-50"
            title="Importar mais itens para esta tabela com mapeamento visual"
          >
            <UploadCloud className="h-3.5 w-3.5 mr-1.5 text-[#1E5FA6]" /> Importar + Itens
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { setReimportMode(true); setIsMappingModalOpen(true); }}
            className="h-[36px] text-xs font-semibold text-amber-700 border-amber-300 hover:bg-amber-50"
            title="Reimportar planilha e remapear as colunas de código e descrição"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-amber-600" /> Remapear / Reimportar Planilha
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-[36px] text-xs font-semibold text-[#334155] border-[#CBD5E1] hover:bg-gray-50"
            title="Exportar procedimentos filtrados para CSV"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-gray-600" /> Exportar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTableForm({
                name: table.name,
                operatorId: table.operatorId,
                version: table.version || '',
                status: table.status || 'Ativa'
              });
              setIsEditTableModalOpen(true);
            }}
            className="h-[36px] text-xs font-semibold text-[#334155] border-[#CBD5E1] hover:bg-gray-50"
          >
            <Edit className="h-3.5 w-3.5 mr-1.5 text-gray-600" /> Editar Tabela
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteTableModalOpen(true)}
            className="h-[36px] text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            title="Excluir esta tabela e todos os seus procedimentos"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir Tabela
          </Button>
        </div>
      </div>

      {/* Warning Alert if descriptions are all numbers/codes */}
      {!loading && hasSuspiciousDescriptions && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-950">
                Atenção: A coluna de descrição está exibindo apenas números ou códigos
              </h4>
              <p className="text-[12px] text-amber-900 mt-0.5">
                Isso aconteceu porque na importação inicial a coluna de nomes por extenso não foi associada. 
                Clique no botão ao lado para abrir o <strong>Assistente Visual de Mapeamento</strong> e selecionar a coluna correta de nomes da sua planilha.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => { setReimportMode(true); setIsMappingModalOpen(true); }}
            className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shrink-0 shadow-xs"
          >
            <UploadCloud className="h-3.5 w-3.5 mr-1.5" /> Corrigir / Remapear Planilha
          </Button>
        </div>
      )}

      {/* Warning Recovery Banner if count indicates items were uploaded but not parsed into procedure docs */}
      {!loading && procedures.length === 0 && (table.count || 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Planilha importada anteriormente com cabeçalhos divergentes ({table.count} linhas registradas)
              </h4>
              <p className="text-[12px] text-amber-800 mt-0.5">
                Os registros desta tabela precisam ser remapeados. O Assistente Visual permite selecionar com exatidão as colunas de Código e Descrição com pré-visualização instantânea.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => { setReimportMode(true); setIsMappingModalOpen(true); }}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 shadow-xs"
          >
            <UploadCloud className="h-3.5 w-3.5 mr-1.5" /> Mapear e Reimportar Agora
          </Button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <Card className="border-[#E2E8F0] shadow-xs bg-white">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="md:col-span-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por código, descrição, sinônimo ou equivalente..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-[38px] text-[13px] border-[#CBD5E1] focus:border-[#1E5FA6]"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter by Group */}
            <div className="md:col-span-3">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  className="w-full h-[38px] rounded-[8px] border border-[#CBD5E1] bg-white px-2.5 text-[12px] text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                >
                  <option value="all">Todos os Grupos ({uniqueGroups.length})</option>
                  {uniqueGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Items Per Page & Refresh */}
            <div className="md:col-span-3 flex items-center justify-end gap-2">
              <span className="text-[11px] text-gray-500 font-medium">Exibir:</span>
              <select
                value={itemsPerPage}
                onChange={e => setItemsPerPage(Number(e.target.value))}
                className="h-[38px] rounded-[8px] border border-[#CBD5E1] bg-white px-2.5 text-[12px] text-[#0F172A] outline-none focus:border-[#1E5FA6]"
              >
                <option value={15}>15 por pág</option>
                <option value={25}>25 por pág</option>
                <option value={50}>50 por pág</option>
                <option value={100}>100 por pág</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchProcedures}
                className="h-[38px] px-2.5 text-gray-600 hover:text-[#0F172A] border-[#CBD5E1]"
                title="Atualizar lista"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Quick Counter Info */}
          <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <div>
              Mostrando <strong className="text-gray-900">{filteredProcedures.length}</strong> de <strong className="text-gray-900">{procedures.length}</strong> procedimentos
              {searchQuery && <span> para a busca "<span className="text-[#1E5FA6] font-medium">{searchQuery}</span>"</span>}
            </div>
            {selectedGroup !== 'all' && (
              <button 
                onClick={() => setSelectedGroup('all')}
                className="text-[#1E5FA6] hover:underline font-medium flex items-center gap-1"
              >
                Limpar filtro de grupo ({selectedGroup}) <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table Content */}
      <Card className="border-[#E2E8F0] shadow-xs overflow-hidden bg-white">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-8 w-8 text-[#1E5FA6] animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Carregando catálogo de procedimentos...</p>
            <p className="text-xs text-gray-400 mt-1">Isso pode levar alguns instantes</p>
          </div>
        ) : filteredProcedures.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-gray-800">Nenhum procedimento encontrado</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              {procedures.length === 0 
                ? 'Esta tabela ainda não possui procedimentos registrados. Use os botões abaixo para importar a planilha ou cadastrar manualmente.' 
                : 'Nenhum resultado corresponde aos filtros ou termo de busca aplicado.'}
            </p>
            {procedures.length === 0 ? (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Button 
                  size="sm" 
                  onClick={() => { setReimportMode(true); setIsMappingModalOpen(true); }}
                  className="text-xs font-semibold bg-[#1E5FA6] text-white shadow-xs"
                >
                  <UploadCloud className="h-3.5 w-3.5 mr-1" /> Importar Planilha de Procedimentos
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleOpenNewModal} 
                  className="text-xs font-semibold text-gray-700 border-gray-300"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Manualmente
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setSearchQuery(''); setSelectedGroup('all'); }} 
                className="mt-4 text-xs font-medium"
              >
                Limpar Busca e Filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-4 w-32">Código</th>
                  <th className="py-3 px-4">Descrição do Procedimento</th>
                  <th className="py-3 px-4 w-44 hidden md:table-cell">Grupo / Subgrupo</th>
                  <th className="py-3 px-4 w-28 text-center hidden sm:table-cell">Qtd / Unidade</th>
                  <th className="py-3 px-4 w-28 text-center hidden lg:table-cell">Vigência</th>
                  <th className="py-3 px-4 w-28 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-[13px] text-[#1E293B]">
                {paginatedProcedures.map(proc => (
                  <tr key={proc.id} className="hover:bg-[#F8FAFC]/80 transition-colors group">
                    {/* Code */}
                    <td className="py-3 px-4 font-mono font-bold text-[#1E5FA6] whitespace-nowrap align-top">
                      <span className="bg-blue-50 text-[#1E5FA6] px-2 py-0.5 rounded border border-blue-100 text-[12px]">
                        {proc.code}
                      </span>
                    </td>

                    {/* Description & Synonym */}
                    <td className="py-3 px-4 align-top">
                      <div className="font-medium text-[#0F172A] leading-snug">
                        {proc.description}
                      </div>
                      {proc.synonym && (
                        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                          <span className="font-semibold text-gray-400">Sinônimo:</span> {proc.synonym}
                        </div>
                      )}
                      {proc.equivalentCode && (
                        <div className="text-[11px] text-amber-600 mt-0.5 font-mono">
                          Equivalente: {proc.equivalentCode}
                        </div>
                      )}
                    </td>

                    {/* Group & Subgroup */}
                    <td className="py-3 px-4 text-[12px] text-gray-600 hidden md:table-cell align-top">
                      {proc.group ? (
                        <div className="font-medium text-gray-800">{proc.group}</div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      {proc.subgroup && (
                        <div className="text-[11px] text-gray-500">{proc.subgroup}</div>
                      )}
                    </td>

                    {/* Default Quantity & Unit */}
                    <td className="py-3 px-4 text-[12px] text-center hidden sm:table-cell align-top">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                        {proc.defaultQuantity || 1} {proc.unit || 'UN'}
                      </span>
                    </td>

                    {/* Validity */}
                    <td className="py-3 px-4 text-[11px] text-gray-500 text-center hidden lg:table-cell align-top">
                      {proc.initialValidity || proc.finalValidity ? (
                        <span>
                          {proc.initialValidity || 'Início'} {proc.finalValidity ? `a ${proc.finalValidity}` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingProcedure(proc)}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-[#1E5FA6] hover:bg-blue-50"
                          title="Ver detalhes completos"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(proc)}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-[#1E5FA6] hover:bg-blue-50"
                          title="Editar procedimento"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setProcedureToDelete(proc)}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                          title="Excluir procedimento"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && filteredProcedures.length > 0 && (
          <div className="py-3 px-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              Página <strong className="text-gray-900">{currentPage}</strong> de <strong className="text-gray-900">{totalPages}</strong> • Total de <strong className="text-gray-900">{filteredProcedures.length}</strong> itens
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="h-7 px-2 text-xs border-[#CBD5E1]"
                title="Primeira página"
              >
                ««
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="h-7 px-2.5 text-xs border-[#CBD5E1]"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Anterior
              </Button>

              <span className="px-2 font-semibold text-gray-800">
                {currentPage}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="h-7 px-2.5 text-xs border-[#CBD5E1]"
              >
                Próxima <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="h-7 px-2 text-xs border-[#CBD5E1]"
                title="Última página"
              >
                »»
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* MODAL: NOVO / EDITAR PROCEDIMENTO                                          */}
      {/* ========================================================================= */}
      {(isNewModalOpen || editingProcedure) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-gray-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#1E5FA6]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {editingProcedure ? 'Editar Procedimento' : 'Novo Procedimento'}
                  </h3>
                  <p className="text-xs text-gray-500">Tabela: {table.name}</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsNewModalOpen(false); setEditingProcedure(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProcedure} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1 md:col-span-1">
                  <Label className="text-xs font-semibold text-gray-700">Código TUSS/CBHPM *</Label>
                  <Input
                    required
                    placeholder="Ex: 30101234"
                    value={procForm.code}
                    onChange={e => setProcForm({ ...procForm, code: e.target.value })}
                    className="h-[36px] text-xs font-mono font-semibold"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-gray-700">Descrição do Procedimento *</Label>
                  <Input
                    required
                    placeholder="Ex: Consulta médica em consultório..."
                    value={procForm.description}
                    onChange={e => setProcForm({ ...procForm, description: e.target.value })}
                    className="h-[36px] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Sinônimo / Nome Popular</Label>
                  <Input
                    placeholder="Ex: Eletrocardiograma de rotina"
                    value={procForm.synonym}
                    onChange={e => setProcForm({ ...procForm, synonym: e.target.value })}
                    className="h-[36px] text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Código Equivalente</Label>
                  <Input
                    placeholder="Ex: 10101012"
                    value={procForm.equivalentCode}
                    onChange={e => setProcForm({ ...procForm, equivalentCode: e.target.value })}
                    className="h-[36px] text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Grupo / Categoria</Label>
                  <Input
                    placeholder="Ex: Procedimentos Clínicos"
                    value={procForm.group}
                    onChange={e => setProcForm({ ...procForm, group: e.target.value })}
                    className="h-[36px] text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Subgrupo</Label>
                  <Input
                    placeholder="Ex: Consultas e Visitas"
                    value={procForm.subgroup}
                    onChange={e => setProcForm({ ...procForm, subgroup: e.target.value })}
                    className="h-[36px] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-gray-700">Quantidade Padrão</Label>
                  <Input
                    type="number"
                    min="1"
                    value={procForm.defaultQuantity}
                    onChange={e => setProcForm({ ...procForm, defaultQuantity: Number(e.target.value) || 1 })}
                    className="h-[36px] text-xs"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-gray-700">Unidade de Medida</Label>
                  <Input
                    placeholder="Ex: UN, CH, HM, Sessão"
                    value={procForm.unit}
                    onChange={e => setProcForm({ ...procForm, unit: e.target.value })}
                    className="h-[36px] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Vigência Inicial</Label>
                  <Input
                    placeholder="Ex: 01/01/2026"
                    value={procForm.initialValidity}
                    onChange={e => setProcForm({ ...procForm, initialValidity: e.target.value })}
                    className="h-[36px] text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Vigência Final</Label>
                  <Input
                    placeholder="Ex: 31/12/2026"
                    value={procForm.finalValidity}
                    onChange={e => setProcForm({ ...procForm, finalValidity: e.target.value })}
                    className="h-[36px] text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Observações / Instruções de Faturamento</Label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais, regras de autorização ou orientações..."
                  value={procForm.observation}
                  onChange={e => setProcForm({ ...procForm, observation: e.target.value })}
                  className="w-full rounded-[8px] border border-[#CBD5E1] p-2 text-xs text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingProcedure}
                  onClick={() => { setIsNewModalOpen(false); setEditingProcedure(null); }}
                  className="text-xs text-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingProcedure}
                  className="text-xs font-semibold bg-[#1E5FA6] hover:bg-[#184d85] text-white"
                >
                  {isSavingProcedure ? 'Salvando...' : editingProcedure ? 'Salvar Alterações' : 'Cadastrar Procedimento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VER DETALHES DO PROCEDIMENTO                                       */}
      {/* ========================================================================= */}
      {viewingProcedure && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#1E5FA6]">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Detalhes do Procedimento</h3>
                  <span className="font-mono text-xs text-[#1E5FA6] font-bold">{viewingProcedure.code}</span>
                </div>
              </div>
              <button 
                onClick={() => setViewingProcedure(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-gray-700">
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Descrição</span>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{viewingProcedure.description}</p>
              </div>

              {viewingProcedure.synonym && (
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Sinônimo / Nome Popular</span>
                  <p className="font-medium text-gray-800 mt-0.5">{viewingProcedure.synonym}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block">Grupo</span>
                  <span className="font-medium text-gray-800">{viewingProcedure.group || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block">Subgrupo</span>
                  <span className="font-medium text-gray-800">{viewingProcedure.subgroup || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block">Qtd Padrão / Unidade</span>
                  <span className="font-medium text-gray-800">{viewingProcedure.defaultQuantity || 1} {viewingProcedure.unit || 'UN'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block">Cód. Equivalente</span>
                  <span className="font-mono font-medium text-gray-800">{viewingProcedure.equivalentCode || '-'}</span>
                </div>
              </div>

              {(viewingProcedure.initialValidity || viewingProcedure.finalValidity) && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>Vigência: {viewingProcedure.initialValidity || 'Início'} {viewingProcedure.finalValidity ? `até ${viewingProcedure.finalValidity}` : ''}</span>
                </div>
              )}

              {viewingProcedure.observation && (
                <div className="bg-amber-50 p-2.5 rounded border border-amber-100 text-amber-900">
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-amber-700">Observação:</span>
                  <p className="mt-0.5 text-xs leading-relaxed">{viewingProcedure.observation}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingProcedure(null)}
                className="text-xs text-gray-700"
              >
                Fechar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const p = viewingProcedure;
                  setViewingProcedure(null);
                  handleOpenEditModal(p);
                }}
                className="text-xs font-semibold bg-[#1E5FA6] text-white"
              >
                <Edit className="w-3.5 h-3.5 mr-1" /> Editar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EXCLUIR PROCEDIMENTO                                               */}
      {/* ========================================================================= */}
      {procedureToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">Excluir Procedimento</h3>
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                  Tem certeza que deseja excluir o procedimento <strong className="text-gray-900 font-mono">{procedureToDelete.code}</strong> - {procedureToDelete.description}?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeletingProcedure}
                onClick={() => setProcedureToDelete(null)}
                className="text-xs text-gray-700"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isDeletingProcedure}
                onClick={handleConfirmDeleteProcedure}
                className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeletingProcedure ? 'Excluindo...' : 'Sim, Excluir Procedimento'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR INFORMAÇÕES DA TABELA                                       */}
      {/* ========================================================================= */}
      {isEditTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Editar Tabela de Procedimentos</h3>
              <button onClick={() => setIsEditTableModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTableInfo} className="mt-4 space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Nome da Tabela *</Label>
                <Input
                  required
                  value={tableForm.name}
                  onChange={e => setTableForm({ ...tableForm, name: e.target.value })}
                  className="h-[36px] text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Operadora Relacionada *</Label>
                <select
                  required
                  value={tableForm.operatorId}
                  onChange={e => setTableForm({ ...tableForm, operatorId: e.target.value })}
                  className="w-full h-[36px] rounded-[8px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                >
                  <option value="">Selecione uma operadora...</option>
                  {operators.map(op => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Versão</Label>
                  <Input
                    value={tableForm.version}
                    onChange={e => setTableForm({ ...tableForm, version: e.target.value })}
                    className="h-[36px] text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Status</Label>
                  <select
                    value={tableForm.status}
                    onChange={e => setTableForm({ ...tableForm, status: e.target.value })}
                    className="w-full h-[36px] rounded-[8px] border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                  >
                    <option value="Ativa">Ativa</option>
                    <option value="Inativa">Inativa</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingTable}
                  onClick={() => setIsEditTableModalOpen(false)}
                  className="text-xs text-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingTable}
                  className="text-xs font-semibold bg-[#1E5FA6] hover:bg-[#184d85] text-white"
                >
                  {isSavingTable ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EXCLUIR TABELA INTEIRA                                             */}
      {/* ========================================================================= */}
      {isDeleteTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">Excluir Tabela Completa</h3>
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                  Tem certeza que deseja excluir a tabela <strong className="text-gray-900">{table.name}</strong>?
                </p>
                <p className="text-[11px] text-red-600 mt-2 bg-red-50 p-2.5 rounded border border-red-100">
                  ⚠️ Esta ação excluirá a tabela e <strong>todos os seus procedimentos vinculados</strong> permanentemente.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeletingTable}
                onClick={() => setIsDeleteTableModalOpen(false)}
                className="text-xs text-gray-700"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isDeletingTable}
                onClick={handleConfirmDeleteTable}
                className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeletingTable ? 'Excluindo tabela e itens...' : 'Sim, Excluir Tabela'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSISTENTE DE MAPEAMENTO E IMPORTAÇÃO DE PLANILHA                 */}
      {/* ========================================================================= */}
      <SpreadsheetMappingModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        onConfirmImport={handleConfirmSpreadsheetImport}
        tableName={table.name}
        isExistingTable={true}
      />
    </div>
  );
}
