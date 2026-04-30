import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";
import { AdminTools } from "@/components/inventario/admin-tools";
import { InventarioClient } from "@/components/inventario/inventario-client";

export default async function InventarioPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: productos } = await supabase
    .from("productos")
    .select("id,nombre,sku_code,precio_venta,precio_costo,stock_actual,minimo_stock,activo")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-sm text-slate-600">Consulta de stock y alertas mínimas.</p>
        </div>
        {profile.rol === ROLES.ADMIN ? (
          <p className="text-xs text-slate-500">CRUD y ajustes de stock habilitados para admin.</p>
        ) : null}
      </div>

      <InventarioClient
        productos={(productos ?? []).map((p) => ({
          id: p.id,
          nombre: p.nombre,
          sku_code: p.sku_code,
          precio_venta: Number(p.precio_venta),
          precio_costo: Number(p.precio_costo ?? 0),
          stock_actual: p.stock_actual,
          minimo_stock: p.minimo_stock,
          activo: p.activo,
        }))}
        isAdmin={profile.rol === ROLES.ADMIN}
      />

      {profile.rol === ROLES.ADMIN ? (
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

    </section>
  );
}
