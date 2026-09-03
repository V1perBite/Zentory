import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { ProductosTopClient } from "@/components/reportes/productos-top-client";

export default async function ProductosTopPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Top Productos</h1>
        <p className="text-sm text-slate-600">Conoce cuáles son los productos que más unidades venden y más ingresos generan.</p>
      </div>

      <ProductosTopClient />
    </div>
  );
}
