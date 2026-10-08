"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  Store,
  BarChart3,
  ShieldCheck,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SignOutButton } from "@/components/signout-button";
import type { Usuario } from "@/lib/types";
import { PERMISOS } from "@/lib/constants";
import { hasPermission, isAdmin } from "@/lib/permissions";
import { sincronizarIp } from "@/app/actions/auditoria";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: React.ElementType };

type AppShellProps = {
  profile: Usuario;
  children: React.ReactNode;
};

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lift-sm",
        className ?? "h-10 w-10",
      )}
    >
      <Store className="h-5 w-5" />
    </span>
  );
}

function NavItem({
  link,
  active,
  collapsed,
  onClick,
}: {
  link: NavLink;
  active: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const Icon = link.icon;

  const content = (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      title={collapsed ? link.label : undefined}
      className={cn(
        "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        collapsed ? "h-11 w-11 justify-center" : "gap-3 px-3 py-2.5",
        active
          ? "bg-accent text-accent-foreground shadow-soft"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
        />
      ) : null}
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      {!collapsed && <span className="truncate">{link.label}</span>}
    </Link>
  );

  if (!collapsed) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{link.label}</TooltipContent>
    </Tooltip>
  );
}

function NavList({
  links,
  pathname,
  collapsed,
  onNavigate,
}: {
  links: NavLink[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex list-none flex-col gap-1">
      {links.map((link) => (
        <li key={link.href}>
          <NavItem
            link={link}
            active={
              pathname === link.href || pathname.startsWith(`${link.href}/`)
            }
            collapsed={collapsed}
            onClick={onNavigate}
          />
        </li>
      ))}
    </ul>
  );
}

export function AppShell({ profile, children }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Guarda la IP de la sesión una sola vez: los triggers de auditoría
  // la usan para cada evento de tablas que ocurra después.
  useEffect(() => {
    void sincronizarIp();
  }, []);

  const vendedorLinks: NavLink[] = [
    { href: "/facturas", label: "Facturas", icon: FileText },
    { href: "/historial", label: "Historial", icon: History },
    { href: "/inventario", label: "Inventario", icon: Package },
  ];

  const links: NavLink[] = isAdmin(profile)
    ? [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/inventario", label: "Inventario", icon: Package },
        { href: "/facturas", label: "Facturas", icon: FileText },
        { href: "/compras", label: "Compras", icon: Receipt },
        { href: "/reportes", label: "Reportes", icon: BarChart3 },
        { href: "/historial", label: "Historial", icon: History },
        { href: "/imprimir", label: "Imprimir", icon: Printer },
        { href: "/admin/negocio", label: "Negocio", icon: Settings },
        { href: "/admin/usuarios", label: "Usuarios", icon: Users },
      ]
    : vendedorLinks;

  if (hasPermission(profile, PERMISOS.AUDITORIA_VER)) {
    links.push({ href: "/auditoria", label: "Auditoría", icon: ShieldCheck });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lift"
        >
          Saltar al contenido
        </a>

        <header className="sticky top-0 z-30 border-b border-border bg-card/90 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/75 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={isAdmin(profile) ? "/dashboard" : "/facturas"}
              className="flex min-w-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <BrandMark className="h-9 w-9" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight">
                  Zentory
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {profile.nombre}
                </span>
              </span>
            </Link>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menú">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-[86%] max-w-xs flex-col gap-0 border-r p-0 shadow-lift [&>button.absolute]:hidden"
              >
                <SheetHeader className="border-b border-border p-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <BrandMark className="h-9 w-9" />
                      <div className="min-w-0">
                        <SheetTitle className="truncate text-base">
                          Zentory
                        </SheetTitle>
                        <SheetDescription className="truncate text-xs">
                          {profile.nombre} · {profile.rol}
                        </SheetDescription>
                      </div>
                    </div>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Cerrar menú"
                        className="shrink-0"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </SheetClose>
                  </div>
                </SheetHeader>

                <nav
                  aria-label="Navegación principal"
                  className="custom-scrollbar flex-1 overflow-y-auto p-3"
                >
                  <NavList
                    links={links}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </nav>

                <div className="border-t border-border p-3">
                  <SignOutButton />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1400px] gap-4 px-3 py-4 sm:px-4 lg:gap-6 lg:px-6 lg:py-6">
          <aside
            aria-label="Navegación lateral"
            className={cn(
              "sticky top-6 hidden h-[calc(100vh-3rem)] shrink-0 flex-col rounded-2xl border border-border bg-card p-3 shadow-soft transition-all duration-300 lg:flex",
              collapsed ? "w-[76px]" : "w-64",
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-2 px-1">
              {collapsed ? (
                <BrandMark className="mx-auto h-10 w-10" />
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                    <BrandMark />
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold leading-tight">
                        Zentory
                      </p>
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {profile.nombre}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(true)}
                    aria-label="Contraer menú"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {collapsed ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(false)}
                aria-label="Expandir menú"
                className="mx-auto mb-3 h-9 w-9"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : null}

            <nav aria-label="Navegación principal" className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              <NavList links={links} pathname={pathname} collapsed={collapsed} />
            </nav>

            <div className="mt-3 border-t border-border pt-3">
              <SignOutButton collapsed={collapsed} />
            </div>
          </aside>

          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
