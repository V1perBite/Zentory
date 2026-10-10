"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCOP } from "@/lib/invoice-calculations";
import {
  ESTADOS_COMPRA,
  ESTADO_COMPRA_BADGE,
  DIAS_COMPRA_VENCIDA,
  DIAS_COMPRA_POR_VENCER,
} from "@/lib/constants";
import type { EstadoCompra, FacturaCompra } from "@/lib/types";
import {
  crearFacturaCompra,
  actualizarFacturaCompra,
  eliminarFacturaCompra,
  registrarAbono,
  exportarComprasCSV,
  type FacturaCompraInput,
} from "@/app/actions/facturas-compra";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { NumberField } from "@/components/ui/number-field";
import { EmpresaAutocomplete } from "@/components/compras/empresa-autocomplete";
import { PageHeader } from "@/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Receipt,
  AlertCircle,
  Clock,
} from "lucide-react";

type Props = {
  filas: FacturaCompra[];
  empresas: string[];
};

type Formulario = {
  empresa: string;
  numero_factura: string;
  concepto: string;
  valor: number;
  fecha_recibida: string;
  fecha_pago: string;
  estado: EstadoCompra;
  notas: string;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none";
const labelCls = "space-y-1 text-xs font-medium text-slate-600";
const btnPrimario =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60";

function hoy(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

function diasDesde(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, (m ?? 1) - 1, d ?? 1);
  const hoy0 = new Date();
  hoy0.setHours(0, 0, 0, 0);
  return Math.round((hoy0.getTime() - fecha.getTime()) / 86400000);
}

type Vencimiento = {
  vencida: boolean;
  porVencer: boolean;
  diasRestantes: number;
  fechaLimite: string;
};

function masDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, (m ?? 1) - 1, (d ?? 1) + dias);
  const yy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fechaCorta(iso: string): string {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${meses[(m ?? 1) - 1] ?? ""}`;
}

/**
 * Vencimiento de una factura pendiente. La fecha límite es el plazo de pago
 * (`fecha_pago`); si no tiene, se asumen DIAS_COMPRA_VENCIDA desde la recepción.
 */
function vencimientoDe(f: Pick<FacturaCompra, "fecha_recibida" | "fecha_pago">): Vencimiento {
  const fechaLimite = f.fecha_pago ?? masDias(f.fecha_recibida, DIAS_COMPRA_VENCIDA);
  const diasRestantes = -diasDesde(fechaLimite);
  return {
    vencida: diasRestantes < 0,
    porVencer: diasRestantes >= 0 && diasRestantes <= DIAS_COMPRA_POR_VENCER,
    diasRestantes,
    fechaLimite,
  };
}

function textoVencimiento(ve: Vencimiento): string {
  if (ve.vencida) return `vencida hace ${Math.abs(ve.diasRestantes)} d`;
  if (ve.porVencer) return `vence en ${ve.diasRestantes} d`;
  return `vence ${fechaCorta(ve.fechaLimite)}`;
}

function formVacio(): Formulario {
  return {
    empresa: "",
    numero_factura: "",
    concepto: "",
    valor: 0,
    fecha_recibida: hoy(),
    fecha_pago: "",
    estado: "pendiente",
    notas: "",
  };
}

function desdeFila(f: FacturaCompra): Formulario {
  return {
    empresa: f.empresa,
    numero_factura: f.numero_factura ?? "",
    concepto: f.concepto ?? "",
    valor: Number(f.valor ?? 0),
    fecha_recibida: f.fecha_recibida,
    fecha_pago: f.fecha_pago ?? "",
    estado: f.estado,
    notas: f.notas ?? "",
  };
}

function validar(f: Formulario): string | null {
  if (!f.empresa.trim()) return "La empresa es obligatoria.";
  if (!Number.isFinite(f.valor) || f.valor < 0) {
    return "El valor debe ser un número mayor o igual a 0.";
  }
  if (!f.fecha_recibida) return "La fecha de recibida es obligatoria.";
  if (f.fecha_pago && f.fecha_pago < f.fecha_recibida) {
    return "La fecha de pago no puede ser anterior a la fecha de recibida.";
  }
  return null;
}

export function ComprasClient({ filas, empresas }: Props) {
  const router = useRouter();

  const [buscar, setBuscar] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoCompra | "todas">("todas");

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<FacturaCompra | null>(null);
  const [form, setForm] = useState<Formulario>(formVacio);

  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState<FacturaCompra | null>(null);
  const [abonando, setAbonando] = useState<FacturaCompra | null>(null);
  const [montoAbono, setMontoAbono] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return filas.filter((f) => {
      if (filtroEstado !== "todas" && f.estado !== filtroEstado) return false;
      if (!q) return true;
      return [f.empresa, f.numero_factura, f.concepto]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [filas, buscar, filtroEstado]);

  const resumen = useMemo(() => {
    let total = 0;
    let pendiente = 0;
    let pagado = 0;
    for (const f of filtradas) {
      const v = Number(f.valor ?? 0);
      if (f.estado === "anulada") continue;
      total += v;
      if (f.estado === "pendiente" || f.estado === "parcial") {
        pendiente += v - Number(f.valor_abonado ?? 0);
      }
      if (f.estado === "pagada") pagado += v;
    }
    return { total, pendiente, pagado };
  }, [filtradas]);

  const sugerencias = useMemo(() => {
    const set = new Set(empresas.map((e) => e.trim()).filter(Boolean));
    for (const f of filas) set.add(f.empresa.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [empresas, filas]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(formVacio());
    setError(null);
    setSuccess(null);
    setAbierto(true);
  };

  const abrirEdicion = (f: FacturaCompra) => {
    setEditando(f);
    setForm(desdeFila(f));
    setError(null);
    setSuccess(null);
    setAbierto(true);
  };

  const cerrar = () => {
    setAbierto(false);
    setEditando(null);
    setError(null);
  };

  const onGuardar = async (e: FormEvent) => {
    e.preventDefault();
    const problema = validar(form);
    if (problema) {
      setError(problema);
      return;
    }
    setGuardando(true);
    setError(null);

    const input: FacturaCompraInput = {
      empresa: form.empresa,
      numero_factura: form.numero_factura,
      concepto: form.concepto,
      valor: form.valor,
      fecha_recibida: form.fecha_recibida,
      fecha_pago: form.fecha_pago || null,
      estado: form.estado,
      notas: form.notas,
    };

    const res = editando
      ? await actualizarFacturaCompra(editando.id, input)
      : await crearFacturaCompra(input);

    setGuardando(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSuccess(editando ? "Factura de compra actualizada." : "Factura de compra registrada.");
    setAbierto(false);
    setEditando(null);
    router.refresh();
  };

  const marcarPagada = async (f: FacturaCompra) => {
    setError(null);
    const res = await actualizarFacturaCompra(f.id, {
      ...desdeFila(f),
      estado: "pagada",
      fecha_pago: hoy(),
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setSuccess(`"${f.empresa}" marcada como pagada.`);
    router.refresh();
  };

  const abrirAbono = (f: FacturaCompra) => {
    const saldo = Number(f.valor ?? 0) - Number(f.valor_abonado ?? 0);
    setAbonando(f);
    setMontoAbono(saldo > 0 ? saldo : 0);
    setError(null);
  };

  const cerrarAbono = () => {
    if (guardando) return;
    setAbonando(null);
    setMontoAbono(0);
    setError(null);
  };

  const onAbonar = async (e: FormEvent) => {
    e.preventDefault();
    if (!abonando) return;
    setGuardando(true);
    setError(null);
    const res = await registrarAbono(abonando.id, montoAbono);
    setGuardando(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSuccess(`Abono de ${formatCOP(montoAbono)} registrado a "${abonando.empresa}".`);
    setAbonando(null);
    setMontoAbono(0);
    router.refresh();
  };

  const onEliminar = async () => {
    if (!eliminando) return;
    setGuardando(true);
    setError(null);
    const res = await eliminarFacturaCompra(eliminando.id);
    setGuardando(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSuccess(`"${eliminando.empresa}" eliminada.`);
    setEliminando(null);
    router.refresh();
  };

  const badge = (estado: string) =>
    ESTADO_COMPRA_BADGE[estado] ?? "bg-slate-100 text-slate-600";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Compras"
        subtitle="Facturas de proveedor, pagos y pendientes del negocio."
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Receipt className="h-5 w-5" />
          </span>
        }
      />
      {success ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
      ) : null}
      {error && !abierto && !eliminando && !abonando ? (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por empresa, número o concepto..."
            className={`${inputCls} pl-9`}
          />
        </div>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoCompra | "todas")}
          className={`${inputCls} w-auto`}
        >
          <option value="todas">Todos los estados</option>
          {Object.entries(ESTADOS_COMPRA).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <ExportCsvButton filename="facturas-compra" onExport={exportarComprasCSV} />
          <button type="button" onClick={abrirNuevo} className={`${btnPrimario} flex items-center gap-1.5`}>
            <Plus className="h-4 w-4" /> Nueva factura
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { etiqueta: "Total recibido", valor: resumen.total, clase: "text-slate-900" },
          { etiqueta: "Pendiente de pago", valor: resumen.pendiente, clase: "text-amber-700" },
          { etiqueta: "Pagado", valor: resumen.pagado, clase: "text-emerald-700" },
        ].map((c) => (
          <div key={c.etiqueta} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.etiqueta}</p>
            <p className={`mt-1 text-xl font-bold ${c.clase}`}>{formatCOP(c.valor)}</p>
          </div>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center">
          <Receipt className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">Sin facturas de compra</p>
          <p className="mt-1 text-xs text-slate-500">
            {filas.length === 0
              ? "Registra la primera con el botón «Nueva factura»."
              : "Ningún registro coincide con el filtro actual."}
          </p>
        </div>
      ) : null}

      {/* Vista móvil */}
      <div className="grid gap-3 md:hidden">
        {filtradas.map((f) => {
          const ve = vencimientoDe(f);
          const pendiente = f.estado === "pendiente" || f.estado === "parcial";
          return (
          <div
            key={f.id}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              pendiente && ve.vencida
                ? "border-rose-200"
                : pendiente && ve.porVencer
                  ? "border-amber-200"
                  : "border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="truncate font-bold text-slate-900">{f.empresa}</h4>
                  {pendiente && ve.vencida && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                  {pendiente && ve.porVencer && <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {f.numero_factura ? `#${f.numero_factura} · ` : ""}
                  {f.concepto || "Sin concepto"}
                </p>
              </div>
              <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${badge(f.estado)}`}>
                {ESTADOS_COMPRA[f.estado]}
              </span>
            </div>
            <p className="mt-3 text-lg font-bold text-slate-900">{formatCOP(Number(f.valor))}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
              <span>Recibida: {f.fecha_recibida}</span>
              <span>{pendiente && f.fecha_pago ? "Vence" : "Pago"}: {f.fecha_pago ?? "—"}</span>
              {pendiente ? (
                <span className={`font-semibold ${ve.vencida ? "text-rose-600" : ve.porVencer ? "text-amber-600" : "text-slate-500"}`}>
                  {textoVencimiento(ve)}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {pendiente ? (
                <button
                  type="button"
                  onClick={() => abrirAbono(f)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700"
                >
                  Abonar
                </button>
              ) : null}
              {pendiente ? (
                <button
                  type="button"
                  onClick={() => marcarPagada(f)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" /> Marcar pagada
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => abrirEdicion(f)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <Edit2 className="h-4 w-4" /> Editar
              </button>
              <button
                type="button"
                onClick={() => setEliminando(f)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600"
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {/* Vista desktop */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Empresa</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Valor</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Recibida</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Vence / pago</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Estado</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.map((f) => {
              const pendiente = f.estado === "pendiente" || f.estado === "parcial";
              const ve = vencimientoDe(f);
              const abonado = Number(f.valor_abonado ?? 0);
              const saldo = Number(f.valor ?? 0) - abonado;
              const filaCls =
                pendiente && ve.vencida
                  ? "bg-rose-50/40"
                  : pendiente && ve.porVencer
                    ? "bg-amber-50/40"
                    : "hover:bg-slate-50/50";
              return (
                <tr key={f.id} className={`${filaCls} transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-slate-900">{f.empresa}</p>
                      {pendiente && ve.vencida && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                      {pendiente && ve.porVencer && <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {f.numero_factura ? `#${f.numero_factura}` : "—"}
                      {f.concepto ? ` · ${f.concepto}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {formatCOP(Number(f.valor))}
                    {abonado > 0 && f.estado !== "pagada" ? (
                      <span className="mt-0.5 block text-[11px] font-medium text-sky-600">
                        abonado {formatCOP(abonado)} · saldo {formatCOP(saldo)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {f.fecha_recibida}
                    {pendiente ? (
                      <span
                        className={`ml-2 text-xs ${
                          ve.vencida
                            ? "font-semibold text-rose-600"
                            : ve.porVencer
                              ? "font-semibold text-amber-600"
                              : "text-slate-500"
                        }`}
                      >
                        {textoVencimiento(ve)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{f.fecha_pago ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-lg px-2 py-1 text-xs font-bold ${badge(f.estado)}`}>
                      {ESTADOS_COMPRA[f.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {pendiente ? (
                        <button
                          type="button"
                          onClick={() => abrirAbono(f)}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                        >
                          Abonar
                        </button>
                      ) : null}
                      {pendiente ? (
                        <button
                          type="button"
                          onClick={() => marcarPagada(f)}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Pagada
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => abrirEdicion(f)}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEliminando(f)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal crear / editar */}
      {abierto ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !guardando) cerrar();
          }}
        >
          <DialogContent className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto p-5 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {editando ? "Editar factura de compra" : "Nueva factura de compra"}
              </h3>
            </div>

            {error ? (
              <p role="alert" className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <form onSubmit={onGuardar} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`${labelCls} sm:col-span-2`}>
                  <span>Empresa *</span>
                  <EmpresaAutocomplete
                    value={form.empresa}
                    onChange={(v) => setForm({ ...form, empresa: v })}
                    sugerencias={sugerencias}
                    placeholder="Ej: Distribuidora Andina"
                    required
                    className={inputCls}
                  />
                </label>

                <label className={labelCls}>
                  <span>Número de factura</span>
                  <input
                    value={form.numero_factura}
                    onChange={(e) => setForm({ ...form, numero_factura: e.target.value })}
                    className={inputCls}
                  />
                </label>

                <label className={labelCls}>
                  <span>Concepto</span>
                  <input
                    value={form.concepto}
                    onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                    placeholder="Ej: Mercancía, servicio, arriendo"
                    className={inputCls}
                  />
                </label>

                <label className={labelCls}>
                  <span>Valor *</span>
                  <NumberField
                    value={form.valor}
                    min={0}
                    onChange={(v) => setForm({ ...form, valor: v })}
                    required
                    className={`${inputCls} text-right`}
                  />
                </label>

                <label className={labelCls}>
                  <span>Estado</span>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoCompra })}
                    className={inputCls}
                  >
                    {Object.entries(ESTADOS_COMPRA).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>{etiqueta}</option>
                    ))}
                  </select>
                </label>

                <label className={labelCls}>
                  <span>Fecha de recibida *</span>
                  <input
                    type="date"
                    value={form.fecha_recibida}
                    onChange={(e) => setForm({ ...form, fecha_recibida: e.target.value })}
                    required
                    className={inputCls}
                  />
                </label>

                <label className={labelCls}>
                  <span>Fecha de pago (plazo)</span>
                  <input
                    type="date"
                    value={form.fecha_pago}
                    onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })}
                    className={inputCls}
                  />
                  <span className="block text-[11px] font-normal text-slate-400">
                    Fecha límite para considerarla al día. Vacía = 30 días después de recibida.
                  </span>
                </label>

                <label className={`${labelCls} sm:col-span-2`}>
                  <span>Notas</span>
                  <textarea
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    rows={3}
                    className={inputCls}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={cerrar}
                  disabled={guardando}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className={btnPrimario}>
                  {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Registrar factura"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Modal abono */}
      {abonando ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) cerrarAbono();
          }}
        >
          <DialogContent className="w-full max-w-md space-y-4 p-5 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Registrar abono</h3>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-bold text-slate-900">{abonando.empresa}</p>
              <div className="mt-1 flex justify-between text-xs text-slate-600">
                <span>Total</span>
                <span className="tabular-nums">{formatCOP(Number(abonando.valor))}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Abonado</span>
                <span className="tabular-nums">{formatCOP(Number(abonando.valor_abonado ?? 0))}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs font-bold text-slate-900">
                <span>Saldo</span>
                <span className="tabular-nums">
                  {formatCOP(Number(abonando.valor) - Number(abonando.valor_abonado ?? 0))}
                </span>
              </div>
            </div>

            {error ? (
              <p role="alert" className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <form onSubmit={onAbonar} className="space-y-3">
              <label className={labelCls}>
                <span>Monto del abono *</span>
                <NumberField
                  value={montoAbono}
                  min={0}
                  onChange={setMontoAbono}
                  required
                  className={`${inputCls} text-right`}
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={cerrarAbono}
                  disabled={guardando}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className={btnPrimario}>
                  {guardando ? "Registrando..." : "Registrar abono"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Confirmar eliminación */}
      {eliminando ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !guardando) setEliminando(null);
          }}
        >
          <AlertDialogContent className="max-w-sm sm:rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar factura de compra</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Eliminar la factura de <span className="font-medium text-foreground">{eliminando.empresa}</span> por{" "}
                <span className="font-medium text-foreground tabular-nums">{formatCOP(Number(eliminando.valor))}</span>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠️ Esta acción es permanente y queda registrada en la auditoría.
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={guardando} className="rounded-lg">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={guardando}
                onClick={(e) => {
                  e.preventDefault();
                  void onEliminar();
                }}
                className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {guardando ? "Eliminando…" : "Sí, eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
