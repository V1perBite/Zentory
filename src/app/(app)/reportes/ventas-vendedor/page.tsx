import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { VentasVendedorClient } from "@/components/reportes/ventas-vendedor-client";

export default async function VentasVendedorPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ventas por Vendedor</h1>
        <p className="text-sm text-slate-600">Mide el rendimiento individual y comisiones de tu equipo.</p>
      </div>

      <VentasVendedorClient />
    </div>
  );
}
