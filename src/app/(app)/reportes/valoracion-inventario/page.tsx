import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { ValoracionInventarioClient } from "@/components/reportes/valoracion-inventario-client";

export default async function ValoracionInventarioPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Valoración del Inventario</h1>
        <p className="text-sm text-slate-600">Capital invertido en mercancía actual basado en los costos de compra.</p>
      </div>

      <ValoracionInventarioClient />
    </div>
  );
}
