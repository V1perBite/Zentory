import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { MermasClient } from "@/components/reportes/mermas-client";

export default async function MermasPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reporte de Mermas y Ajustes</h1>
        <p className="text-sm text-slate-600">Revisa los productos dañados, caducados o perdidos y su impacto financiero.</p>
      </div>

      <MermasClient />
    </div>
  );
}
