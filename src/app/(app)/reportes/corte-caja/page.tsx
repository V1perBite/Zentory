import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { CorteCajaClient } from "@/components/reportes/corte-caja-client";

export default async function CorteCajaPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Corte de Caja Diario</h1>
        <p className="text-sm text-slate-600">Resumen de las ventas e ingresos de un día específico.</p>
      </div>

      <CorteCajaClient />
    </div>
  );
}
