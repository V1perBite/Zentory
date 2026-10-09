import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { VentasPeriodoClient } from "@/components/reportes/ventas-periodo-client";

export default async function VentasPeriodoPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Ventas por Período"
        subtitle="Analiza tus ingresos a lo largo del tiempo."
      />

      <VentasPeriodoClient />
    </div>
  );
}
