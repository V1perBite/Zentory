import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { BajoStockClient } from "@/components/reportes/bajo-stock-client";

export default async function BajoStockPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Alerta de Bajo Stock"
        subtitle="Productos que han alcanzado o están por debajo de su stock mínimo configurado."
      />

      <BajoStockClient />
    </div>
  );
}
