import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { HistorialClienteClient } from "@/components/reportes/historial-cliente-client";

export default async function HistorialClientePage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Historial por Cliente"
        subtitle="Revisa qué compra cada persona, sus preferencias y frecuencia (ideal para cross-selling)."
      />

      <HistorialClienteClient />
    </div>
  );
}
