import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";
import { formatCOP } from "@/lib/invoice-calculations";
import Link from "next/link";

type ReportesPageProps = {
  searchParams?: {
    tab?: string;
    desde?: string;
    hasta?: string;
  };
};

function CssBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2;
  return (
    <div className="flex h-4 w-full overflow-hidden rounded bg-slate-100">
      <div className={`h-full rounded ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  const profile = await requireProfile();
  if (profile.rol !== ROLES.ADMIN) redirect("/dashboard");

  const supabase = createClient();
  const tab = searchParams?.tab ?? "ventas";

  const hoy = new Date();
  const hace30 = new Date(hoy);
  hace30.setDate(hoy.getDate() - 30);
  const defaultDesde = hace30.toISOString().split("T")[0];
  const defaultHasta = hoy.toISOString().split("T")[0];

  const desde = searchParams?.desde ?? defaultDesde;
  const hasta = searchParams?.hasta ?? defaultHasta;

  const TABS = [
    { key: "ventas", label: "Ventas & Utilidades" },
    { key: "productos", label: "Top Productos" },
    { key: "inventario", label: "Inventario Valorizado" },
    { key: "vendedores", label: "Por Vendedor" },
  ];

  // ── TAB: VENTAS & UTILIDADES ──────────────────────────────────────────────
  let ventasPorDia: { fecha: string; total: number; costo: number; utilidad: number }[] = [];
  let totalVentas = 0;
  let totalCosto = 0;
  let totalUtilidad = 0;

  if (tab === "ventas") {
    const { data } = await supabase
      .from("facturas")
      .select(
        "created_at,total,factura_items(cantidad,precio_unitario,producto:productos(precio_costo))",
      )
      .eq("estado", "impresa")
      .gte("created_at", `${desde}T00:00:00`)
      .lte("created_at", `${hasta}T23:59:59`)
      .order("created_at");

    const map = new Map<string, { total: number; costo: number }>();
    for (const f of data ?? []) {
      const fecha = f.created_at.split("T")[0];
      const prev = map.get(fecha) ?? { total: 0, costo: 0 };
      const costoFactura = (f.factura_items ?? []).reduce((acc: number, fi: {
        cantidad: number;
        producto: { precio_costo: number } | { precio_costo: number }[] | null;
      }) => {
        const pc = Array.isArray(fi.producto) ? fi.producto[0]?.precio_costo : fi.producto?.precio_costo;
        return acc + fi.cantidad * Number(pc ?? 0);
      }, 0);
      map.set(fecha, { total: prev.total + Number(f.total), costo: prev.costo + costoFactura });
    }

    ventasPorDia = Array.from(map.entries()).map(([fecha, v]) => ({
      fecha,
      total: v.total,
      costo: v.costo,
      utilidad: v.total - v.costo,
    }));

    totalVentas = ventasPorDia.reduce((a, v) => a + v.total, 0);
    totalCosto = ventasPorDia.reduce((a, v) => a + v.costo, 0);
    totalUtilidad = totalVentas - totalCosto;
  }

  // ── TAB: TOP PRODUCTOS ────────────────────────────────────────────────────
  let topProductos: { nombre: string; unidades: number; ingresos: number }[] = [];

  if (tab === "productos") {
    const { data } = await supabase
      .from("factura_items")
      .select(
        "cantidad,subtotal,producto:productos(nombre),factura:facturas!inner(estado,created_at)",
      )
      .eq("factura.estado", "impresa")
      .gte("factura.created_at", `${desde}T00:00:00`)
      .lte("factura.created_at", `${hasta}T23:59:59`);

    const map = new Map<string, { unidades: number; ingresos: number }>();
    // eslint-disable-next-line
    for (const fi of (data ?? []) as any[]) {
      const nombre = Array.isArray(fi.producto)
        ? (fi.producto[0]?.nombre ?? "-")
        : (fi.producto?.nombre ?? "-");
      const prev = map.get(nombre) ?? { unidades: 0, ingresos: 0 };
      map.set(nombre, {
        unidades: prev.unidades + fi.cantidad,
        ingresos: prev.ingresos + Number(fi.subtotal),
      });
    }

    topProductos = Array.from(map.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 20);
  }

  // ── TAB: INVENTARIO VALORIZADO ────────────────────────────────────────────
  let inventario: { nombre: string; sku: string; stock: number; costo: number; valor: number }[] = [];
  let totalValorInventario = 0;

  if (tab === "inventario") {
    const { data } = await supabase
      .from("productos")
      .select("nombre,sku_code,stock_actual,precio_costo")
      .eq("activo", true)
      .order("nombre");

    inventario = (data ?? []).map((p) => ({
      nombre: p.nombre,
      sku: p.sku_code,
      stock: p.stock_actual,
      costo: Number(p.precio_costo),
      valor: p.stock_actual * Number(p.precio_costo),
    }));
    totalValorInventario = inventario.reduce((a, p) => a + p.valor, 0);
    inventario.sort((a, b) => b.valor - a.valor);
  }

  // ── TAB: POR VENDEDOR ────────────────────────────────────────────────────
  let porVendedor: { nombre: string; facturas: number; total: number; promedio: number }[] = [];

  if (tab === "vendedores") {
    const { data } = await supabase
      .from("facturas")
      .select("total,vendedor:usuarios(nombre)")
      .eq("estado", "impresa")
      .gte("created_at", `${desde}T00:00:00`)
      .lte("created_at", `${hasta}T23:59:59`);

    const map = new Map<string, { facturas: number; total: number }>();
    // eslint-disable-next-line
    for (const f of (data ?? []) as any[]) {
      const nombre = Array.isArray(f.vendedor)
        ? (f.vendedor[0]?.nombre ?? "-")
        : (f.vendedor?.nombre ?? "-");
      const prev = map.get(nombre) ?? { facturas: 0, total: 0 };
      map.set(nombre, { facturas: prev.facturas + 1, total: prev.total + Number(f.total) });
    }

    porVendedor = Array.from(map.entries())
      .map(([nombre, v]) => ({
        nombre,
        facturas: v.facturas,
        total: v.total,
        promedio: v.facturas > 0 ? v.total / v.facturas : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  const maxVentas = ventasPorDia.length > 0 ? Math.max(...ventasPorDia.map((v) => v.total)) : 1;
  const maxUnidades = topProductos.length > 0 ? Math.max(...topProductos.map((p) => p.unidades)) : 1;
  const maxValor = inventario.length > 0 ? Math.max(...inventario.map((p) => p.valor)) : 1;
  const maxVendedor = porVendedor.length > 0 ? Math.max(...porVendedor.map((v) => v.total)) : 1;

  const dateFilter = tab !== "inventario";

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-slate-600">Análisis de ventas, productos, inventario y vendedores.</p>
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reportes?tab=${t.key}&desde=${desde}&hasta=${hasta}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Date filter (hidden for inventario tab) */}
      {dateFilter ? (
        <form className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value={tab} />
          <label className="space-y-1 text-xs text-slate-600">
            <span>Desde</span>
            <input
              name="desde"
              type="date"
              defaultValue={desde}
              className="block rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span>Hasta</span>
            <input
              name="hasta"
              type="date"
              defaultValue={hasta}
              className="block rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            Aplicar
          </button>
        </form>
      ) : null}

      {/* ── VENTAS & UTILIDADES ── */}
      {tab === "ventas" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Ventas brutas</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatCOP(totalVentas)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Costo total</p>
              <p className="mt-1 text-xl font-bold text-rose-600">{formatCOP(totalCosto)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Utilidad bruta</p>
              <p className="mt-1 text-xl font-bold text-emerald-600">{formatCOP(totalUtilidad)}</p>
              {totalVentas > 0 ? (
                <p className="text-xs text-slate-400">
                  {((totalUtilidad / totalVentas) * 100).toFixed(1)}% margen
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Ventas por día</h3>
            {ventasPorDia.length === 0 ? (
              <p className="text-sm text-slate-400">Sin datos en el período seleccionado.</p>
            ) : (
              <div className="space-y-2">
                {ventasPorDia.map((v) => (
                  <div key={v.fecha} className="grid grid-cols-[90px_1fr_120px] items-center gap-2">
                    <span className="text-xs text-slate-500">{v.fecha.slice(5)}</span>
                    <CssBar value={v.total} max={maxVentas} color="bg-emerald-400" />
                    <span className="text-right text-xs font-medium">{formatCOP(v.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── TOP PRODUCTOS ── */}
      {tab === "productos" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Top productos por unidades vendidas</h3>
          {topProductos.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos en el período seleccionado.</p>
          ) : (
            <div className="space-y-2.5">
              {topProductos.map((p, i) => (
                <div key={p.nombre} className="grid grid-cols-[20px_1fr_1fr_80px_100px] items-center gap-2">
                  <span className="text-xs text-slate-400">{i + 1}</span>
                  <span className="truncate text-xs font-medium text-slate-700">{p.nombre}</span>
                  <CssBar value={p.unidades} max={maxUnidades} color="bg-blue-400" />
                  <span className="text-right text-xs text-slate-500">{p.unidades} uds</span>
                  <span className="text-right text-xs font-medium">{formatCOP(p.ingresos)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ── INVENTARIO VALORIZADO ── */}
      {tab === "inventario" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-700">Valor total del inventario</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{formatCOP(totalValorInventario)}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Productos activos (ordenados por valor)</h3>
            {inventario.length === 0 ? (
              <p className="text-sm text-slate-400">No hay productos activos.</p>
            ) : (
              <div className="space-y-2.5">
                {inventario.map((p) => (
                  <div
                    key={p.nombre}
                    className="grid grid-cols-[1fr_60px_80px_1fr_100px] items-center gap-2"
                  >
                    <span className="truncate text-xs font-medium text-slate-700">{p.nombre}</span>
                    <span className="text-right text-xs text-slate-500">{p.stock} uds</span>
                    <span className="text-right text-xs text-slate-500">{formatCOP(p.costo)}/u</span>
                    <CssBar value={p.valor} max={maxValor} color="bg-amber-400" />
                    <span className="text-right text-xs font-medium">{formatCOP(p.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── POR VENDEDOR ── */}
      {tab === "vendedores" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Ventas por vendedor</h3>
          {porVendedor.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos en el período seleccionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2 text-xs">Vendedor</th>
                    <th className="px-3 py-2 text-xs">Rendimiento</th>
                    <th className="px-3 py-2 text-right text-xs"># Facturas</th>
                    <th className="px-3 py-2 text-right text-xs">Total</th>
                    <th className="px-3 py-2 text-right text-xs">Ticket prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {porVendedor.map((v) => (
                    <tr key={v.nombre} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{v.nombre}</td>
                      <td className="px-3 py-2 w-32">
                        <CssBar value={v.total} max={maxVendedor} color="bg-violet-400" />
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{v.facturas}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatCOP(v.total)}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatCOP(v.promedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
