"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      title={collapsed ? "Cerrar sesión" : undefined}
      className={`group flex w-full items-center rounded-xl transition-all ${
        collapsed ? "justify-center h-12 w-12 mx-auto" : "gap-3 px-3 py-2.5"
      } text-red-600 hover:bg-red-50`}
    >
      <LogOut className={`shrink-0 ${collapsed ? "h-6 w-6" : "h-5 w-5"}`} />
      {!collapsed && <span className="text-sm font-medium">Cerrar sesión</span>}
    </button>
  );
}
