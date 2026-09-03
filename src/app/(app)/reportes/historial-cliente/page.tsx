import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HistorialClienteClient } from "@/components/reportes/historial-cliente-client";

export default async function HistorialClientePage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/reportes" 
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Historial por Cliente</h1>
          <p className="text-sm text-slate-600">Revisa qué compra cada persona, sus preferencias y frecuencia (ideal para cross-selling).</p>
        </div>
      </div>

      <HistorialClienteClient />
    </div>
  );
}
