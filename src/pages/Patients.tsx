import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Plus, Search, Edit2, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const patientSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  cpf: z.string().min(11, 'CPF inválido').max(14, 'CPF inválido'),
  birthDate: z.string().min(1, 'A data de nascimento é obrigatória'),
  gender: z.string().optional(),
  healthPlanName: z.string().optional(),
  healthPlanNumber: z.string().optional(),
  healthPlanValidity: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
});

type PatientFormData = z.infer<typeof patientSchema>;

export interface Patient extends PatientFormData {
  id: string;
}

export default function Patients() {
  const { user } = useAuthStore();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema)
  });

  const fetchPatients = async () => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'patients'), where('doctorId', '==', user.uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Patient[];
    setPatients(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPatients();
  }, [user]);

  const handleSave = async (data: PatientFormData) => {
    if (!user) return;
    
    try {
      if (editingId) {
        const patientRef = doc(db, 'patients', editingId);
        await updateDoc(patientRef, { ...data });
        toast.success('Paciente atualizado com sucesso');
      } else {
        await addDoc(collection(db, 'patients'), {
          ...data,
          doctorId: user.uid,
          createdAt: new Date()
        });
        toast.success('Paciente cadastrado com sucesso');
      }
      setIsEditing(false);
      setEditingId(null);
      reset();
      fetchPatients();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar paciente');
    }
  };

  const startEditing = (patient?: Patient) => {
    if (patient) {
      setEditingId(patient.id);
      reset(patient);
    } else {
      setEditingId(null);
      reset({
        name: '', cpf: '', birthDate: '', gender: '',
        healthPlanName: '', healthPlanNumber: '', healthPlanValidity: '',
        phone: '', email: ''
      });
    }
    setIsEditing(true);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.cpf && p.cpf.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Pacientes</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Gerenciamento de prontuários rápidos para preenchimento automático</p>
        </div>
        {!isEditing && (
          <Button onClick={() => startEditing()} className="h-[38px] text-[13px] font-semibold">
            <Plus className="mr-1.5 h-4 w-4" /> Novo Paciente
          </Button>
        )}
      </div>

      {isEditing ? (
        <Card className="border-[#E2E8F0]">
          <CardHeader className="py-4 px-6 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <CardTitle className="text-[15px] font-bold text-[#0F172A]">
              {editingId ? 'Editar Dados do Paciente' : 'Cadastrar Novo Paciente'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(handleSave)} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Nome completo *</Label>
                  <Input {...register('name')} className={`h-[38px] text-[13px] ${errors.name ? 'border-red-500' : ''}`} />
                  {errors.name && <p className="text-[11px] text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">CPF *</Label>
                  <Input {...register('cpf')} placeholder="000.000.000-00" className={`h-[38px] text-[13px] ${errors.cpf ? 'border-red-500' : ''}`} />
                  {errors.cpf && <p className="text-[11px] text-red-500">{errors.cpf.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Data de Nascimento *</Label>
                  <Input type="date" {...register('birthDate')} className={`h-[38px] text-[13px] ${errors.birthDate ? 'border-red-500' : ''}`} />
                  {errors.birthDate && <p className="text-[11px] text-red-500">{errors.birthDate.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Sexo</Label>
                  <select 
                    {...register('gender')}
                    className="w-full h-[38px] rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-1 text-[13px] text-[#0F172A] outline-none focus:border-[#1E5FA6]"
                  >
                    <option value="">Selecione...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="O">Outro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Convênio (Nome)</Label>
                  <Input {...register('healthPlanName')} placeholder="Ex: Unimed, Bradesco..." className="h-[38px] text-[13px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Número da Carteira</Label>
                  <Input {...register('healthPlanNumber')} className="h-[38px] text-[13px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Validade da Carteira</Label>
                  <Input type="date" {...register('healthPlanValidity')} className="h-[38px] text-[13px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Telefone / Celular</Label>
                  <Input {...register('phone')} placeholder="(00) 00000-0000" className="h-[38px] text-[13px]" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-[12px] font-semibold text-[#475569]">E-mail</Label>
                  <Input type="email" {...register('email')} placeholder="paciente@exemplo.com" className={`h-[38px] text-[13px] ${errors.email ? 'border-red-500' : ''}`} />
                  {errors.email && <p className="text-[11px] text-red-500">{errors.email.message}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#E2E8F0]">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-[#64748B]">
                  Cancelar
                </Button>
                <Button type="submit" className="h-[38px] px-5 text-[13px] font-semibold">
                  Salvar Paciente
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#E2E8F0]">
          <div className="p-3 border-b border-[#E2E8F0] flex items-center bg-[#F8FAFC]">
            <Search className="h-4 w-4 text-[#94A3B8] ml-2 mr-2.5" />
            <input 
              placeholder="Buscar por nome ou CPF..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
            />
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {loading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex justify-between items-center py-2">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                ))}
              </div>
            ) : filteredPatients.length === 0 ? (
              <EmptyState 
                icon={<Users className="h-8 w-8" />}
                title="Nenhum paciente cadastrado"
                description="Você ainda não tem pacientes salvos. Adicione o seu primeiro paciente para começar a gerar solicitações."
                action={
                  <Button onClick={() => startEditing()} className="h-[38px] text-[13px]">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Adicionar Paciente
                  </Button>
                }
              />
            ) : (
              filteredPatients.map(patient => (
                <div key={patient.id} className="p-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E5FA6] font-bold text-[12px] flex items-center justify-center">
                      {patient.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-[13px] text-[#0F172A]">{patient.name}</h4>
                      <p className="text-[12px] text-[#64748B]">
                        {patient.healthPlanName && (
                          <span className="font-medium text-[#1E5FA6] mr-1.5">{patient.healthPlanName}</span>
                        )}
                        {patient.healthPlanNumber ? `• Carteira: ${patient.healthPlanNumber} ` : ''}
                        {patient.cpf && `• CPF: ${patient.cpf}`}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => startEditing(patient)}
                    className="h-8 w-8 p-0 text-[#64748B] hover:text-[#1E5FA6] hover:bg-[#EFF6FF]"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
