import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { VentasPeriodoClient } from "@/components/reportes/ventas-periodo-client";

export default async function VentasPeriodoPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ventas por Período</h1>
        <p className="text-sm text-slate-600">Visualiza el rendimiento de tus ventas en el tiempo.</p>
      </div>

      <VentasPeriodoClient />
    </div>
  );
}
