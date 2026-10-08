"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { registrarEventoAuditoria } from "@/app/actions/auditoria";
import { AUDITORIA_ENTIDADES, AUDITORIA_MODULOS } from "@/lib/constants";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);

    // Se registra ANTES de cerrar sesión: después ya no habría usuario.
    await registrarEventoAuditoria({
      action: "LOGOUT",
      module: AUDITORIA_MODULOS.USUARIOS,
      entityType: AUDITORIA_ENTIDADES.USUARIO,
      description: "Cierre de sesión",
    });

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      title={collapsed ? "Cerrar sesión" : undefined}
      aria-label={collapsed ? "Cerrar sesión" : undefined}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "group w-full text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-60",
        collapsed ? "h-11 w-11 justify-center px-0" : "justify-start gap-3 px-3 py-2.5",
      )}
    >
      <LogOut
        className={cn(
          "shrink-0 transition-transform",
          collapsed ? "h-5 w-5" : "h-[18px] w-[18px] group-hover:-translate-x-0.5",
        )}
      />
      {!collapsed && <span className="truncate text-sm font-medium">Cerrar sesión</span>}
    </button>
  );
}
