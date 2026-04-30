import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export default async function FacturasPage() {
  const profile = await requireProfile();

  if (profile.rol !== ROLES.ADMIN) {
    redirect("/facturas/nueva");
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facturas</h1>
        <p className="text-sm text-slate-600">Gestión de facturación e historial.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/facturas/nueva"
          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
        >
          <span className="text-3xl">🧾</span>
          <span className="font-semibold text-slate-800">Nueva factura</span>
          <span className="text-xs text-slate-500">Crea una factura con carrito, escaneo y descuentos.</span>
        </Link>

        <Link
          href="/historial"
          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <span className="text-3xl">📋</span>
          <span className="font-semibold text-slate-800">Historial</span>
          <span className="text-xs text-slate-500">Consulta, filtra y anula facturas generadas.</span>
        </Link>

        <Link
          href="/imprimir"
          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md"
        >
          <span className="text-3xl">🖨️</span>
          <span className="font-semibold text-slate-800">Cola de impresión</span>
          <span className="text-xs text-slate-500">Procesa facturas pendientes de impresión.</span>
        </Link>
      </div>
    </section>
  );
}
