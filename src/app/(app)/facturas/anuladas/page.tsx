import { redirect } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";
import { formatCOP } from "@/lib/invoice-calculations";
import { ArrowLeft, Search, FileX } from "lucide-react";

type PageProps = {
  searchParams?: {
    desde?: string;
    hasta?: string;
    numero?: string;
  };
};

const BOGOTA_TZ = "America/Bogota";
const LOCALE = "es-CO";

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(LOCALE, {
    timeZone: BOGOTA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function FacturasAnuladasPage({ searchParams }: PageProps) {
  const profile = await requireProfile();
  if (profile.rol !== ROLES.ADMIN) redirect("/facturas/nueva");

  const supabase = createClient();

  const desde = searchParams?.desde?.trim() ?? "";
  const hasta = searchParams?.hasta?.trim() ?? "";
  const numero = searchParams?.numero?.trim() ?? "";

  let query = supabase
    .from("facturas")
    .select(
      [
        "id",
        "numero_factura",
        "total",
        "created_at",
        "fecha_anulacion",
        "razon_anulacion",
        // join al usuario que anuló (puede ser NULL en facturas pre-migración)
        "usuario_anulacion:usuarios!usuario_anulacion_id(nombre)",
      ].join(","),
    )
    .eq("estado", "anulada")
    .order("fecha_anulacion", { ascending: false, nullsFirst: false });

  // Filtrar por rango de fecha de anulación
  if (desde) query = query.gte("fecha_anulacion", `${desde}T00:00:00`);
  if (hasta) query = query.lte("fecha_anulacion", `${hasta}T23:59:59`);
  if (numero && /^\d+$/.test(numero))
    query = query.eq("numero_factura", Number(numero));

  const { data: raw } = await query.limit(500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (raw ?? []).map((f: any) => {
    const u = f.usuario_anulacion;
    const usuarioNombre: string = Array.isArray(u)
      ? (u[0]?.nombre ?? "—")
      : (u?.nombre ?? "—");
    return {
      id: f.id as string,
      numero_factura: f.numero_factura as number,
      total: Number(f.total),
      created_at: f.created_at as string,
      fecha_anulacion: f.fecha_anulacion as string | null,
      razon_anulacion: f.razon_anulacion as string | null,
      usuarioNombre,
    };
  });

  return (
    <section className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Link
          href="/facturas"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Registro de anulaciones
          </h1>
          <p className="text-sm text-slate-500">
            Solo visible para administradores · {rows.length} factura
            {rows.length !== 1 ? "s" : ""} anulada
            {rows.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          name="numero"
          defaultValue={numero}
          placeholder="N° factura"
          className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <div className="flex items-center gap-1">
          <label className="text-xs font-medium text-slate-500">Desde</label>
          <input
            name="desde"
            type="date"
            defaultValue={desde}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs font-medium text-slate-500">Hasta</label>
          <input
            name="hasta"
            type="date"
            defaultValue={hasta}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          <Search className="h-3.5 w-3.5" />
          Filtrar
        </button>
        {(desde || hasta || numero) && (
          <Link
            href="/facturas/anuladas"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Limpiar
          </Link>
        )}
      </form>

      {/* Tabla — desktop */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">N°</th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Fecha venta
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Fecha anulación
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Anulado por
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Motivo
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-16 text-center text-sm text-slate-400"
                >
                  <FileX className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  No hay facturas anuladas con los filtros aplicados.
                </td>
              </tr>
            ) : null}
            {rows.map((f) => (
              <tr
                key={f.id}
                className="opacity-75 transition-opacity hover:opacity-100"
              >
                <td className="px-4 py-3 font-bold text-slate-700">
                  <Link
                    href={`/historial/${f.id}`}
                    className="hover:text-indigo-600 hover:underline"
                  >
                    #{f.numero_factura}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {fmtFecha(f.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {fmtFecha(f.fecha_anulacion)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {f.usuarioNombre}
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-500">
                  {f.razon_anulacion ? (
                    <span title={f.razon_anulacion}>
                      {f.razon_anulacion.length > 80
                        ? f.razon_anulacion.slice(0, 80) + "…"
                        : f.razon_anulacion}
                    </span>
                  ) : (
                    <span className="italic text-slate-300">Sin motivo registrado</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-700 line-through">
                  {formatCOP(f.total)}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-xs text-slate-500">
                  {rows.length} factura{rows.length !== 1 ? "s" : ""} anulada
                  {rows.length !== 1 ? "s" : ""}
                </td>
                <td className="px-4 py-2 text-right text-xs font-semibold text-slate-600">
                  {formatCOP(rows.reduce((s, r) => s + r.total, 0))} devueltos
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Tarjetas — móvil */}
      <div className="grid gap-3 md:hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
            <FileX className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              No hay facturas anuladas con los filtros aplicados.
            </p>
          </div>
        ) : null}
        {rows.map((f) => (
          <div
            key={f.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm opacity-80"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <Link
                  href={`/historial/${f.id}`}
                  className="font-bold text-slate-700 hover:text-indigo-600"
                >
                  #{f.numero_factura}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  Venta: {fmtFecha(f.created_at)}
                </p>
                <p className="text-xs text-slate-500">
                  Anulada: {fmtFecha(f.fecha_anulacion)}
                </p>
              </div>
              <p className="font-bold text-slate-600 line-through">
                {formatCOP(f.total)}
              </p>
            </div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              Por: {f.usuarioNombre}
            </p>
            {f.razon_anulacion ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {f.razon_anulacion}
              </p>
            ) : (
              <p className="text-xs italic text-slate-300">Sin motivo registrado</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
