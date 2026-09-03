import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { MejoresClientesClient } from "@/components/reportes/mejores-clientes-client";

export default async function MejoresClientesPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mejores Clientes</h1>
        <p className="text-sm text-slate-600">Ranking de tus clientes basado en el volumen de compras y cantidad de facturas.</p>
      </div>

      <MejoresClientesClient />
    </div>
  );
}
