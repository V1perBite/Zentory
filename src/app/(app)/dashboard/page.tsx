import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type MovimientoRow = {
  id: string;
  tipo: string;
  cantidad: number;
  motivo: string;
  created_at: string;
  producto: { nombre: string } | { nombre: string }[] | null;
  usuario: { nombre: string } | { nombre: string }[] | null;
};

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: productos } = await supabase
    .from("productos")
    .select("stock_actual,minimo_stock,activo")
    .eq("activo", true)
    .limit(300);

  const lowStockCount = (productos ?? []).filter((p) => p.stock_actual <= p.minimo_stock).length;

  const { data: movimientosRaw } = profile.rol === ROLES.ADMIN
    ? await supabase
        .from("movimientos_stock")
        .select("id,tipo,cantidad,motivo,created_at,producto:productos(nombre),usuario:usuarios(nombre)")
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] as MovimientoRow[] };

  const movimientos = (movimientosRaw ?? []) as MovimientoRow[];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-600">Resumen operativo del día.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Productos en mínimo o bajo mínimo: <span className="font-semibold">{lowStockCount}</span>
      </div>

      {profile.rol === ROLES.ADMIN ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-base font-semibold">Movimientos recientes</h2>
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
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {(Array.isArray(m.producto) ? m.producto[0]?.nombre : m.producto?.nombre) ?? "-"}
                    </td>
                    <td className="px-3 py-2">{m.tipo}</td>
                    <td className="px-3 py-2">{m.cantidad}</td>
                    <td className="px-3 py-2">{m.motivo}</td>
                    <td className="px-3 py-2">
                      {(Array.isArray(m.usuario) ? m.usuario[0]?.nombre : m.usuario?.nombre) ?? "-"}
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
