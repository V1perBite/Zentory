import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { RotacionClient } from "@/components/reportes/rotacion-client";

export default async function RotacionPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rotación de Inventario</h1>
        <p className="text-sm text-slate-600">Analiza la velocidad a la que se vende el inventario (Unidades vendidas vs Stock actual).</p>
      </div>

      <RotacionClient />
    </div>
  );
}
