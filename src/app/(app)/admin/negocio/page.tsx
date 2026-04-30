import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { NegocioForm } from "@/components/admin/negocio-form";
import type { Negocio } from "@/lib/types";

export default async function AdminNegocioPage() {
  const profile = await requireProfile();
  if (profile.rol !== ROLES.ADMIN) redirect("/dashboard");

  const supabase = createClient();

  const { data } = await supabase
    .from("negocio")
    .select("*")
    .limit(1)
    .single();

  const negocio = data as Negocio | null;

  if (!negocio) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Datos del negocio</h1>
        <p className="text-sm text-rose-600">No se encontraron datos del negocio. Ejecuta las migraciones.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Datos del negocio</h1>
        <p className="text-sm text-slate-600">Esta información aparecerá en los tickets impresos.</p>
      </div>
      <NegocioForm negocio={negocio} />
    </section>
  );
}
