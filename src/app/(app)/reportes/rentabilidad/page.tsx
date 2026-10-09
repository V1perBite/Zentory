import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { RentabilidadClient } from "@/components/reportes/rentabilidad-client";

export default async function RentabilidadPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Rentabilidad por Producto"
        subtitle="Analiza el margen de ganancia real de cada producto basado en las ventas."
      />

      <RentabilidadClient />
    </div>
  );
}
