import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { HistorialClienteClient } from "@/components/reportes/historial-cliente-client";

export default async function HistorialClientePage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historial por Cliente</h1>
        <p className="text-sm text-slate-600">Revisa qué compra cada persona, sus preferencias y frecuencia (ideal para cross-selling).</p>
      </div>

      <HistorialClienteClient />
    </div>
  );
}
