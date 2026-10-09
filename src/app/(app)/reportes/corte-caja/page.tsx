import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { CorteCajaClient } from "@/components/reportes/corte-caja-client";

export default async function CorteCajaPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Corte de Caja Diario"
        subtitle="Resumen de las ventas e ingresos de un día específico."
      />

      <CorteCajaClient />
    </div>
  );
}
