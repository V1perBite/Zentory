import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { MejoresClientesClient } from "@/components/reportes/mejores-clientes-client";

export default async function MejoresClientesPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Mejores Clientes"
        subtitle="Ranking de tus clientes basado en el volumen de compras y cantidad de facturas."
      />

      <MejoresClientesClient />
    </div>
  );
}
