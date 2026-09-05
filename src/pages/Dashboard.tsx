import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, FileText, Calendar, Users, LayoutTemplate, Activity, Copy, Download, Trash2, Search, Eye } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'react-hot-toast';
import { generateFilledPdf, PdfGenerationData } from '../lib/pdfGenerator';
import { getTemplatePdfSource } from '../lib/templateStorage';
import PdfPreviewModal from '../components/PdfPreviewModal';

export default function Dashboard() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [operators, setOperators] = useState<Record<string, any>>({});
  const [templatesDict, setTemplatesDict] = useState<Record<string, any>>({});
  const [stats, setStats] = useState({ totalRequests: 0, totalPatients: 0, totalTemplates: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [pSnap, oSnap, rSnap, tSnap] = await Promise.all([
      getDocs(query(collection(db, 'patients'), where('doctorId', '==', user.uid))),
      getDocs(query(collection(db, 'operators'), where('doctorId', '==', user.uid))),
      getDocs(query(collection(db, 'requests'), where('doctorId', '==', user.uid))),
      getDocs(query(collection(db, 'templates'), where('doctorId', '==', user.uid)))
    ]);
    
    const pDict: any = {};
    pSnap.docs.forEach(d => pDict[d.id] = d.data());
    setPatients(pDict);
    
    const oDict: any = {};
    oSnap.docs.forEach(d => oDict[d.id] = d.data());
    setOperators(oDict);

    const tDict: any = {};
    tSnap.docs.forEach(d => tDict[d.id] = { id: d.id, ...d.data() });
    setTemplatesDict(tDict);
    
    const reqs = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    setStats({
      totalRequests: reqs.length,
      totalPatients: pSnap.size,
      totalTemplates: tSnap.size
    });
    
    // Calculate chart data (Requests by Operator)
    const opCounts = reqs.reduce((acc: any, req: any) => {
      acc[req.operatorId] = (acc[req.operatorId] || 0) + 1;
      return acc;
    }, {});
    
    const chart = Object.keys(opCounts).map(opId => ({
      name: oDict[opId]?.name || 'Outros',
      total: opCounts[opId]
    })).sort((a, b) => b.total - a.total).slice(0, 5); // top 5
    
    setChartData(chart);
    
    const sortedReqs = [...reqs]
      .sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
    setRequests(sortedReqs);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const filteredRequests = useMemo(() => {
    if (!searchTerm.trim()) return requests;
    const term = searchTerm.toLowerCase();
    return requests.filter(req => {
      const patientName = (patients[req.patientId]?.name || req.patientName || '').toLowerCase();
      const operatorName = (operators[req.operatorId]?.name || req.operatorName || '').toLowerCase();
      const indication = (req.clinicalData?.indication || '').toLowerCase();
      const cid = (req.clinicalData?.cid || '').toLowerCase();
      const procs = (req.procedures || []).map((p: any) => `${p.code} ${p.description}`).join(' ').toLowerCase();
      return patientName.includes(term) || operatorName.includes(term) || indication.includes(term) || cid.includes(term) || procs.includes(term);
    });
  }, [requests, searchTerm, patients, operators]);

  const handleDuplicate = (req: any) => {
    navigate('/nova-solicitacao', { state: { duplicateRequest: req } });
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta solicitação do histórico?")) return;
    try {
      await deleteDoc(doc(db, 'requests', id));
      toast.success("Solicitação excluída.");
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao excluir solicitação.");
    }
  };

  const handleOpenPdf = async (req: any) => {
    const template = templatesDict[req.templateId];
    if (!template) {
      toast.error("Template original associado a esta solicitação não foi encontrado.");
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const source = await getTemplatePdfSource(template);
      if (!source) {
        toast.error("Arquivo do template não encontrado.");
        return;
      }

      const patient = patients[req.patientId] || {};
      const payload: PdfGenerationData = {
        patient: {
          name: patient.name || req.patientName || '',
          cpf: patient.cpf || '',
          birthDate: patient.birthDate || '',
          gender: patient.gender || '',
          healthPlanName: patient.healthPlanName || '',
          healthPlanNumber: patient.healthPlanNumber || '',
          healthPlanValidity: patient.healthPlanValidity || '',
          phone: patient.phone || '',
          email: patient.email || ''
        },
        doctor: {
          name: profile?.name || '',
          crm: profile?.crm || '',
          specialty: profile?.specialty || '',
          signature: profile?.signature || ''
        },
        clinicalData: {
          indication: req.clinicalData?.indication || '',
          cid: req.clinicalData?.cid || '',
          justification: req.clinicalData?.justification || '',
          date: req.clinicalData?.date || ''
        },
        procedures: (req.procedures || []).map((p: any, idx: number) => ({
          code: p.code,
          description: p.description,
          quantity: p.quantity,
          isPrincipal: p.isPrincipal || idx === 0
        })),
        opme: req.opme || [],
        hospitalization: req.hospitalization
      };

      const { pdfBytes } = await generateFilledPdf(
        source,
        template.fields || [],
        payload,
        template.continuationConfig
      );
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Painel de Solicitações</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Visão geral do fluxo de solicitações médicas e formulários preenchidos</p>
        </div>
        <Link to="/nova-solicitacao">
          <Button className="h-[38px] text-[13px] font-semibold">
            <Plus className="mr-1.5 h-4 w-4" /> Nova Solicitação
          </Button>
        </Link>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-[#E2E8F0]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-[#EFF6FF] text-[#1E5FA6] rounded-[8px] border border-[#BFDBFE]/60">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-[#64748B]">Total de Solicitações</p>
                <h3 className="text-[24px] font-bold text-[#0F172A] leading-tight mt-0.5">{stats.totalRequests}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E2E8F0]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-[#DCFCE7] text-[#15803D] rounded-[8px] border border-[#BBF7D0]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-[#64748B]">Pacientes Cadastrados</p>
                <h3 className="text-[24px] font-bold text-[#0F172A] leading-tight mt-0.5">{stats.totalPatients}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E2E8F0]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-[#F1F5F9] text-[#475569] rounded-[8px] border border-[#E2E8F0]">
                <LayoutTemplate className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-[#64748B]">Templates Ativos</p>
                <h3 className="text-[24px] font-bold text-[#0F172A] leading-tight mt-0.5">{stats.totalTemplates}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
        title="Visualização da Solicitação"
        subtitle="Documento gerado de acordo com o template oficial da operadora"
        filename="Solicitacao_Medica.pdf"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[#0F172A]">Histórico de Solicitações ({filteredRequests.length})</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
              <Input 
                placeholder="Buscar paciente, operadora ou CID..." 
                className="pl-8 h-[34px] text-[12px] bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Card className="border-[#E2E8F0]">
            <div className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between items-center py-2">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredRequests.length === 0 ? (
                <EmptyState 
                  icon={<FileText className="h-8 w-8" />}
                  title={searchTerm ? "Nenhuma solicitação encontrada" : "Nenhuma solicitação"}
                  description={searchTerm ? "Tente buscar com outros termos." : "Comece criando uma nova solicitação para um de seus pacientes."}
                  action={
                    !searchTerm ? (
                      <Link to="/nova-solicitacao">
                        <Button className="h-[38px] text-[13px]">Criar primeira solicitação</Button>
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                filteredRequests.map(req => {
                  const date = req.createdAt?.toDate ? req.createdAt.toDate() : new Date();
                  const pName = patients[req.patientId]?.name || req.patientName || 'Paciente sem nome';
                  const opName = operators[req.operatorId]?.name || req.operatorName || '-';

                  return (
                    <div key={req.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-[#F8FAFC] gap-4 transition-colors">
                      <div className="space-y-1 flex-1 pr-4 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-[13px] text-[#0F172A] flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-[#1E5FA6]" />
                            {pName}
                          </h4>
                          <span className="inline-flex items-center rounded-[4px] bg-[#EFF6FF] border border-[#BFDBFE]/60 px-2 py-0.5 text-[11px] font-semibold text-[#1E5FA6]">
                            {opName}
                          </span>
                          <span className="inline-flex items-center rounded-[4px] bg-[#DCFCE7] border border-[#BBF7D0] px-1.5 py-0.5 text-[10px] font-semibold text-[#15803D]">
                            {req.status || 'Gerado'}
                          </span>
                        </div>

                        <p className="text-[12px] text-[#64748B] truncate">
                          {req.clinicalData?.indication ? req.clinicalData.indication : 'Sem indicação clínica'}
                          {req.clinicalData?.cid ? ` • CID: ${req.clinicalData.cid}` : ''}
                        </p>

                        {/* Procedures summary */}
                        {req.procedures && req.procedures.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {req.procedures.slice(0, 3).map((p: any, idx: number) => (
                              <span key={idx} className="text-[10px] font-mono bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] px-1.5 py-0.5 rounded-[4px]">
                                {p.code} ({p.quantity || 1}x)
                              </span>
                            ))}
                            {req.procedures.length > 3 && (
                              <span className="text-[10px] text-[#94A3B8] self-center">
                                +{req.procedures.length - 3} mais
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 justify-between md:justify-end text-xs shrink-0">
                        <span className="flex items-center text-[#94A3B8] text-[11px]">
                          <Calendar className="mr-1 h-3.5 w-3.5" />
                          {format(date, "dd/MM/yyyy", { locale: ptBR })}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[11px] px-2 text-[#1E5FA6] border-[#BFDBFE] hover:bg-[#EFF6FF]"
                            onClick={() => handleOpenPdf(req)}
                            disabled={isGeneratingPdf}
                            title="Visualizar PDF gerado"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> PDF
                          </Button>

                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[11px] px-2 text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]"
                            onClick={() => handleDuplicate(req)}
                            title="Duplicar como nova solicitação"
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
                          </Button>

                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2]/60"
                            onClick={() => handleDeleteRequest(req.id)}
                            title="Excluir solicitação"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-3.5">
          <h2 className="text-[15px] font-semibold text-[#0F172A]">Volume por Operadora</h2>
          <Card className="border-[#E2E8F0]">
            <CardContent className="p-5">
              {chartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(15,23,42,0.06)', fontSize: '12px' }} />
                      <Bar dataKey="total" fill="#1E5FA6" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#1E5FA6', '#0284C7', '#0D9488', '#6366F1', '#8B5CF6'][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Activity className="h-8 w-8 text-[#CBD5E1] mb-2" />
                  <p className="text-[12px] text-[#64748B]">Sem dados suficientes<br/>para exibir gráficos.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
