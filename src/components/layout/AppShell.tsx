import type { ReactNode } from "react";
import type { SessionUser } from "@/types/domain";
import { Sidebar } from "@/components/layout/Sidebar";
import { Icon } from "@/components/icons";

export function AppShell({
  user,
  title,
  children,
  actions,
}: {
  user: SessionUser;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-screen bg-[#f8fafc]">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] items-center justify-between border-b border-[#e2e8f0] bg-white px-8">
          <h1 className="text-[20px] font-semibold text-[#0f172a]">{title}</h1>
          <div className="flex items-center gap-4">
            <form action="/guias" className="flex w-[280px] items-center gap-2 rounded-lg bg-[#f1f5f9] px-3 py-2">
              <Icon name="search" size={14} />
              <input
                className="w-full bg-transparent text-[12px] outline-none placeholder:text-[#94a3b8]"
                placeholder="Buscar pacientes ou guias..."
                name="q"
              />
            </form>
            <button type="button" className="rounded-lg border border-[#e2e8f0] bg-white p-2" aria-label="Notificações">
              <Icon name="bell" size={16} />
            </button>
            {actions}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
