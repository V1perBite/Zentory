"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  FileText,
  History,
  Printer,
  Settings,
  Users,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Store
} from "lucide-react";
import { SignOutButton } from "@/components/signout-button";
import type { Usuario } from "@/lib/types";
import { ROLES } from "@/lib/constants";

type AppShellProps = {
  profile: Usuario;
  children: React.ReactNode;
};

export function AppShell({ profile, children }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const baseLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/inventario", label: "Inventario", icon: Package },
    { href: "/facturas", label: "Facturas", icon: FileText },
    { href: "/historial", label: "Historial", icon: History },
  ];

  const links =
    profile.rol === ROLES.ADMIN
      ? [
          ...baseLinks,
          { href: "/imprimir", label: "Imprimir", icon: Printer },
          { href: "/admin/negocio", label: "Negocio", icon: Settings },
          { href: "/admin/usuarios", label: "Usuarios", icon: Users },
        ]
      : baseLinks;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="lg:hidden sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900 leading-tight">Zentory</p>
            <p className="text-xs font-medium text-slate-500">
              {profile.nombre}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 active:bg-slate-100"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-30 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-[80%] max-w-sm flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900">Zentory</p>
                  <p className="text-xs font-medium text-slate-500">{profile.rol}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setMobileOpen(false)} 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-2 overflow-y-auto p-4">
              {links.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-colors ${
                      active 
                        ? "bg-indigo-50 text-indigo-700" 
                        : "text-slate-600 active:bg-slate-100"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-indigo-600" : "text-slate-400"}`} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-100 p-4">
              <SignOutButton />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1400px] gap-4 px-2 py-4 lg:px-6 lg:py-6">
        <aside className={`hidden lg:flex lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:flex-col lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-4 lg:shadow-sm transition-all duration-300 ${collapsed ? "lg:w-24" : "lg:w-64"}`}>
          <div className="mb-6 flex items-center justify-between">
            {!collapsed ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">Zentory</p>
                  <p className="truncate text-xs font-medium text-slate-500">
                    {profile.nombre}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <Store className="h-5 w-5" />
              </div>
            )}
            
            {!collapsed && (
              <button 
                type="button" 
                onClick={() => setCollapsed(true)} 
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
          </div>

          <nav className="space-y-1.5 flex-1">
            {collapsed && (
              <button 
                type="button" 
                onClick={() => setCollapsed(false)} 
                className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                title="Expandir menú"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={collapsed ? link.label : undefined}
                  className={`group flex items-center rounded-xl transition-all ${
                    collapsed ? "justify-center h-12 w-12 mx-auto" : "gap-3 px-3 py-2.5"
                  } ${
                    active 
                      ? "bg-indigo-50 text-indigo-700" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`shrink-0 ${collapsed ? "h-6 w-6" : "h-5 w-5"} ${
                    active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                  }`} />
                  {!collapsed && <span className="text-sm font-medium">{link.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-100">
            <SignOutButton collapsed={collapsed} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
