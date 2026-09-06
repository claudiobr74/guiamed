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
  writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Plus, 
  UploadCloud, 
  CheckCircle2, 
  Layers, 
  Eye, 
  Edit, 
  Trash2, 
  Search, 
  FileSpreadsheet, 
  RefreshCw, 
  Filter, 
  X, 
  Calendar, 
  Building2,
  ListPlus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { Operator } from './Operators';
import ProcedureTableViewer, { TableDef } from '../components/ProcedureTableViewer';
import { parseProcedureRows } from '../lib/procedureParser';

export default function Tables() {
  const { user } = useAuthStore();
  const [tables, setTables] = useState<TableDef[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected Table for Full Visualizer & CRUD
  const [selectedTable, setSelectedTable] = useState<TableDef | null>(null);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importingState, setImportingState] = useState('');
  const [formData, setFormData] = useState({
    name: '', operatorId: '', version: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Manual Table Creation Modal
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [newTableForm, setNewTableForm] = useState({
    name: '',
    operatorId: '',
    version: '1.0',
    status: 'Ativa'
  });
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  // Edit Table Modal
  const [tableToEdit, setTableToEdit] = useState<TableDef | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    operatorId: '',
    version: '',
    status: 'Ativa'
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Table Modal
  const [tableToDelete, setTableToDelete] = useState<TableDef | null>(null);
  const [isDeletingTable, setIsDeletingTable] = useState(false);

  // Search & Filters for Table List
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOperator, setFilterOperator] = useState('all');

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch operators
      const opsQ = query(collection(db, 'operators'), where('doctorId', '==', user.uid));
      const opsSnap = await getDocs(opsQ);
      setOperators(opsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Operator[]);
      
      // Fetch tables
      const tabsQ = query(collection(db, 'tables'), where('doctorId', '==', user.uid));
      const tabsSnap = await getDocs(tabsQ);
      const fetchedTables = tabsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TableDef[];
      
      // Sort by createdAt descending
      fetchedTables.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      setTables(fetchedTables);

      // If a table is currently open, keep it updated
      if (selectedTable) {
        const updatedSelected = fetchedTables.find(t => t.id === selectedTable.id);
        if (updatedSelected) {
          setSelectedTable(updatedSelected);
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar tabelas:', err);
      toast.error('Erro ao carregar tabelas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const processFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error)
        });
      } else if (ext === 'xls' || ext === 'xlsx') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          resolve(json);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error("Formato não suportado"));
      }
    });
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFile || !formData.name.trim() || !formData.operatorId) {
      toast.error('Preencha os campos obrigatórios e anexe o arquivo da planilha.');
      return;
    }
    
    setIsImporting(true);
    setImportingState('Lendo arquivo de planilha...');
    
    try {
      const data = await processFile(selectedFile);
      if (!data || data.length === 0) {
        throw new Error('A planilha está vazia ou não contém dados legíveis.');
      }

      const parseResult = parseProcedureRows(data);
      if (parseResult.procedures.length === 0) {
        throw new Error('Nenhum procedimento pôde ser identificado. Verifique se o arquivo possui colunas com código e descrição.');
      }

      setImportingState(`Processando ${parseResult.procedures.length} procedimentos...`);
      
      // 1. Create table document in Firestore
      const tableRef = await addDoc(collection(db, 'tables'), {
        doctorId: user.uid,
        name: formData.name.trim(),
        operatorId: formData.operatorId,
        version: formData.version.trim() || '1.0',
        status: 'Ativa',
        count: 0,
        createdAt: new Date()
      });
      
      // 2. Chunk insertions (up to 400 per batch)
      const chunks = [];
      for (let i = 0; i < parseResult.procedures.length; i += 400) {
        chunks.push(parseResult.procedures.slice(i, i + 400));
      }
      
      let insertedCount = 0;
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((p) => {
          const procRef = doc(collection(db, 'procedures'));
          batch.set(procRef, {
            doctorId: user.uid,
            tableId: tableRef.id,
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
        setImportingState(`Gravando itens no banco... (${insertedCount}/${parseResult.procedures.length})`);
      }
      
      // Update actual inserted count in table
      await updateDoc(tableRef, { count: insertedCount });

      setImportingState('Concluído com sucesso!');
      toast.success(`Tabela "${formData.name}" importada com ${insertedCount} procedimentos!`);
      
      setFormData({ name: '', operatorId: '', version: '' });
      setSelectedFile(null);
      await fetchData();

      // Automatically open the newly imported table in viewer!
      const newTableObj: TableDef = {
        id: tableRef.id,
        name: formData.name.trim(),
        operatorId: formData.operatorId,
        version: formData.version.trim() || '1.0',
        status: 'Ativa',
        count: insertedCount,
        createdAt: new Date()
      };
      setSelectedTable(newTableObj);

    } catch (err: any) {
      console.error('Erro na importação:', err);
      toast.error(`Erro na importação: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Create empty manual table
  const handleCreateManualTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTableForm.name.trim() || !newTableForm.operatorId) {
      toast.error('Preencha o nome e selecione uma operadora.');
      return;
    }

    setIsCreatingTable(true);
    try {
      const docRef = await addDoc(collection(db, 'tables'), {
        doctorId: user.uid,
        name: newTableForm.name.trim(),
        operatorId: newTableForm.operatorId,
        version: newTableForm.version.trim() || '1.0',
        status: newTableForm.status,
        count: 0,
        createdAt: new Date()
      });

      const createdTable: TableDef = {
        id: docRef.id,
        name: newTableForm.name.trim(),
        operatorId: newTableForm.operatorId,
        version: newTableForm.version.trim() || '1.0',
        status: newTableForm.status,
        count: 0,
        createdAt: new Date()
      };

      toast.success(`Tabela "${newTableForm.name}" criada com sucesso!`);
      setIsNewTableModalOpen(false);
      setNewTableForm({ name: '', operatorId: '', version: '1.0', status: 'Ativa' });
      await fetchData();
      setSelectedTable(createdTable);
    } catch (err: any) {
      console.error('Erro ao criar tabela:', err);
      toast.error('Erro ao criar tabela: ' + err.message);
    } finally {
      setIsCreatingTable(false);
    }
  };

  // Open Edit Table Modal
  const handleOpenEditModal = (table: TableDef) => {
    setTableToEdit(table);
    setEditForm({
      name: table.name,
      operatorId: table.operatorId,
      version: table.version || '',
      status: table.status || 'Ativa'
    });
  };

  // Save Edit Table
  const handleSaveEditTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableToEdit || !editForm.name.trim() || !editForm.operatorId) {
      toast.error('Nome e Operadora são obrigatórios.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const tableRef = doc(db, 'tables', tableToEdit.id);
      await updateDoc(tableRef, {
        name: editForm.name.trim(),
        operatorId: editForm.operatorId,
        version: editForm.version.trim(),
        status: editForm.status,
        updatedAt: new Date()
      });

      toast.success('Tabela atualizada com sucesso!');
      setTableToEdit(null);
      await fetchData();
    } catch (err: any) {
      console.error('Erro ao editar tabela:', err);
      toast.error('Erro ao salvar alterações: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Confirm Delete Table and Cascade Procedures
  const handleConfirmDeleteTable = async () => {
    if (!user || !tableToDelete) return;
    setIsDeletingTable(true);
    try {
      // Delete linked procedures
      const q = query(
        collection(db, 'procedures'),
        where('doctorId', '==', user.uid),
        where('tableId', '==', tableToDelete.id)
      );
      const snap = await getDocs(q);
      const chunks: any[][] = [];
      for (let i = 0; i < snap.docs.length; i += 400) {
        chunks.push(snap.docs.slice(i, i + 400));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // Delete table doc
      await deleteDoc(doc(db, 'tables', tableToDelete.id));

      toast.success(`Tabela "${tableToDelete.name}" e seus itens foram excluídos.`);
      setTableToDelete(null);
      if (selectedTable && selectedTable.id === tableToDelete.id) {
        setSelectedTable(null);
      }
      await fetchData();
    } catch (err: any) {
      console.error('Erro ao excluir tabela:', err);
      toast.error('Erro ao excluir tabela: ' + err.message);
    } finally {
      setIsDeletingTable(false);
    }
  };

  // Filter tables for list view
  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      const op = operators.find(o => o.id === t.operatorId);
      const opName = op ? op.name.toLowerCase() : '';
      const matchesSearch = 
        searchTerm.trim() === '' ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opName.includes(searchTerm.toLowerCase()) ||
        (t.version && t.version.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesOp = filterOperator === 'all' || t.operatorId === filterOperator;

      return matchesSearch && matchesOp;
    });
  }, [tables, operators, searchTerm, filterOperator]);

  // If a table is selected, render the full ProcedureTableViewer
  if (selectedTable) {
    return (
      <ProcedureTableViewer
        table={selectedTable}
        operators={operators}
        onBack={() => setSelectedTable(null)}
        onTableUpdated={(updated) => {
          setSelectedTable(prev => prev ? { ...prev, ...updated } : null);
          fetchData();
        }}
        onTableDeleted={() => {
          setSelectedTable(null);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <Link to="/configuracoes">
            <Button variant="ghost" size="sm" className="text-[#64748B] hover:text-[#0F172A] border-[#CBD5E1]">
              ← Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Tabelas de Procedimentos</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Importação, consulta detalhada e gestão completa de catálogos TUSS, CBHPM e operadoras</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsNewTableModalOpen(true)}
            className="h-[36px] text-xs font-semibold bg-[#1E5FA6] hover:bg-[#184d85] text-white shadow-xs"
          >
            <ListPlus className="h-4 w-4 mr-1.5" /> Criar Tabela Manual
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Import Box */}
        <div className="lg:col-span-4">
          <Card className="border-[#E2E8F0] shadow-xs bg-white">
            <CardHeader className="py-3.5 px-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-[#1E5FA6]" />
                <CardTitle className="text-[14px] font-bold text-[#0F172A]">Importar Nova Planilha</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleImport} className="space-y-3.5">
                <div className="space-y-1">
                  <Label className="text-[12px] font-semibold text-[#475569]">Nome da Tabela *</Label>
                  <Input 
                    required 
                    placeholder="Ex: TUSS ANS 2026 - Unimed" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="h-[38px] text-[13px]"
                  />
                </div>

                <div className="space-y-1">
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

                <div className="space-y-1">
                  <Label className="text-[12px] font-semibold text-[#475569]">Versão / Referência</Label>
                  <Input 
                    placeholder="Ex: 2026.07" 
                    value={formData.version} 
                    onChange={e => setFormData({...formData, version: e.target.value})} 
                    className="h-[38px] text-[13px]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[12px] font-semibold text-[#475569]">Arquivo de Planilha (CSV, XLS, XLSX) *</Label>
                  <div className="mt-1 flex justify-center px-4 pt-4 pb-4 border-2 border-[#CBD5E1] border-dashed rounded-[8px] relative hover:bg-[#F8FAFC] transition-colors cursor-pointer bg-white">
                    <div className="space-y-1.5 text-center w-full">
                      <FileSpreadsheet className="mx-auto h-7 w-7 text-[#1E5FA6]" />
                      <div className="flex text-[12px] text-[#475569] justify-center">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-transparent rounded-[4px] font-semibold text-[#1E5FA6] hover:underline focus-within:outline-none">
                          <span className="break-all">{selectedFile ? selectedFile.name : 'Selecionar arquivo de planilha'}</span>
                          <input 
                            id="file-upload" 
                            name="file-upload" 
                            type="file" 
                            className="sr-only" 
                            accept=".csv, .xls, .xlsx"
                            onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                      {!selectedFile ? (
                        <p className="text-[11px] text-[#94A3B8]">Requer colunas de Código e Descrição</p>
                      ) : (
                        <p className="text-[11px] text-emerald-600 font-medium">Arquivo selecionado pronto para importação</p>
                      )}
                    </div>
                  </div>
                </div>

                {isImporting && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
                    <RefreshCw className="h-4 w-4 text-[#1E5FA6] animate-spin mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-blue-900">{importingState}</p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-[38px] text-[13px] font-semibold bg-[#1E5FA6] hover:bg-[#184d85] text-white shadow-xs" 
                  disabled={isImporting || !selectedFile}
                >
                  {isImporting ? 'Importando...' : 'Iniciar Importação'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tables List with search and actions */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-[#E2E8F0] shadow-xs bg-white">
            <CardHeader className="py-3.5 px-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#1E5FA6]" />
                  <CardTitle className="text-[14px] font-bold text-[#0F172A]">Tabelas Cadastradas ({filteredTables.length})</CardTitle>
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      placeholder="Filtrar tabela..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-8 h-[32px] text-xs w-44"
                    />
                  </div>

                  <select
                    value={filterOperator}
                    onChange={e => setFilterOperator(e.target.value)}
                    className="h-[32px] rounded-[6px] border border-[#CBD5E1] bg-white px-2 text-xs text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                  >
                    <option value="all">Todas as Operadoras</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>

            <div className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <div className="p-12 text-center text-[13px] text-[#64748B]">
                  <RefreshCw className="h-6 w-6 text-[#1E5FA6] animate-spin mx-auto mb-2" />
                  Carregando catálogo de tabelas...
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="p-12 text-center">
                  <Layers className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-800">Nenhuma tabela encontrada</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {tables.length === 0 
                      ? 'Importe uma planilha ou crie uma tabela manual para começar.' 
                      : 'Tente alterar os termos de busca ou filtros.'}
                  </p>
                </div>
              ) : (
                filteredTables.map(table => {
                  const operatorName = operators.find(o => o.id === table.operatorId)?.name || 'Sem Operadora';
                  const formattedDate = table.createdAt?.toDate 
                    ? table.createdAt.toDate().toLocaleDateString('pt-BR') 
                    : new Date().toLocaleDateString('pt-BR');

                  return (
                    <div 
                      key={table.id} 
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-colors group"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-[14px] text-[#0F172A] group-hover:text-[#1E5FA6] transition-colors">
                            {table.name}
                          </h4>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                            table.status === 'Inativa' 
                              ? 'bg-gray-100 text-gray-600 border-gray-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {table.status || 'Ativa'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#64748B]">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-gray-400" />
                            Operadora: <strong className="text-[#334155]">{operatorName}</strong>
                          </span>
                          <span>•</span>
                          <span>Versão: <strong className="text-[#334155]">{table.version || '1.0'}</strong></span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            {formattedDate}
                          </span>
                        </div>
                      </div>

                      {/* Right Action Box */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Procedure Counter Badge */}
                        <div className="text-[12px] font-medium text-[#475569] flex items-center gap-1.5 bg-[#F1F5F9] px-2.5 py-1.5 rounded-[6px] border border-[#E2E8F0]">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#15803D]" />
                          <span className="font-bold text-gray-800">{table.count || 0}</span> itens
                        </div>

                        {/* View Table (Primary Action) */}
                        <Button
                          size="sm"
                          onClick={() => setSelectedTable(table)}
                          className="h-[34px] text-xs font-semibold bg-[#1E5FA6] hover:bg-[#184d85] text-white shadow-xs"
                          title="Visualizar catálogo completo e gerenciar procedimentos"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar Tabela
                        </Button>

                        {/* Edit Table Meta */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(table)}
                          className="h-[34px] w-[34px] p-0 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                          title="Editar informações da tabela"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>

                        {/* Delete Table */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTableToDelete(table)}
                          className="h-[34px] w-[34px] p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                          title="Excluir tabela e todos os itens"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR TABELA MANUALMENTE                                           */}
      {/* ========================================================================= */}
      {isNewTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-[#1E5FA6]" />
                <h3 className="text-base font-bold text-gray-900">Criar Tabela Manualmente</h3>
              </div>
              <button onClick={() => setIsNewTableModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualTable} className="mt-4 space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Nome da Tabela *</Label>
                <Input
                  required
                  placeholder="Ex: Tabela Personalizada de Consultas"
                  value={newTableForm.name}
                  onChange={e => setNewTableForm({ ...newTableForm, name: e.target.value })}
                  className="h-[36px] text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Operadora Relacionada *</Label>
                <select
                  required
                  value={newTableForm.operatorId}
                  onChange={e => setNewTableForm({ ...newTableForm, operatorId: e.target.value })}
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
                    placeholder="Ex: 1.0"
                    value={newTableForm.version}
                    onChange={e => setNewTableForm({ ...newTableForm, version: e.target.value })}
                    className="h-[36px] text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Status</Label>
                  <select
                    value={newTableForm.status}
                    onChange={e => setNewTableForm({ ...newTableForm, status: e.target.value })}
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
                  disabled={isCreatingTable}
                  onClick={() => setIsNewTableModalOpen(false)}
                  className="text-xs text-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingTable}
                  className="text-xs font-semibold bg-[#1E5FA6] hover:bg-[#184d85] text-white"
                >
                  {isCreatingTable ? 'Criando...' : 'Criar Tabela'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR TABELA                                                      */}
      {/* ========================================================================= */}
      {tableToEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Editar Informações da Tabela</h3>
              <button onClick={() => setTableToEdit(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTable} className="mt-4 space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Nome da Tabela *</Label>
                <Input
                  required
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="h-[36px] text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Operadora Relacionada *</Label>
                <select
                  required
                  value={editForm.operatorId}
                  onChange={e => setEditForm({ ...editForm, operatorId: e.target.value })}
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
                    value={editForm.version}
                    onChange={e => setEditForm({ ...editForm, version: e.target.value })}
                    className="h-[36px] text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Status</Label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
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
                  disabled={isSavingEdit}
                  onClick={() => setTableToEdit(null)}
                  className="text-xs text-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingEdit}
                  className="text-xs font-semibold bg-[#1E5FA6] hover:bg-[#184d85] text-white"
                >
                  {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EXCLUIR TABELA                                                     */}
      {/* ========================================================================= */}
      {tableToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">Excluir Tabela de Procedimentos</h3>
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                  Tem certeza que deseja excluir a tabela <strong className="text-gray-900">{tableToDelete.name}</strong>?
                </p>
                <p className="text-[11px] text-red-600 mt-2 bg-red-50 p-2.5 rounded border border-red-100">
                  ⚠️ Esta ação excluirá a tabela e <strong>todos os seus procedimentos cadastrados</strong> permanentemente.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeletingTable}
                onClick={() => setTableToDelete(null)}
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
                {isDeletingTable ? 'Excluindo...' : 'Sim, Excluir Tabela'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
