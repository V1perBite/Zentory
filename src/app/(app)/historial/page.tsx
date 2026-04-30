import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";
import Link from "next/link";

type HistorialPageProps = {
  searchParams?: {
    estado?: string;
    desde?: string;
    hasta?: string;
    numero?: string;
  };
};

export default async function HistorialPage({ searchParams }: HistorialPageProps) {
  const profile = await requireProfile();
  const supabase = createClient();
  const estado = searchParams?.estado?.trim() ?? "";
  const desde = searchParams?.desde?.trim() ?? "";
  const hasta = searchParams?.hasta?.trim() ?? "";
  const numero = searchParams?.numero?.trim() ?? "";

  let query = supabase
    .from("facturas")
    .select("id,numero_factura,subtotal,descuento_total,total,estado,created_at,vendedor_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (profile.rol !== ROLES.ADMIN) {
    query = query.eq("vendedor_id", profile.id);
  }

  if (estado === "pendiente_impresion" || estado === "impresa") {
    query = query.eq("estado", estado);
  }

  if (desde) {
    query = query.gte("created_at", `${desde}T00:00:00`);
  }

  if (hasta) {
    query = query.lte("created_at", `${hasta}T23:59:59`);
  }

  if (numero && /^\d+$/.test(numero)) {
    query = query.eq("numero_factura", Number(numero));
  }

  const { data } = await query;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Historial de facturas</h1>
        <p className="text-sm text-slate-600">
          {profile.rol === ROLES.ADMIN
            ? "Vista global de facturación."
            : "Vista de tus facturas generadas."}
        </p>
      </div>

      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5">
        <input
          name="numero"
          defaultValue={numero}
          placeholder="N° factura"
          className="rounded border border-slate-300 px-2 py-2 text-sm"
        />
        <select
          name="estado"
          defaultValue={estado}
          className="rounded border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente_impresion">Pendiente impresión</option>
          <option value="impresa">Impresa</option>
        </select>
        <input name="desde" type="date" defaultValue={desde} className="rounded border border-slate-300 px-2 py-2 text-sm" />
        <input name="hasta" type="date" defaultValue={hasta} className="rounded border border-slate-300 px-2 py-2 text-sm" />
        <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">N°</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Subtotal</th>
              <th className="px-3 py-2">Descuento</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((factura) => (
              <tr key={factura.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{factura.numero_factura}</td>
                <td className="px-3 py-2">{new Date(factura.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">${Number(factura.subtotal).toFixed(2)}</td>
                <td className="px-3 py-2">${Number(factura.descuento_total).toFixed(2)}</td>
                <td className="px-3 py-2">${Number(factura.total).toFixed(2)}</td>
                <td className="px-3 py-2">{factura.estado}</td>
                <td className="px-3 py-2">
                  <Link href={`/historial/${factura.id}`} className="text-slate-900 underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
