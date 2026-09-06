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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row text-[#0F172A] font-sans antialiased">
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'text-[13px] text-[#0F172A] bg-white border border-[#E2E8F0] shadow-md rounded-[8px]',
          duration: 3500,
        }}
      />

      {/* MOBILE TOP BAR */}
      <header className="md:hidden flex items-center justify-between px-4 py-2 bg-white border-b border-[#E2E8F0] sticky top-0 z-40">
        <Link to="/" className="flex items-center">
          <img src="/brand/lizacare-logo.webp" alt="Logo" className="h-12 w-auto object-contain" />
        </Link>
        <button
          type="button"
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-[6px] text-[#475569] hover:bg-[#F1F5F9] focus:outline-none"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* MOBILE BACKDROP */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={cn(
          "w-[240px] bg-white border-r border-[#E2E8F0] flex-shrink-0 flex flex-col py-6 px-4 z-50 transition-transform duration-200",
          "fixed inset-y-0 left-0 md:static md:translate-x-0",
          mobileMenuOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* LOGO */}
        <div className="mb-6 flex items-center justify-center">
          <Link to="/" className="flex items-center justify-center">
            <img
              src="/brand/lizacare-logo.webp"
              alt="Logo"
              className="h-32 w-32 object-contain"
            />
          </Link>
        </div>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 h-[36px] text-[13px] rounded-[6px] transition-colors select-none',
                  isActive
                    ? 'bg-[#EFF6FF] text-[#1E5FA6] font-semibold'
                    : 'text-[#475569] font-normal hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                )}
              >
                <item.icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-[#1E5FA6]' : 'text-[#94A3B8]'
                  )}
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* RODAPÉ DA SIDEBAR */}
        <div className="pt-4 mt-auto border-t border-[#E2E8F0]/60">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2.5 px-3 h-[34px] w-full text-[13px] text-[#475569] hover:text-[#DC2626] hover:bg-[#FEE2E2]/30 rounded-[6px] transition-colors"
          >
            <LogOut className="w-4 h-4 text-[#94A3B8]" />
            <span>Sair do sistema</span>
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8 overflow-y-auto">
        <div className="max-w-[1140px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
