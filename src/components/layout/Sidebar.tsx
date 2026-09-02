"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Building2,
  FileText,
  Home,
  List,
  PlusCircle,
  Settings,
  Stethoscope,
  Users,
} from "lucide-react";
import type { SessionUser } from "@/types/domain";
import { logoutAction } from "@/app/actions";
import { cn } from "@/components/ui";

const operational = [
  { href: "/", label: "Início", icon: Home },
  { href: "/guias/nova", label: "Nova guia", icon: PlusCircle },
  { href: "/guias", label: "Guias", icon: FileText },
  { href: "/pacientes", label: "Pacientes", icon: Users },
];

const admin = [
  { href: "/procedimentos", label: "Procedimentos", icon: List },
  { href: "/kits", label: "Kits cirúrgicos", icon: Archive },
  { href: "/templates", label: "Templates PDF", icon: FileText },
  { href: "/tabelas", label: "Tabelas TUSS/IPASGO", icon: List },
  { href: "/instituicoes", label: "Instituições", icon: Building2 },
  { href: "/medicos", label: "Médicos", icon: Stethoscope },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col justify-between border-r border-[#e2e8f0] bg-white px-4 py-6">
      <div className="flex flex-col gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-[26px] items-center justify-center rounded-md bg-[#1e5fa6] text-[12px] font-bold text-white">
            +
          </span>
          <span className="text-[18px] font-bold text-[#0f172a]">GuiaMed</span>
        </Link>
        <nav className="flex flex-col gap-4">
          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold tracking-wide text-[#94a3b8]">OPERACIONAL</p>
            {operational.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(pathname, item.href)} />
            ))}
          </div>
          {user.role === "admin" ? (
            <div>
              <p className="mb-1 px-3 text-[10px] font-semibold tracking-wide text-[#94a3b8]">ADMINISTRAÇÃO</p>
              {admin.map((item) => (
                <NavItem key={item.href} {...item} active={isActive(pathname, item.href)} />
              ))}
            </div>
          ) : null}
        </nav>
      </div>
      <div className="flex items-center gap-3 border-t border-[#e2e8f0] pt-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-[#cbd5e1] text-[12px] font-bold text-[#0f172a]">
          {initials(user.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-[#0f172a]">{user.fullName}</p>
          <p className="truncate text-[10px] text-[#475569]">{user.role === "admin" ? "Administrador" : "Médico"}</p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-[11px] font-semibold text-[#1e5fa6]">
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-[13px]",
        active ? "bg-[#eff6ff] font-semibold text-[#1e5fa6]" : "font-medium text-[#475569] hover:bg-[#f8fafc]",
      )}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/guias/nova") return pathname === "/guias/nova";
  if (href === "/guias") return pathname === "/guias" || /^\/guias\/[^/]+/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}
