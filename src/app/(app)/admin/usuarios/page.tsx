import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { UsuariosClient } from "@/components/admin/usuarios-client";

export default async function AdminUsuariosPage() {
  const profile = await requireProfile();
  if (profile.rol !== ROLES.ADMIN) redirect("/dashboard");

  const supabase = createClient();

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id,nombre,email,rol,activo")
    .order("created_at", { ascending: true });

  const { data: permisos } = await supabase
    .from("usuarios")
    .select("id,puede_crear_productos");

  const permisosMap = new Map(
    (permisos ?? []).map((p: { id: string; puede_crear_productos: boolean }) => [p.id, p.puede_crear_productos])
  );

  const rows = (usuarios ?? []).map((u) => ({
    ...u,
    puede_crear_productos: permisosMap.get(u.id) ?? false,
  })) as {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    activo: boolean;
    puede_crear_productos: boolean;
  }[];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Gestión de usuarios</h1>
        <p className="text-sm text-slate-600">Crea y administra los accesos al sistema.</p>
      </div>
      <UsuariosClient usuarios={rows} currentUserId={profile.id} />
    </section>
  );
}
