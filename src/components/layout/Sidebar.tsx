"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/types/domain";
import { logoutAction } from "@/app/actions";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { cn } from "@/components/ui";

const operational: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/guias/nova", label: "Nova guia", icon: "plus-circle" },
  { href: "/guias", label: "Guias", icon: "file-text" },
  { href: "/pacientes", label: "Pacientes", icon: "users" },
];

const admin: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/procedimentos", label: "Procedimentos", icon: "list" },
  { href: "/kits", label: "Kits cirúrgicos", icon: "archive" },
  { href: "/templates", label: "Templates PDF", icon: "file-pdf" },
  { href: "/tabelas", label: "Tabelas TUSS/IPASGO", icon: "list" },
  { href: "/instituicoes", label: "Instituições", icon: "building" },
  { href: "/medicos", label: "Médicos", icon: "stethoscope" },
  { href: "/configuracoes", label: "Configurações", icon: "settings" },
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
        <Logo href="/" size="sm" />
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
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: IconName;
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
      <Icon name={icon} size={16} />
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
