import { isAdmin, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UsuariosClient } from "@/components/admin/usuarios-client";

export default async function AdminUsuariosPage() {
  const profile = await requireProfile();
  if (!isAdmin(profile)) redirect("/dashboard");

  const supabase = createClient();

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id,nombre,email,rol,activo")
    .order("created_at", { ascending: true });

  const { data: permisos } = await supabase
    .from("usuarios")
    .select("id,puede_crear_productos,puede_ver_auditoria,puede_exportar_auditoria");

  const permisosMap = new Map(
    (permisos ?? []).map(
      (p: {
        id: string;
        puede_crear_productos: boolean;
        puede_ver_auditoria: boolean;
        puede_exportar_auditoria: boolean;
      }) => [p.id, p],
    ),
  );

  const rows = (usuarios ?? []).map((u) => {
    const permiso = permisosMap.get(u.id);
    return {
      ...u,
      puede_crear_productos: permiso?.puede_crear_productos ?? false,
      puede_ver_auditoria: permiso?.puede_ver_auditoria ?? false,
      puede_exportar_auditoria: permiso?.puede_exportar_auditoria ?? false,
    };
  }) as {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    activo: boolean;
    puede_crear_productos: boolean;
    puede_ver_auditoria: boolean;
    puede_exportar_auditoria: boolean;
  }[];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Gestión de usuarios</h1>
        <p className="text-sm text-slate-600">Crea y administra los accesos al sistema.</p>
      </div>
      <UsuariosClient
        usuarios={rows}
        currentUserId={profile.id}
        currentRol={profile.rol}
      />
    </section>
  );
}
