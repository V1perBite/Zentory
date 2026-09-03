import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { RentabilidadClient } from "@/components/reportes/rentabilidad-client";

export default async function RentabilidadPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rentabilidad por Producto</h1>
        <p className="text-sm text-slate-600">Analiza el margen de ganancia real de cada producto basado en las ventas.</p>
      </div>

      <RentabilidadClient />
    </div>
  );
}
