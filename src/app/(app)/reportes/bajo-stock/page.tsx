import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { BajoStockClient } from "@/components/reportes/bajo-stock-client";

export default async function BajoStockPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alerta de Bajo Stock</h1>
        <p className="text-sm text-slate-600">Productos que han alcanzado o están por debajo de su stock mínimo configurado.</p>
      </div>

      <BajoStockClient />
    </div>
  );
}
