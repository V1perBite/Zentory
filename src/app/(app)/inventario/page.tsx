import { isAdmin, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminTools } from "@/components/inventario/admin-tools";
import { InventarioClient } from "@/components/inventario/inventario-client";

export default async function InventarioPage() {
  const profile = await requireProfile();
  const esAdmin = isAdmin(profile);
  const supabase = createClient();

  // El precio de costo nunca sale del servidor hacia un no-admin: se consulta
  // siempre (el tipo de Supabase exige una columna literal) pero sólo viaja
  // en las props cuando el usuario es admin.
  const { data: productos } = await supabase
    .from("productos")
    .select("id,nombre,sku_code,precio_venta,precio_costo,stock_actual,minimo_stock,activo")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: permisoData } = await supabase
    .from("usuarios")
    .select("puede_crear_productos")
    .eq("id", profile.id)
    .single();

  const puedeCrear =
    esAdmin || permisoData?.puede_crear_productos === true;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-sm text-slate-600">Consulta de stock y alertas mínimas.</p>
        </div>
        {esAdmin ? (
          <p className="text-xs text-slate-500">CRUD y ajustes de stock habilitados para admin.</p>
        ) : puedeCrear ? (
          <p className="text-xs text-amber-600 font-medium">Permiso temporal de creación activo.</p>
        ) : null}
      </div>

      {esAdmin ? (
        <AdminTools
          productos={(productos ?? []).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            sku_code: p.sku_code,
            precio_venta: p.precio_venta,
            precio_costo: p.precio_costo ?? 0,
            stock_actual: p.stock_actual,
            minimo_stock: p.minimo_stock,
            activo: p.activo,
          }))}
        />
      ) : null}

      <InventarioClient
        productos={(productos ?? []).map((p) => ({
          id: p.id,
          nombre: p.nombre,
          sku_code: p.sku_code,
          precio_venta: Number(p.precio_venta),
          precio_costo: esAdmin ? Number(p.precio_costo ?? 0) : null,
          stock_actual: p.stock_actual,
          minimo_stock: p.minimo_stock,
          activo: p.activo,
        }))}
        isAdmin={esAdmin}
      />

    </section>
  );
}
