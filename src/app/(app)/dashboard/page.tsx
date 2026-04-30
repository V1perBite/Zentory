import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: productos } = await supabase
    .from("productos")
    .select("stock_actual,minimo_stock,activo")
    .eq("activo", true)
    .limit(300);

  const lowStockCount = (productos ?? []).filter((p) => p.stock_actual <= p.minimo_stock).length;

  const cards = [
    { href: "/inventario", title: "Inventario", desc: "Stock, mínimos y productos." },
    { href: "/facturas", title: "Facturas", desc: "Crear venta con escaneo y descuentos." },
    { href: "/historial", title: "Historial", desc: "Consulta de facturas por rol." },
  ];

  if (profile.rol === ROLES.ADMIN) {
    cards.push({
      href: "/imprimir",
      title: "Centro de impresión",
      desc: "Cola automática de facturas pendientes.",
    });
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-600">Selecciona un módulo para continuar.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Productos en mínimo o bajo mínimo: <span className="font-semibold">{lowStockCount}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
          >
            <p className="font-semibold">{card.title}</p>
            <p className="mt-1 text-sm text-slate-600">{card.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
