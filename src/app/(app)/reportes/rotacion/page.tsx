import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { RotacionClient } from "@/components/reportes/rotacion-client";

export default async function RotacionPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Rotación de Inventario"
        subtitle="Analiza la velocidad a la que se vende el inventario (Unidades vendidas vs Stock actual)."
      />

      <RotacionClient />
    </div>
  );
}
