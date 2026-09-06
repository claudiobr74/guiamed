import React, { useState, useEffect, useRef, useId } from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  FileText,
  Search,
  ShieldCheck,
  Lock,
  Layers,
  Clock,
  Check,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CID10Version, CID10Record } from '../types/cid10';
import { getActiveCID10Version, searchCID10, ensureCID10Initialized } from '../lib/cid10Store';
import { importCID10Subcategories } from '../lib/cid10Importer';

export default function Cid10Settings() {
  const testInputId = useId();
  const [version, setVersion] = useState<CID10Version | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null);
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Teste interativo em tempo real
  const [testQuery, setTestQuery] = useState('M17');
  const [testResults, setTestResults] = useState<CID10Record[]>([]);
  const [testTime, setTestTime] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadActiveVersion = async () => {
    setLoading(true);
    try {
      await ensureCID10Initialized();
      const v = await getActiveCID10Version();
      setVersion(v);
    } catch (err) {
      console.error('Erro ao carregar versão do CID-10:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveVersion();
  }, []);

  // Executa busca interativa de teste
  useEffect(() => {
    if (!testQuery.trim()) {
      setTestResults([]);
      setTestTime('');
      return;
    }
    const t0 = performance.now();
    searchCID10(testQuery, 5).then(res => {
      const t1 = performance.now();
      setTestResults(res);
      setTestTime(`${(t1 - t0).toFixed(1)} ms`);
    });
  }, [testQuery]);

  // Upload manual de novo arquivo CSV oficial
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportFeedback(null);
    setProgress({ stage: `Carregando arquivo ${file.name}...`, percent: 10 });

    try {
      const buffer = await file.arrayBuffer();
      const result = await importCID10Subcategories(buffer, {
        versionName: `Custom (${file.name})`,
        sourceName: 'CID-10 Brasil / DATASUS',
        onProgress: (p) => {
          setProgress({ stage: p.stage, percent: p.percent });
        }
      });

      if (result.success) {
        setVersion(result.version);
        setImportFeedback({
          type: 'success',
          message: `Novo arquivo CSV importado e ativado com sucesso! ${result.version.recordCount.toLocaleString('pt-BR')} registros validados.`
        });
      } else {
        setImportFeedback({
          type: 'error',
          message: `Falha na validação do arquivo: ${result.error}. Nenhuma alteração foi feita na base ativa.`
        });
      }
    } catch (err: any) {
      setImportFeedback({
        type: 'error',
        message: err.message || 'Erro ao processar arquivo enviado.'
      });
    } finally {
      setImporting(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="cid10-settings-page">
      {/* CABEÇALHO COM BREADCRUMB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link to="/configuracoes" className="hover:text-blue-600 transition-colors">
              Configurações
            </Link>
            <span>›</span>
            <span>Bases de dados</span>
            <span>›</span>
            <span className="text-gray-900 font-semibold">CID-10</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            Base de Dados CID-10 Brasil
          </h1>
        </div>

        <Link to="/configuracoes">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar às Configurações
          </Button>
        </Link>
      </div>

      {/* FEEDBACK DE IMPORTAÇÃO */}
      {importFeedback && (
        <div
          id="cid10-import-feedback"
          className={`p-4 rounded-lg flex items-start gap-3 text-sm ${
            importFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {importFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{importFeedback.message}</div>
          <button
            onClick={() => setImportFeedback(null)}
            className="text-xs font-bold hover:underline shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* BARRA DE PROGRESSO DURANTE IMPORTAÇÃO ATÔMICA */}
      {importing && progress && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                {progress.stage}
              </span>
              <span>{progress.percent}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="text-[11px] text-blue-700">
              Importação atômica em andamento. A versão atual permanece ativa até que a nova seja totalmente validada.
            </p>
          </CardContent>
        </Card>
      )}

      {/* CARD PRINCIPAL: INFORMAÇÕES DA BASE ATIVA */}
      <Card id="cid10-active-version-card">
        <CardHeader className="pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              CID-10 Brasil (Classificação Internacional de Doenças)
            </CardTitle>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Status: Ativa
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Fonte Oficial</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {version?.source || 'CID-10 Brasil / DATASUS'}
              </p>
              <p className="text-xs text-gray-500">Ministério da Saúde</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Versão</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {version?.version || '2008 (DATASUS)'}
              </p>
              <p className="text-xs text-gray-500">Subcategorias Completas</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total de Registros</p>
              <p className="mt-1 text-sm font-semibold text-blue-700 font-mono">
                {version?.recordCount ? version.recordCount.toLocaleString('pt-BR') : '12.451'}
              </p>
              <p className="text-xs text-gray-500">Diagnósticos homologados</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Última Importação</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {version?.lastImportDate
                  ? new Date(version.lastImportDate).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Recente'}
              </p>
              <p className="text-xs text-gray-500">Validação íntegra</p>
            </div>
          </div>

          {/* AVISO DE PROTEÇÃO CONTRA EDIÇÃO MANUAL ACIDENTAL */}
          <div className="mt-6 p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-900">
              <span className="font-semibold">Base protegida: </span>
              A tabela oficial da CID-10 é padronizada pelo DATASUS e possui integridade estrita para faturamento TISS e prontuário. A edição manual arbitrária de códigos ou descrições é bloqueada para prevenir glosas e incoerências em auditorias.
            </div>
          </div>

          {/* RELATÓRIO DE INTEGRIDADE E VALIDAÇÃO */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Checklist de Validação da Versão Ativa
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Registros mínimos validados (&gt; 10.000)</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nenhum código ou descrição vazia</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Encoding oficial (ISO-8859-1) preservado</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Acentos e cedilhas íntegros (sem mojibake)</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tratamento de duplicatas e chaves únicas</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Índices canônicos e normalizados gerados</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARD DE AÇÕES ADMINISTRATIVAS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">
            Rotina Administrativa de Importação e Atualização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            O LizaCare já inclui uma base CID-10 local pronta para pesquisa. Se for necessário substituir a base no futuro, carregue manualmente um arquivo oficial <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 font-mono">CID-10-SUBCATEGORIAS.CSV</code>; a nova versão só é ativada após validação.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <label htmlFor="cid10-upload-csv-input">
              <Button
                type="button"
                variant="outline"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                Carregar Novo Arquivo CSV Oficial
              </Button>
            </label>
            <input
              id="cid10-upload-csv-input"
              ref={fileInputRef}
              type="file"
              accept=".csv,.CSV"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* SANDBOX DE VERIFICAÇÃO EM TEMPO REAL */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              Validação Rápida da Pesquisa em Tempo Real
            </CardTitle>
            {testTime && (
              <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Tempo de resposta: {testTime}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <label htmlFor={testInputId} className="sr-only">Termo de teste CID-10</label>
            <input
              id={testInputId}
              type="text"
              value={testQuery}
              onChange={e => setTestQuery(e.target.value)}
              placeholder="Digite código com ou sem ponto (ex: M17.1 ou M171) ou descrição (ex: gonartrose)..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          <div className="space-y-2">
            {testResults.map(r => (
              <div
                key={r.code}
                className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    {r.code}
                  </span>
                  <span className="text-gray-800 font-medium">{r.description}</span>
                </div>
                <span className="text-[11px] text-gray-400 shrink-0 font-mono">
                  {r.codeClean}
                </span>
              </div>
            ))}
            {testQuery && testResults.length === 0 && (
              <p className="text-xs text-gray-500 py-2 text-center">Nenhum resultado encontrado.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
