import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { VentasVendedorClient } from "@/components/reportes/ventas-vendedor-client";

export default async function VentasVendedorPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Ventas por Vendedor"
        subtitle="Mide el rendimiento individual y comisiones de tu equipo."
      />

      <VentasVendedorClient />
    </div>
  );
}
