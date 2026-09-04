import type { ReactNode } from "react";
import type { SessionUser } from "@/types/domain";
import { MobileSidebar, Sidebar } from "@/components/layout/Sidebar";
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
      <div className="hidden h-screen lg:block">
        <Sidebar user={user} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <MobileSidebar user={user} />
            <h1 className="truncate text-[18px] font-semibold text-[#0f172a] sm:text-[20px]">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <form action="/guias" className="hidden w-[280px] items-center gap-2 rounded-lg bg-[#f1f5f9] px-3 py-2 xl:flex">
              <Icon name="search" size={14} />
              <input
                className="w-full bg-transparent text-[12px] outline-none placeholder:text-[#475569]"
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
        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
