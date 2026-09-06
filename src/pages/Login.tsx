import React, { useEffect, useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuthStore } from '../stores/authStore';

const LOGO_SRC = '/brand/lizacare-logo-fixed.webp';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const user = useAuthStore(state => state.user);
  const authLoading = useAuthStore(state => state.loading);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // Navigation is driven by authStore after Firebase confirms the session.
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar com Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      // Do not navigate here. Waiting for the auth observer avoids a race
      // where ProtectedRoute can still see user=null and redirect back to login.
    } catch (err: any) {
      setError(err.message || 'Erro de autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-6 sm:p-8 rounded-[12px] shadow-2xs border border-[#E2E8F0]">
        <div className="text-center">
          <img src={LOGO_SRC} alt="LizaCare" className="w-full max-w-[300px] h-auto mx-auto object-contain" />
          <h2 className="mt-5 text-[18px] font-bold text-[#0F172A]">
            {isLogin ? 'Acesse sua conta médica' : 'Crie seu cadastro de médico'}
          </h2>
          <p className="mt-1 text-[13px] text-[#64748B]">
            {isLogin ? 'Plataforma de emissão e gestão de guias cirúrgicas' : 'Preenchimento automatizado de guias TISS/SADT'}
          </p>
        </div>

        {error && (
          <div className="text-[#DC2626] text-[12px] text-center bg-[#FEF2F2] p-2.5 rounded-[6px] border border-[#FEE2E2]">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-[40px] flex items-center justify-center gap-2 border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#334155] text-[13px] font-medium"
            onClick={handleGoogleLogin}
            disabled={loading || authLoading}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 0 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Entrar com Google
          </Button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#E2E8F0]"></div>
            <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-[#94A3B8]">ou com e-mail</span>
            <div className="flex-grow border-t border-[#E2E8F0]"></div>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[12px] font-semibold text-[#475569]">E-mail de Acesso</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="seu.email@medicina.com.br"
                className="h-[40px] text-[13px]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12px] font-semibold text-[#475569]">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                className="h-[40px] text-[13px]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-1">
            <Button type="submit" className="w-full h-[40px] text-[13px] font-semibold" disabled={loading || authLoading}>
              {loading ? 'Aguarde...' : isLogin ? 'Entrar no Sistema' : 'Criar Minha Conta'}
            </Button>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              className="text-[12px] font-medium text-[#1E5FA6] hover:underline"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Não tem uma conta médica? Cadastre-se' : 'Já possui cadastro? Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
