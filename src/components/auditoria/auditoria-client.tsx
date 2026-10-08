"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FileX, Loader2 } from "lucide-react";
import { exportarAuditoriaCSV } from "@/app/actions/auditoria";
import {
  ACCIONES_AUDITORIA,
  MODULO_BADGE,
  MODULO_LABEL,
} from "@/lib/constants";
import { formatoFechaAuditoria } from "@/lib/auditoria-format";
import { descargarCsv } from "@/lib/csv";
import type { AuditoriaEvento, AuditoriaFiltros } from "@/lib/types";

type Props = {
  rows: AuditoriaEvento[];
  total: number;
  page: number;
  porPagina: number;
  filtros: AuditoriaFiltros;
  puedeExportar: boolean;
};

const ENTIDAD_LABEL: Record<string, string> = {
  USUARIO: "Usuario",
  PRODUCTO: "Producto",
  MOVIMIENTO: "Movimiento",
  FACTURA: "Factura",
  CLIENTE: "Cliente",
  NEGOCIO: "Negocio",
};

function accionLabel(codigo: string): string {
  return ACCIONES_AUDITORIA[codigo] ?? codigo.replace(/_/g, " ");
}

export function AuditoriaClient({
  rows,
  total,
  page,
  porPagina,
  filtros,
  puedeExportar,
}: Props) {
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / porPagina));

  const enlacePagina = (pagina: number) => {
    const params = new URLSearchParams();
    if (filtros.usuario) params.set("usuario", filtros.usuario);
    if (filtros.desde) params.set("desde", filtros.desde);
    if (filtros.hasta) params.set("hasta", filtros.hasta);
    if (filtros.accion) params.set("accion", filtros.accion);
    if (filtros.modulo) params.set("modulo", filtros.modulo);
    if (filtros.producto) params.set("producto", filtros.producto);
    if (filtros.factura) params.set("factura", filtros.factura);
    if (filtros.cliente) params.set("cliente", filtros.cliente);
    if (pagina > 1) params.set("page", String(pagina));
    const qs = params.toString();
    return qs ? `/auditoria?${qs}` : "/auditoria";
  };

  const onExportar = async () => {
    setExportando(true);
    setError(null);
    const res = await exportarAuditoriaCSV({ ...filtros, page: undefined });
    setExportando(false);

    if (res.error || !res.csv) {
      setError(res.error ?? "No se pudo exportar.");
      return;
    }

    descargarCsv(res.filename ?? "auditoria.csv", res.csv);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {total} evento{total !== 1 ? "s" : ""} · página {page} de {totalPages}
        </p>
        {puedeExportar ? (
          <button
            type="button"
            onClick={onExportar}
            disabled={exportando}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {exportando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exportar CSV
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {/* Tabla — desktop */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Fecha</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Usuario</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Acción</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Módulo</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Entidad</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Descripción</th>
              <th className="px-4 py-3 font-semibold text-slate-700">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-400">
                  <FileX className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  No hay eventos de auditoría con los filtros aplicados.
                </td>
              </tr>
            ) : null}
            {rows.map((ev) => (
              <tr key={ev.id} className="transition-colors hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {formatoFechaAuditoria(ev.created_at)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <span className="font-medium">{ev.usuario_nombre ?? "—"}</span>
                  {ev.usuario_email ? (
                    <span className="block text-xs text-slate-400">{ev.usuario_email}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/auditoria/${ev.id}`}
                    className="font-medium text-slate-700 hover:text-indigo-600 hover:underline"
                  >
                    {accionLabel(ev.accion)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      MODULO_BADGE[ev.modulo] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {MODULO_LABEL[ev.modulo] ?? ev.modulo}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  <span className="text-xs text-slate-400">
                    {ENTIDAD_LABEL[ev.entidad] ?? ev.entidad}
                  </span>
                  {ev.entidad_ref ? (
                    <span className="block max-w-[160px] truncate font-medium">
                      {ev.entidad_ref}
                    </span>
                  ) : null}
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-500">
                  <span className="line-clamp-2" title={ev.descripcion ?? undefined}>
                    {ev.descripcion ?? "—"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
                  {ev.ip ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tarjetas — móvil */}
      <div className="grid gap-3 md:hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
            <FileX className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              No hay eventos de auditoría con los filtros aplicados.
            </p>
          </div>
        ) : null}
        {rows.map((ev) => (
          <Link
            key={ev.id}
            href={`/auditoria/${ev.id}`}
            className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-700">{accionLabel(ev.accion)}</p>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                  MODULO_BADGE[ev.modulo] ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {MODULO_LABEL[ev.modulo] ?? ev.modulo}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {formatoFechaAuditoria(ev.created_at)} · {ev.usuario_nombre ?? "—"}
            </p>
            {ev.entidad_ref ? (
              <p className="mt-1 text-xs text-slate-600">
                {ENTIDAD_LABEL[ev.entidad] ?? ev.entidad}: {ev.entidad_ref}
              </p>
            ) : null}
            {ev.descripcion ? (
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{ev.descripcion}</p>
            ) : null}
          </Link>
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <Link
              href={enlacePagina(page - 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-slate-500">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={enlacePagina(page + 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}
