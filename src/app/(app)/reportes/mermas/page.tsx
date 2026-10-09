import { isAdmin, requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { redirect } from "next/navigation";
import { MermasClient } from "@/components/reportes/mermas-client";

export default async function MermasPage() {
  const profile = await requireProfile();

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back="/reportes"
        backLabel="Volver al listado de reportes"
        title="Reporte de Mermas y Ajustes"
        subtitle="Revisa los productos dañados, caducados o perdidos y su impacto financiero."
      />

      <MermasClient />
    </div>
  );
}
