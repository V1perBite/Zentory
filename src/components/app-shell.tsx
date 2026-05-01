"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
    { href: "/dashboard", label: "Dashboard" },
    { href: "/inventario", label: "Inventario" },
    { href: "/facturas", label: "Facturas" },
    { href: "/historial", label: "Historial" },
  ];

  const links =
    profile.rol === ROLES.ADMIN
      ? [
          ...baseLinks,
          { href: "/imprimir", label: "Imprimir" },
          { href: "/admin/negocio", label: "Configuración del negocio" },
          { href: "/admin/usuarios", label: "Usuarios" },
        ]
      : baseLinks;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="lg:hidden sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Zentory</p>
          <p className="text-xs text-slate-600">
            {profile.nombre} · {profile.rol}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          ☰
        </button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-72 space-y-4 border-r border-slate-200 bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold">Zentory</p>
                <p className="text-xs text-slate-600">{profile.nombre}</p>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded border border-slate-300 px-2 py-1 text-xs">✕</button>
            </div>

            <nav className="space-y-1">
              {links.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="pt-2">
              <SignOutButton />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1400px] gap-4 px-3 py-4 lg:px-4 lg:py-6">
        <aside className={`hidden lg:flex lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:flex-col lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:p-3 ${collapsed ? "lg:w-20" : "lg:w-72"}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            {!collapsed ? (
              <div>
                <p className="text-sm font-semibold">Zentory</p>
                <p className="text-xs text-slate-600">
                  {profile.nombre} · {profile.rol}
                </p>
              </div>
            ) : <span className="text-sm font-semibold">Z</span>}
            <button type="button" onClick={() => setCollapsed((v) => !v)} className="rounded border border-slate-300 px-2 py-1 text-xs">
              {collapsed ? "»" : "«"}
            </button>
          </div>

          <nav className="space-y-1">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={collapsed ? link.label : undefined}
                  className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  {collapsed ? link.label.slice(0, 1) : link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-3">
            <SignOutButton />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-1 lg:px-2">{children}</main>
      </div>
    </div>
  );
}
