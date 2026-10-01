import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, Info, MonitorSmartphone, User } from "lucide-react";
import { hasPermission, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ACCIONES_AUDITORIA,
  MODULO_BADGE,
  MODULO_LABEL,
  PERMISOS,
} from "@/lib/constants";
import {
  calcularDiferencia,
  etiquetaCampo,
  formatoFechaAuditoria,
  textoValor,
} from "@/lib/auditoria-format";
import type { AuditoriaEvento } from "@/lib/types";

type PageProps = { params: { id: string } };

export default async function AuditoriaDetallePage({ params }: PageProps) {
  const profile = await requireProfile();
  if (!hasPermission(profile, PERMISOS.AUDITORIA_VER)) redirect("/dashboard");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("auditoria_eventos")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) notFound();

  const ev = data as AuditoriaEvento;
  const accion = ACCIONES_AUDITORIA[ev.accion] ?? ev.accion.replace(/_/g, " ");
  const diferencia = calcularDiferencia(ev.valores_previos, ev.valores_nuevos);
  const metadata = Object.entries(ev.metadata ?? {});

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/auditoria"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{accion}</h1>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                MODULO_BADGE[ev.modulo] ?? "bg-slate-100 text-slate-600"
              }`}
            >
              {MODULO_LABEL[ev.modulo] ?? ev.modulo}
            </span>
          </div>
          <p className="text-sm text-slate-500">{ev.descripcion ?? "Sin descripción"}</p>
        </div>
      </div>

      {/* Datos del evento */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <User className="h-3.5 w-3.5" /> Usuario
          </p>
          <p className="font-semibold text-slate-800">{ev.usuario_nombre ?? "Sistema"}</p>
          <p className="text-xs text-slate-500">{ev.usuario_email ?? "—"}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Clock className="h-3.5 w-3.5" /> Fecha
          </p>
          <p className="font-semibold text-slate-800">
            {formatoFechaAuditoria(ev.created_at)}
          </p>
          <p className="text-xs text-slate-500">{ev.created_at}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Info className="h-3.5 w-3.5" /> Entidad
          </p>
          <p className="font-semibold text-slate-800">{ev.entidad}</p>
          <p className="truncate text-xs text-slate-500">{ev.entidad_ref ?? "—"}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <MonitorSmartphone className="h-3.5 w-3.5" /> IP
          </p>
          <p className="font-mono font-semibold text-slate-800">{ev.ip ?? "—"}</p>
        </div>
      </div>

      {ev.motivo ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Motivo
          </p>
          <p className="mt-1 text-sm text-amber-900">{ev.motivo}</p>
        </div>
      ) : null}

      {/* ANTES → DESPUÉS */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Cambios registrados
          </h2>
          <p className="text-xs text-slate-500">
            Valor anterior → valor nuevo. Los registros de auditoría no se
            pueden modificar: las correcciones generan un evento nuevo.
          </p>
        </div>

        {diferencia.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            Este evento no tiene valores anterior/nuevo (se registró al crear o
            eliminar el elemento).
          </p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Campo</th>
                <th className="px-4 py-3 font-semibold text-rose-700">Antes</th>
                <th className="px-4 py-3 font-semibold text-emerald-700">Después</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diferencia.map((d) => (
                <tr key={d.campo} className={d.cambiado ? "bg-slate-50/40" : undefined}>
                  <td className="px-4 py-3 font-medium text-slate-700">{d.etiqueta}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="rounded bg-rose-50 px-2 py-1 text-rose-700">
                      {d.antes}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">
                      {d.despues}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Contexto adicional */}
      {metadata.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Información adicional
          </h2>
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {metadata.map(([clave, valor]) => (
              <div
                key={clave}
                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
              >
                <dt className="text-xs font-medium text-slate-500">
                  {etiquetaCampo(clave)}
                </dt>
                <dd className="text-sm text-slate-700">{textoValor(valor)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
