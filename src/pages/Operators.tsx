import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface Operator {
  id: string;
  name: string;
}

export default function Operators() {
  const { user } = useAuthStore();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOperator, setCurrentOperator] = useState<Partial<Operator>>({});

  const fetchOperators = async () => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'operators'), where('doctorId', '==', user.uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Operator[];
    setOperators(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchOperators();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (currentOperator.id) {
      await updateDoc(doc(db, 'operators', currentOperator.id), currentOperator);
    } else {
      await addDoc(collection(db, 'operators'), {
        ...currentOperator,
        doctorId: user.uid,
        createdAt: new Date()
      });
    }
    setIsEditing(false);
    setCurrentOperator({});
    fetchOperators();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta operadora?')) {
      await deleteDoc(doc(db, 'operators', id));
      fetchOperators();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <Link to="/configuracoes">
            <Button variant="ghost" size="sm" className="text-[#64748B] hover:text-[#0F172A]">
              ← Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Operadoras de Saúde</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">Gestão de convênios e planos vinculados aos formulários e tabelas</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="border-[#E2E8F0]">
            <CardHeader className="py-4 px-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <CardTitle className="text-[14px] font-bold text-[#0F172A]">
                {currentOperator.id ? 'Editar Operadora' : 'Nova Operadora'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#475569]">Nome da Operadora *</Label>
                  <Input 
                    required 
                    placeholder="Ex: Unimed Goiânia, IPASGO..." 
                    value={currentOperator.name || ''} 
                    onChange={e => setCurrentOperator({...currentOperator, name: e.target.value})} 
                    className="h-[38px] text-[13px]"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 h-[38px] text-[13px] font-semibold">
                    {currentOperator.id ? 'Salvar Alterações' : 'Adicionar Operadora'}
                  </Button>
                  {isEditing && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => { setIsEditing(false); setCurrentOperator({}); }}
                      className="h-[38px] text-[13px] text-[#64748B]"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="border-[#E2E8F0]">
            <CardHeader className="py-4 px-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <CardTitle className="text-[14px] font-bold text-[#0F172A]">Operadoras Cadastradas ({operators.length})</CardTitle>
            </CardHeader>
            <div className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <div className="p-8 text-center text-[13px] text-[#64748B]">Carregando operadoras...</div>
              ) : operators.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-[#64748B]">Nenhuma operadora cadastrada ainda.</div>
              ) : (
                operators.map(op => (
                  <div key={op.id} className="p-4 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-[6px] bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E5FA6] font-bold text-[12px] flex items-center justify-center">
                        {op.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-[13px] text-[#0F172A]">{op.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setCurrentOperator(op); setIsEditing(true); }}
                        className="h-8 w-8 p-0 text-[#64748B] hover:text-[#1E5FA6] hover:bg-[#EFF6FF]"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(op.id)}
                        className="h-8 w-8 p-0 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2]/60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
