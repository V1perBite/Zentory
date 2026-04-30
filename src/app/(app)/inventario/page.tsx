import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";
import { AdminTools } from "@/components/inventario/admin-tools";

type MovimientoRow = {
  id: string;
  tipo: string;
  cantidad: number;
  motivo: string;
  created_at: string;
  producto: { nombre: string } | { nombre: string }[] | null;
  usuario: { nombre: string } | { nombre: string }[] | null;
};

export default async function InventarioPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: productos } = await supabase
    .from("productos")
    .select("id,nombre,sku_code,precio_venta,stock_actual,minimo_stock,activo")
    .order("created_at", { ascending: false })
    .limit(200);

  const movimientosQuery = supabase
    .from("movimientos_stock")
    .select("id,tipo,cantidad,motivo,created_at,producto:productos(nombre),usuario:usuarios(nombre)")
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: movimientosRaw } =
    profile.rol === ROLES.ADMIN ? await movimientosQuery : { data: [] as MovimientoRow[] };

  const movimientos = (movimientosRaw ?? []) as MovimientoRow[];

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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Precio</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Mínimo</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(productos ?? []).map((p) => {
              const low = p.stock_actual <= p.minimo_stock;
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{p.nombre}</td>
                  <td className="px-3 py-2">{p.sku_code}</td>
                  <td className="px-3 py-2">${Number(p.precio_venta).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <span className={low ? "font-semibold text-amber-700" : ""}>{p.stock_actual}</span>
                  </td>
                  <td className="px-3 py-2">{p.minimo_stock}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        p.activo
                          ? "rounded bg-emerald-100 px-2 py-0.5 text-emerald-700"
                          : "rounded bg-slate-100 px-2 py-0.5 text-slate-500"
                      }
                    >
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {profile.rol === ROLES.ADMIN ? (
        <AdminTools
          productos={(productos ?? []).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            sku_code: p.sku_code,
            precio_venta: p.precio_venta,
            stock_actual: p.stock_actual,
            minimo_stock: p.minimo_stock,
            activo: p.activo,
          }))}
        />
      ) : null}

      {profile.rol === ROLES.ADMIN ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Movimientos recientes</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2">Motivo</th>
                  <th className="px-3 py-2">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {(movimientos ?? []).map((movimiento) => (
                  <tr key={movimiento.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{new Date(movimiento.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {(Array.isArray(movimiento.producto)
                        ? movimiento.producto[0]?.nombre
                        : movimiento.producto?.nombre) ?? "-"}
                    </td>
                    <td className="px-3 py-2">{movimiento.tipo}</td>
                    <td className="px-3 py-2">{movimiento.cantidad}</td>
                    <td className="px-3 py-2">{movimiento.motivo}</td>
                    <td className="px-3 py-2">
                      {(Array.isArray(movimiento.usuario)
                        ? movimiento.usuario[0]?.nombre
                        : movimiento.usuario?.nombre) ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
