import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { FileText, Users, FilePlus, Settings, LayoutTemplate, LogOut, Menu, X } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { cn } from '../lib/utils';
import { useAuthStore } from '../stores/authStore';

export default function AppLayout() {
  const location = useLocation();
  const signOut = useAuthStore(state => state.signOut);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Nova solicitação', href: '/nova-solicitacao', icon: FilePlus },
    { name: 'Solicitações recentes', href: '/', icon: FileText },
    { name: 'Pacientes', href: '/pacientes', icon: Users },
    { name: 'Templates', href: '/templates', icon: LayoutTemplate },
    { name: 'Configurações', href: '/configuracoes', icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-[#F8FAFC] flex flex-col md:flex-row text-[#0F172A] font-sans antialiased">
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-[13px] text-[#0F172A] bg-white border border-[#E2E8F0] shadow-md rounded-[8px]',
          duration: 3500,
        }}
      />

      {/* MOBILE TOP BAR */}
      <header className="md:hidden h-16 flex items-center justify-between px-3 sm:px-4 bg-white/95 backdrop-blur border-b border-[#E2E8F0] sticky top-0 z-40 safe-top">
        <Link to="/" className="flex items-center min-w-0" onClick={() => setMobileMenuOpen(false)}>
          <img src="/brand/lizacare-logo.webp" alt="LizaCare" className="h-10 w-auto max-w-[150px] object-contain" />
        </Link>
        <button
          type="button"
          aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="h-11 w-11 inline-flex items-center justify-center rounded-[10px] text-[#475569] hover:bg-[#F1F5F9] active:bg-[#E2E8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5FA6]/20"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* MOBILE BACKDROP */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-[#0F172A]/30 backdrop-blur-[1px] z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={cn(
          'w-[280px] max-w-[86vw] md:w-[248px] md:max-w-none bg-white border-r border-[#E2E8F0] flex-shrink-0 flex flex-col px-3 md:px-4 z-50 transition-transform duration-200 ease-out',
          'fixed inset-y-0 left-0 py-4 md:sticky md:top-0 md:h-screen md:py-6 md:translate-x-0',
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* LOGO */}
        <div className="mb-4 md:mb-6 flex items-center justify-center min-h-16 md:min-h-20">
          <Link to="/" className="flex items-center justify-center" onClick={() => setMobileMenuOpen(false)}>
            <img
              src="/brand/lizacare-logo.webp"
              alt="LizaCare"
              className="h-20 md:h-24 w-auto max-w-[190px] object-contain"
            />
          </Link>
        </div>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <nav className="space-y-1" aria-label="Navegação principal">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 h-11 md:h-10 text-[13px] rounded-[8px] transition-colors select-none',
                  isActive
                    ? 'bg-[#EFF6FF] text-[#1E5FA6] font-semibold'
                    : 'text-[#475569] font-normal hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                )}
              >
                <item.icon
                  className={cn(
                    'w-[18px] h-[18px] shrink-0 transition-colors',
                    isActive ? 'text-[#1E5FA6]' : 'text-[#94A3B8]'
                  )}
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* RODAPÉ DA SIDEBAR */}
        <div className="pt-4 mt-auto border-t border-[#E2E8F0]/60 safe-bottom">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2.5 px-3 h-11 md:h-10 w-full text-[13px] text-[#475569] hover:text-[#DC2626] hover:bg-[#FEE2E2]/30 rounded-[8px] transition-colors"
          >
            <LogOut className="w-[18px] h-[18px] text-[#94A3B8]" />
            <span>Sair do sistema</span>
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="app-content flex-1 min-w-0 w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8 overflow-x-hidden">
        <div className="w-full min-w-0 max-w-[1320px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
