import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Table, 
  ArrowRight, 
  Layers, 
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { 
  detectColumns, 
  parseProcedureRows, 
  ColumnDetection, 
  ParsedProcedure 
} from '../lib/procedureParser';
import { toast } from 'react-hot-toast';

interface SpreadsheetMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (
    procedures: ParsedProcedure[], 
    replaceExisting: boolean, 
    onProgress: (status: string) => void
  ) => Promise<void>;
  tableName?: string;
  isExistingTable?: boolean;
}

export default function SpreadsheetMappingModal({
  isOpen,
  onClose,
  onConfirmImport,
  tableName,
  isExistingTable = false
}: SpreadsheetMappingModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnDetection>({
    codeColumn: '',
    descColumn: ''
  });
  const [replaceExisting, setReplaceExisting] = useState<boolean>(isExistingTable);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string>('');

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setRawRows([]);
      setAvailableColumns([]);
      setColumnMapping({ codeColumn: '', descColumn: '' });
      setReplaceExisting(isExistingTable);
      setIsReadingFile(false);
      setIsImporting(false);
      setImportStatus('');
    }
  }, [isOpen, isExistingTable]);

  // Read file contents
  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsReadingFile(true);
    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      let rows: any[] = [];

      if (ext === 'csv') {
        const text = await selectedFile.text();
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false
        });
        rows = (parsed.data || []).filter((r: any) => r && typeof r === 'object' && Object.keys(r).length > 0);
      } else if (ext === 'xls' || ext === 'xlsx') {
        const buffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      } else {
        throw new Error('Formato não suportado. Utilize arquivos .CSV, .XLS ou .XLSX.');
      }

      if (!rows || rows.length === 0) {
        throw new Error('A planilha está vazia ou não contém dados válidos.');
      }

      setRawRows(rows);

      // Inspect sample keys
      const sample = rows.slice(0, 50);
      const cols = Array.from(new Set(sample.flatMap(r => Object.keys(r)))).filter(k => k && !k.startsWith('__EMPTY_EMPTY'));
      setAvailableColumns(cols);

      // Auto detect columns with smart heuristics
      const detected = detectColumns(rows);
      setColumnMapping(detected);

      toast.success(`${rows.length} linhas encontradas na planilha!`);
    } catch (err: any) {
      console.error('Erro ao processar planilha:', err);
      toast.error(err.message || 'Erro ao ler arquivo.');
      setFile(null);
      setRawRows([]);
    } finally {
      setIsReadingFile(false);
    }
  };

  // Helper to get preview samples for a column
  const getColumnSample = (colName: string): string => {
    if (!colName || rawRows.length === 0) return '';
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const val = rawRows[i]?.[colName];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const str = String(val).trim();
        return str.length > 28 ? str.substring(0, 25) + '...' : str;
      }
    }
    return '';
  };

  // Live parsed procedures preview based on current mapping
  const previewData = useMemo(() => {
    if (rawRows.length === 0 || !columnMapping.codeColumn || !columnMapping.descColumn) {
      return [];
    }
    const sample = rawRows.slice(0, 6);
    const parsed = parseProcedureRows(sample, columnMapping);
    return parsed.procedures;
  }, [rawRows, columnMapping]);

  // Check if selected description column might be numeric
  const isDescPotentiallyNumeric = useMemo(() => {
    if (previewData.length === 0) return false;
    const numericDescriptions = previewData.filter(p => /^\d+$/.test(p.description.trim()) || p.description.trim() === p.code.trim());
    return numericDescriptions.length >= previewData.length * 0.5;
  }, [previewData]);

  // Handle final import
  const handleStartImport = async () => {
    if (!columnMapping.codeColumn || !columnMapping.descColumn) {
      toast.error('Selecione obrigatoriamente a Coluna do Código e a Coluna da Descrição.');
      return;
    }

    setIsImporting(true);
    setImportStatus('Processando todas as linhas da planilha...');

    try {
      const parsedFull = parseProcedureRows(rawRows, columnMapping);
      if (parsedFull.procedures.length === 0) {
        throw new Error('Nenhum procedimento pôde ser extraído com as colunas selecionadas.');
      }

      await onConfirmImport(parsedFull.procedures, replaceExisting, (status) => {
        setImportStatus(status);
      });

      onClose();
    } catch (err: any) {
      console.error('Erro na importação:', err);
      toast.error(err.message || 'Erro ao gravar procedimentos.');
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-gray-200 animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#1E5FA6]/10 text-[#1E5FA6] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Assistente de Mapeamento de Planilha de Procedimentos
              </h2>
              <p className="text-xs text-gray-500">
                {tableName ? `Tabela: ${tableName}` : 'Configure as colunas de Código e Descrição'}
              </p>
            </div>
          </div>
          <button 
            disabled={isImporting}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Step 1: File Selection */}
          {!file || rawRows.length === 0 ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[#CBD5E1] hover:border-[#1E5FA6] rounded-xl p-8 text-center bg-gray-50 hover:bg-blue-50/40 transition-all cursor-pointer">
                <FileSpreadsheet className="w-12 h-12 text-[#1E5FA6] mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Selecione sua planilha de procedimentos
                </h3>
                <p className="text-xs text-gray-500 mb-4 max-w-md mx-auto">
                  Formatos compatíveis: <strong>.XLSX, .XLS ou .CSV</strong> (Tabelas TUSS, CBHPM, Rol ANS, Unimed, Bradesco, Amil, SulAmérica, etc.)
                </p>

                <label className="inline-flex items-center justify-center px-4 py-2 bg-[#1E5FA6] hover:bg-[#184d85] text-white text-xs font-semibold rounded-lg cursor-pointer shadow-xs transition-colors">
                  <span>Escolher Arquivo do Computador</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".csv, .xls, .xlsx"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileChange(f);
                    }}
                  />
                </label>
              </div>

              {isReadingFile && (
                <div className="flex items-center justify-center gap-2 text-xs text-[#1E5FA6] font-medium py-3">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Lendo e analisando estrutura da planilha...
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3.5">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-5 h-5 text-[#1E5FA6]" />
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">{file.name}</span>
                    <span className="text-[11px] text-gray-600">
                      <strong>{rawRows.length.toLocaleString('pt-BR')}</strong> linhas detectadas • <strong>{availableColumns.length}</strong> colunas
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isImporting}
                  onClick={() => {
                    setFile(null);
                    setRawRows([]);
                    setAvailableColumns([]);
                  }}
                  className="h-[30px] text-xs font-medium text-gray-600 hover:text-gray-900 border-gray-300"
                >
                  Trocar Arquivo
                </Button>
              </div>

              {/* Warning if description is numeric */}
              {isDescPotentiallyNumeric && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Atenção na coluna de Descrição:</strong>
                    <p className="mt-0.5 text-amber-800">
                      A coluna selecionada atualmente como <em>"Descrição"</em> contém números ou códigos. 
                      Certifique-se de escolher a coluna que contém o <strong>nome por extenso do procedimento</strong> no seletor abaixo.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Column Mapping Configuration */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#1E5FA6]" />
                    1. Mapeamento de Colunas da Planilha
                  </h3>
                  <span className="text-[11px] text-gray-500">
                    O sistema pré-selecionou as melhores correspondências automaticamente.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                  
                  {/* Code Column (Required) */}
                  <div>
                    <Label className="text-xs font-semibold text-gray-900 flex items-center justify-between">
                      <span>Coluna do Código (TUSS/CBHPM) *</span>
                      <span className="text-[10px] text-blue-600 font-normal">Obrigatório</span>
                    </Label>
                    <select
                      value={columnMapping.codeColumn}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, codeColumn: e.target.value }))}
                      className="mt-1.5 w-full h-[38px] rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] font-medium outline-none focus:border-[#1E5FA6] focus:ring-1 focus:ring-[#1E5FA6]"
                    >
                      <option value="">-- Selecione a coluna de código --</option>
                      {availableColumns.map(col => (
                        <option key={col} value={col}>
                          {col} {getColumnSample(col) ? `(Ex: "${getColumnSample(col)}")` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description Column (Required) */}
                  <div>
                    <Label className="text-xs font-semibold text-gray-900 flex items-center justify-between">
                      <span>Coluna do Nome / Descrição *</span>
                      <span className="text-[10px] text-blue-600 font-normal">Obrigatório</span>
                    </Label>
                    <select
                      value={columnMapping.descColumn}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, descColumn: e.target.value }))}
                      className="mt-1.5 w-full h-[38px] rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] font-medium outline-none focus:border-[#1E5FA6] focus:ring-1 focus:ring-[#1E5FA6]"
                    >
                      <option value="">-- Selecione a coluna de descrição do procedimento --</option>
                      {availableColumns.map(col => (
                        <option key={col} value={col}>
                          {col} {getColumnSample(col) ? `(Ex: "${getColumnSample(col)}")` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Group Column (Optional) */}
                  <div>
                    <Label className="text-xs font-medium text-gray-700">
                      Coluna do Grupo / Especialidade (Opcional)
                    </Label>
                    <select
                      value={columnMapping.groupColumn || ''}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, groupColumn: e.target.value || undefined }))}
                      className="mt-1.5 w-full h-[36px] rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                    >
                      <option value="">-- Nenhum / Não mapear --</option>
                      {availableColumns.map(col => (
                        <option key={col} value={col}>
                          {col} {getColumnSample(col) ? `(Ex: "${getColumnSample(col)}")` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subgroup Column (Optional) */}
                  <div>
                    <Label className="text-xs font-medium text-gray-700">
                      Coluna do Subgrupo (Opcional)
                    </Label>
                    <select
                      value={columnMapping.subgroupColumn || ''}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, subgroupColumn: e.target.value || undefined }))}
                      className="mt-1.5 w-full h-[36px] rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                    >
                      <option value="">-- Nenhum / Não mapear --</option>
                      {availableColumns.map(col => (
                        <option key={col} value={col}>
                          {col} {getColumnSample(col) ? `(Ex: "${getColumnSample(col)}")` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Synonym Column (Optional) */}
                  <div>
                    <Label className="text-xs font-medium text-gray-700">
                      Coluna de Sinônimo / Nome Popular (Opcional)
                    </Label>
                    <select
                      value={columnMapping.synonymColumn || ''}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, synonymColumn: e.target.value || undefined }))}
                      className="mt-1.5 w-full h-[36px] rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                    >
                      <option value="">-- Nenhum / Não mapear --</option>
                      {availableColumns.map(col => (
                        <option key={col} value={col}>
                          {col} {getColumnSample(col) ? `(Ex: "${getColumnSample(col)}")` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity & Unit (Optional) */}
                  <div>
                    <Label className="text-xs font-medium text-gray-700">
                      Coluna de Quantidade Padrão (Opcional)
                    </Label>
                    <select
                      value={columnMapping.qtdColumn || ''}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, qtdColumn: e.target.value || undefined }))}
                      className="mt-1.5 w-full h-[36px] rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                    >
                      <option value="">-- Padrão (1) --</option>
                      {availableColumns.map(col => (
                        <option key={col} value={col}>
                          {col} {getColumnSample(col) ? `(Ex: "${getColumnSample(col)}")` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>

              {/* Step 3: Live Preview Table */}
              <div>
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                  <Table className="w-4 h-4 text-[#1E5FA6]" />
                  2. Pré-visualização em Tempo Real (Primeiras 5 Linhas)
                </h3>

                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#F8FAFC] border-b border-gray-200 text-gray-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3.5 w-28">Código</th>
                        <th className="py-2.5 px-3.5">Descrição do Procedimento</th>
                        <th className="py-2.5 px-3.5 w-40">Grupo</th>
                        <th className="py-2.5 px-3.5 w-20 text-center">Qtd</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewData.length > 0 ? (
                        previewData.slice(0, 5).map((item, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                            <td className="py-2.5 px-3.5 font-mono font-bold text-[#1E5FA6]">
                              {item.code}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#0F172A] font-medium">
                              {item.description}
                              {item.synonym && (
                                <span className="block text-[11px] text-gray-400">
                                  Sinônimo: {item.synonym}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-gray-600 text-[11px]">
                              {item.group || <span className="text-gray-300">-</span>}
                            </td>
                            <td className="py-2.5 px-3.5 text-center text-gray-700 font-semibold">
                              {item.defaultQuantity || 1}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-gray-400 text-xs">
                            Selecione as colunas de Código e Descrição acima para ver a pré-visualização.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 4: Mode Selection if existing table */}
              {isExistingTable && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <span className="text-xs font-bold text-gray-900 block">Modo de Gravação dos Procedimentos:</span>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                      <input
                        type="radio"
                        name="replaceMode"
                        checked={replaceExisting}
                        onChange={() => setReplaceExisting(true)}
                        className="text-[#1E5FA6] focus:ring-[#1E5FA6]"
                      />
                      <span><strong>Substituir</strong> procedimentos anteriores desta tabela (Recomendado para corrigir mapeamento)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                      <input
                        type="radio"
                        name="replaceMode"
                        checked={!replaceExisting}
                        onChange={() => setReplaceExisting(false)}
                        className="text-[#1E5FA6] focus:ring-[#1E5FA6]"
                      />
                      <span><strong>Adicionar / Concatenar</strong> aos procedimentos já existentes</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Progress Box */}
              {isImporting && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center space-y-2">
                  <RefreshCw className="w-5 h-5 text-[#1E5FA6] animate-spin mx-auto" />
                  <p className="text-xs font-bold text-blue-950">{importStatus}</p>
                  <p className="text-[11px] text-blue-700">Por favor, aguarde enquanto os registros são gravados no banco de dados.</p>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isImporting}
            onClick={onClose}
            className="text-xs text-gray-600 hover:text-gray-900 border-gray-300"
          >
            Cancelar
          </Button>

          {file && rawRows.length > 0 && (
            <Button
              type="button"
              size="sm"
              disabled={isImporting || !columnMapping.codeColumn || !columnMapping.descColumn}
              onClick={handleStartImport}
              className="text-xs font-semibold bg-[#1E5FA6] hover:bg-[#184d85] text-white shadow-xs px-5 h-[36px]"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Gravando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Confirmar e Importar {rawRows.length.toLocaleString('pt-BR')} Itens
                </>
              )}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
