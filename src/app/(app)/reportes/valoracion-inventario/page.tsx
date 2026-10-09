import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { ValoracionInventarioClient } from "@/components/reportes/valoracion-inventario-client";

export default async function ValoracionInventarioPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Valoración del Inventario"
        subtitle="Capital invertido en mercancía actual basado en los costos de compra."
      />

      <ValoracionInventarioClient />
    </div>
  );
}
