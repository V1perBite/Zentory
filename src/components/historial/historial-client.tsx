"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { anularFactura } from "@/app/actions/admin-facturas";
import { formatCOP } from "@/lib/invoice-calculations";
import {
  AlertTriangle,
  Calendar,
  Eye,
  FileText,
  Info,
  Search,
  Tag,
  User,
  XCircle,
} from "lucide-react";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ItemResumen = {
  nombre: string;
  cantidad: number;
  subtotal: number;
};

type FacturaRow = {
  id: string;
  numero_factura: number;
  subtotal: number;
  descuento_total: number;
  total: number;
  estado: string;
  created_at: string;
  cliente: string;
  vendedor: string;
  items: ItemResumen[];
  razon_anulacion?: string | null;
};

type HistorialClientProps = {
  facturas: FacturaRow[];
  isAdmin: boolean;
};

const ESTADO_BADGE: Record<string, string> = {
  pendiente_impresion: "border-amber-200 bg-amber-100 text-amber-700",
  impresa: "border-emerald-200 bg-emerald-100 text-emerald-700",
  anulada: "border-border bg-accent text-muted-foreground line-through",
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente_impresion: "Pendiente",
  impresa: "Impresa",
  anulada: "Anulada",
};

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", ESTADO_BADGE[estado])}>
      {ESTADO_LABEL[estado] ?? estado}
    </Badge>
  );
}

const TH = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export function HistorialClient({ facturas, isAdmin }: HistorialClientProps) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<FacturaRow | null>(null);
  const [razon, setRazon] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razonPanel, setRazonPanel] = useState<FacturaRow | null>(null);

  const handleAnular = async () => {
    if (!confirm) return;
    if (!razon.trim()) {
      setError("Debe indicar el motivo de anulación.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await anularFactura(confirm.id, razon.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setConfirm(null);
      setRazon("");
      router.refresh();
    }
  };

  return (
    <div className="space-y-3">
      <p aria-live="polite" className={cn(!error && "sr-only")}>
        {error ?? ""}
      </p>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      {/* Vista móvil (tarjetas) */}
      <div className="grid gap-3 md:hidden">
        {facturas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-4 py-12 text-center">
            <Search className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              No hay facturas con los filtros aplicados.
            </p>
          </div>
        ) : null}

        {facturas.map((f) => (
          <div
            key={f.id}
            className={cn(
              "overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft",
              f.estado === "anulada" && "bg-accent/40 opacity-70",
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <h4 className="font-bold text-foreground tabular-nums">
                    #{f.numero_factura}
                  </h4>
                  <EstadoBadge estado={f.estado} />
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="tabular-nums">
                    {new Date(f.created_at).toLocaleString("es-CO", {
                      timeZone: "America/Bogota",
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total
                </p>
                <p className="mt-0.5 text-lg font-bold leading-none text-primary tabular-nums">
                  {formatCOP(Number(f.total))}
                </p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Cliente</p>
                  <p className="truncate text-sm font-medium text-foreground">{f.cliente}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Vendedor</p>
                  <p className="truncate text-sm font-medium text-foreground">{f.vendedor}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                asChild
                variant="secondary"
                className="h-11 flex-1 rounded-xl text-sm font-semibold"
              >
                <Link href={`/historial/${f.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalle
                </Link>
              </Button>
              {isAdmin && f.estado === "anulada" && f.razon_anulacion ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRazonPanel(f)}
                  className="h-11 rounded-xl px-4 text-sm font-semibold"
                >
                  <Info className="mr-2 h-4 w-4" />
                  Razón
                </Button>
              ) : null}
              {isAdmin && f.estado !== "anulada" ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setError(null);
                    setConfirm(f);
                  }}
                  className="h-11 flex-1 rounded-xl text-sm font-semibold"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Anular
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Vista escritorio (tabla) */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-accent/60">
              <tr>
                <th className={TH}>N°</th>
                <th className={TH}>Fecha</th>
                <th className={TH}>Cliente</th>
                <th className={TH}>Vendedor</th>
                <th className={cn(TH, "text-right")}>Subtotal</th>
                <th className={cn(TH, "text-right")}>Desc.</th>
                <th className={cn(TH, "text-right")}>Total</th>
                <th className={TH}>Estado</th>
                <th className={cn(TH, "text-right")}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {facturas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    No hay facturas con los filtros aplicados.
                  </td>
                </tr>
              ) : null}
              {facturas.map((f) => (
                <tr
                  key={f.id}
                  className={cn(
                    "transition-colors hover:bg-accent/50",
                    f.estado === "anulada" && "opacity-50",
                  )}
                >
                  <td className="px-4 py-3 font-bold text-foreground tabular-nums">{f.numero_factura}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground tabular-nums">
                    {new Date(f.created_at).toLocaleString("es-CO", {
                      timeZone: "America/Bogota",
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{f.cliente}</td>
                  <td className="px-4 py-3 font-medium text-muted-foreground">{f.vendedor}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCOP(Number(f.subtotal))}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {formatCOP(Number(f.descuento_total))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-foreground tabular-nums">
                    {formatCOP(Number(f.total))}
                  </td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={f.estado} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild variant="outline" size="sm" className="h-9 rounded-lg">
                        <Link href={`/historial/${f.id}`}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver
                        </Link>
                      </Button>
                      {isAdmin && f.estado === "anulada" && f.razon_anulacion ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setRazonPanel(f)}
                          className="h-9 rounded-lg"
                        >
                          <Info className="mr-1.5 h-3.5 w-3.5" /> Razón
                        </Button>
                      ) : null}
                      {isAdmin && f.estado !== "anulada" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setError(null);
                            setConfirm(f);
                          }}
                          className="h-9 rounded-lg border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" /> Anular
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmación de anulación */}
      {confirm ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open && !loading) setConfirm(null);
          }}
        >
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Anular factura #{confirm.numero_factura}</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción restaurará el stock de los productos listados abajo.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-accent/40">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-accent/80">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Producto</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Cant.</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {confirm.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-foreground">{item.nombre}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{item.cantidad}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                        {formatCOP(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="razon-anulacion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Motivo de anulación *
              </Label>
              <Textarea
                id="razon-anulacion"
                value={razon}
                onChange={(e) => setRazon(e.target.value)}
                placeholder="Ej: Devolución por producto dañado…"
                rows={3}
                aria-invalid={razon.trim().length > 0 && razon.trim().length < 10}
                className="rounded-lg"
              />
              <div className="flex items-center justify-between gap-2 text-xs">
                {razon.trim().length > 0 && razon.trim().length < 10 ? (
                  <p className="font-medium text-rose-600">
                    Mínimo 10 caracteres ({razon.trim().length}/10)
                  </p>
                ) : (
                  <span />
                )}
                <p
                  className={cn(
                    "ml-auto tabular-nums",
                    razon.trim().length >= 10 ? "font-medium text-emerald-600" : "text-muted-foreground",
                  )}
                >
                  {razon.trim().length} caracteres
                </p>
              </div>
            </div>

            <div
              role={error ? "alert" : undefined}
              className={cn(
                "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs",
                error
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-amber-200 bg-amber-50 text-amber-800",
              )}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {error ? (
                  error
                ) : (
                  <>
                    Esta acción es irreversible. Total a devolver:{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCOP(Number(confirm.total))}
                    </span>
                  </>
                )}
              </span>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading} className="rounded-lg">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={loading || razon.trim().length < 10}
                onClick={(e) => {
                  e.preventDefault();
                  void handleAnular();
                }}
                className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loading ? "Anulando…" : "Confirmar anulación"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {/* Motivo de anulación registrado */}
      {razonPanel ? (
        <Dialog open onOpenChange={(open) => !open && setRazonPanel(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Motivo de anulación</DialogTitle>
              <DialogDescription className="tabular-nums">
                Factura #{razonPanel.numero_factura}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-900">{razonPanel.razon_anulacion}</p>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="rounded-lg">
                  Cerrar
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
