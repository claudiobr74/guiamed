import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import { Database, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const { profile, updateProfile } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '', crm: '', uf: '', cpf: '', specialty: '', cbo: '', phone: '', email: '', rqe: '', cnes: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        crm: profile.crm || '',
        uf: profile.uf || '',
        cpf: profile.cpf || '',
        specialty: profile.specialty || '',
        cbo: profile.cbo || '',
        phone: profile.phone || '',
        email: profile.email || '',
        rqe: profile.rqe || '',
        cnes: profile.cnes || ''
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateProfile(formData);
    setSaving(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Configurações do Sistema</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Dados cadastrais do médico assistente, tabelas e parâmetros clínicos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/configuracoes/cid10">
            <Button variant="outline" size="sm" className="h-[34px] text-[12px] font-semibold border-[#BFDBFE] text-[#1E5FA6] hover:bg-[#EFF6FF]">
              <Database className="w-3.5 h-3.5 mr-1.5 text-[#1E5FA6]" />
              Base CID-10
            </Button>
          </Link>
          <Link to="/configuracoes/operadoras">
            <Button variant="outline" size="sm" className="h-[34px] text-[12px] font-medium border-[#CBD5E1] text-[#334155]">
              Operadoras
            </Button>
          </Link>
          <Link to="/configuracoes/tabelas">
            <Button variant="outline" size="sm" className="h-[34px] text-[12px] font-medium border-[#CBD5E1] text-[#334155]">
              Gerenciar Tabelas
            </Button>
          </Link>
        </div>
      </div>

      {/* SEÇÃO BASES DE DADOS */}
      <Card id="settings-databases-card" className="border-[#E2E8F0]">
        <CardHeader className="py-3.5 px-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <CardTitle className="text-[13px] font-bold text-[#0F172A] uppercase tracking-wide flex items-center gap-2">
            <Database className="w-4 h-4 text-[#1E5FA6]" />
            Bases Clínicas Integradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-[14px] font-bold text-[#0F172A]">CID-10 Oficial Brasil</h4>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0] px-2 py-0.5 rounded-[4px]">
                  <CheckCircle2 className="w-3 h-3 text-[#15803D]" />
                  Ativa (12.451 registros)
                </span>
              </div>
              <p className="text-[12px] text-[#64748B]">
                Fonte oficial DATASUS (Ministério da Saúde) • Subcategorias completas • Pesquisa com ranking de relevância
              </p>
            </div>
            <Link to="/configuracoes/cid10">
              <Button variant="outline" size="sm" className="h-[32px] text-[12px] font-medium border-[#CBD5E1] flex items-center gap-1.5 whitespace-nowrap">
                Gerenciar Base CID-10
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#E2E8F0]">
        <CardHeader className="py-4 px-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <CardTitle className="text-[14px] font-bold text-[#0F172A]">Dados do Médico Assistente</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[12px] font-semibold text-[#475569]">Nome Completo *</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required className="h-[38px] text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpf" className="text-[12px] font-semibold text-[#475569]">CPF</Label>
                <Input id="cpf" name="cpf" value={formData.cpf} onChange={handleChange} className="h-[38px] text-[13px]" />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="crm" className="text-[12px] font-semibold text-[#475569]">CRM *</Label>
                <Input id="crm" name="crm" value={formData.crm} onChange={handleChange} required className="h-[38px] text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uf" className="text-[12px] font-semibold text-[#475569]">UF do CRM *</Label>
                <Input id="uf" name="uf" value={formData.uf} onChange={handleChange} required className="h-[38px] text-[13px]" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="specialty" className="text-[12px] font-semibold text-[#475569]">Especialidade *</Label>
                <Input id="specialty" name="specialty" value={formData.specialty} onChange={handleChange} required className="h-[38px] text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rqe" className="text-[12px] font-semibold text-[#475569]">RQE (Registro de Especialista)</Label>
                <Input id="rqe" name="rqe" value={formData.rqe} onChange={handleChange} className="h-[38px] text-[13px]" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cbo" className="text-[12px] font-semibold text-[#475569]">CBO</Label>
                <Input id="cbo" name="cbo" value={formData.cbo} onChange={handleChange} className="h-[38px] text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cnes" className="text-[12px] font-semibold text-[#475569]">CNES (Estabelecimento Vinculado)</Label>
                <Input id="cnes" name="cnes" value={formData.cnes} onChange={handleChange} className="h-[38px] text-[13px]" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[12px] font-semibold text-[#475569]">E-mail de Contato *</Label>
                <Input id="email" name="email" value={formData.email} onChange={handleChange} required className="h-[38px] text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[12px] font-semibold text-[#475569]">Telefone / WhatsApp</Label>
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} className="h-[38px] text-[13px]" />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={saving} className="h-[38px] text-[13px] font-semibold px-6">
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
