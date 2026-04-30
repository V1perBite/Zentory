import Link from "next/link";
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

  const cards = [
    { href: "/inventario", title: "Inventario", desc: "Stock, mínimos y productos.", icon: "📦" },
    { href: "/facturas", title: "Facturas", desc: "Crear venta con escaneo y descuentos.", icon: "🧾" },
    { href: "/historial", title: "Historial", desc: "Consulta de facturas por rol.", icon: "🕘" },
  ];

  if (profile.rol === ROLES.ADMIN) {
    cards.push(
      {
        href: "/imprimir",
        title: "Centro de impresión",
        desc: "Cola automática de facturas pendientes.",
        icon: "🖨️",
      },
      {
        href: "/admin/usuarios",
        title: "Usuarios",
        desc: "Gestiona accesos y roles del sistema.",
        icon: "👥",
      },
      {
        href: "/admin/negocio",
        title: "Datos del negocio",
        desc: "Nombre, NIT y encabezado del ticket.",
        icon: "🏪",
      },
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-600">Selecciona un módulo para continuar.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Productos en mínimo o bajo mínimo: <span className="font-semibold">{lowStockCount}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-xl">
              <span aria-hidden>{card.icon}</span>
            </div>
            <p className="font-semibold group-hover:text-emerald-700">{card.title}</p>
            <p className="mt-1 text-sm text-slate-600">{card.desc}</p>
            <p className="mt-3 text-xs font-medium text-emerald-700">Entrar al módulo →</p>
          </Link>
        ))}
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
