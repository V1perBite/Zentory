import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search, ShieldCheck } from "lucide-react";
import { hasPermission, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ACCIONES_AUDITORIA,
  AUDITORIA_MODULOS,
  MODULO_LABEL,
  PERMISOS,
} from "@/lib/constants";
import { construirQueryAuditoria, leerFiltros } from "@/lib/auditoria-query";
import { AuditoriaClient } from "@/components/auditoria/auditoria-client";
import type { AuditoriaEvento } from "@/lib/types";

const POR_PAGINA = 50;

type PageProps = {
  searchParams?: Record<string, string | undefined>;
};

export default async function AuditoriaPage({ searchParams }: PageProps) {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISOS.AUDITORIA_VER)) redirect("/dashboard");

  const filtros = leerFiltros(searchParams ?? {});
  const page = Math.max(1, filtros.page ?? 1);
  const desde = (page - 1) * POR_PAGINA;

  const supabase = createClient();

  const { data, count, error } = await construirQueryAuditoria(supabase, filtros).range(
    desde,
    desde + POR_PAGINA - 1,
  );

  const rows = ((data ?? []) as unknown as AuditoriaEvento[]) ?? [];

  // Usuarios distintos que ya aparecen en el historial (fuente: la propia
  // auditoría, así funciona también para quien no puede leer la tabla usuarios).
  const { data: actores } = await supabase
    .from("auditoria_eventos")
    .select("usuario_id, usuario_nombre")
    .not("usuario_id", "is", null)
    .order("usuario_nombre", { ascending: true })
    .limit(300);

  const usuarios = Array.from(
    new Map(
      ((actores ?? []) as { usuario_id: string; usuario_nombre: string | null }[])
        .filter((a) => a.usuario_id)
        .map((a) => [a.usuario_id, a.usuario_nombre ?? a.usuario_id]),
    ).entries(),
  ).map(([id, nombre]) => ({ id, nombre }));

  const inputCls =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";
  const hayFiltros = Boolean(
    filtros.usuario ||
      filtros.desde ||
      filtros.hasta ||
      filtros.accion ||
      filtros.modulo ||
      filtros.producto ||
      filtros.factura ||
      filtros.cliente,
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Auditoría</h1>
            <p className="text-sm text-slate-500">
              Historial inmutable de quién hizo qué, cuándo y sobre qué elemento
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <form className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4 lg:grid-cols-6">
        <select name="usuario" defaultValue={filtros.usuario ?? ""} className={inputCls}>
          <option value="">Todos los usuarios</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>

        <select name="modulo" defaultValue={filtros.modulo ?? ""} className={inputCls}>
          <option value="">Todos los módulos</option>
          {Object.values(AUDITORIA_MODULOS).map((m) => (
            <option key={m} value={m}>
              {MODULO_LABEL[m] ?? m}
            </option>
          ))}
        </select>

        <select name="accion" defaultValue={filtros.accion ?? ""} className={inputCls}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACCIONES_AUDITORIA)
            .sort((a, b) => a[1].localeCompare(b[1], "es"))
            .map(([codigo, label]) => (
              <option key={codigo} value={codigo}>
                {label}
              </option>
            ))}
        </select>

        <input
          name="producto"
          defaultValue={filtros.producto ?? ""}
          placeholder="Producto (SKU o nombre)"
          className={inputCls}
        />
        <input
          name="factura"
          defaultValue={filtros.factura ?? ""}
          placeholder="Factura (N°)"
          className={inputCls}
        />
        <input
          name="cliente"
          defaultValue={filtros.cliente ?? ""}
          placeholder="Cliente (identificación)"
          className={inputCls}
        />

        <div className="flex items-center gap-1">
          <label className="text-xs font-medium text-slate-500">Desde</label>
          <input
            name="desde"
            type="date"
            defaultValue={filtros.desde ?? ""}
            className={`w-full ${inputCls}`}
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs font-medium text-slate-500">Hasta</label>
          <input
            name="hasta"
            type="date"
            defaultValue={filtros.hasta ?? ""}
            className={`w-full ${inputCls}`}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            <Search className="h-3.5 w-3.5" />
            Filtrar
          </button>
          {hayFiltros ? (
            <Link
              href="/auditoria"
              className="flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          No se pudo leer la auditoría: {error.message}
        </p>
      ) : null}

      <AuditoriaClient
        rows={rows}
        total={count ?? rows.length}
        page={page}
        porPagina={POR_PAGINA}
        filtros={filtros}
        puedeExportar={hasPermission(profile, PERMISOS.AUDITORIA_EXPORTAR)}
      />
    </section>
  );
}
