import Link from "next/link";
import { SignOutButton } from "@/components/signout-button";
import type { Usuario } from "@/lib/types";
import { ROLES } from "@/lib/constants";

type AppShellProps = {
  profile: Usuario;
  children: React.ReactNode;
};

export function AppShell({ profile, children }: AppShellProps) {
  const baseLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/inventario", label: "Inventario" },
    { href: "/facturas", label: "Facturas" },
    { href: "/historial", label: "Historial" },
  ];

  const links =
    profile.rol === ROLES.ADMIN
      ? [...baseLinks, { href: "/imprimir", label: "Imprimir" }]
      : baseLinks;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Zentory</p>
            <p className="text-xs text-slate-600">
              {profile.nombre} · {profile.rol}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <nav className="hidden gap-2 md:flex">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
