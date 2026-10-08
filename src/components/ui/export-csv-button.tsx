"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { descargarCsv } from "@/lib/csv";
import { registrarExportacionReporte } from "@/app/actions/auditoria";

export type ExportCsvResult = {
  csv?: string;
  filename?: string;
  error?: string;
};

type ExportCsvButtonProps = {
  /** Nombre por defecto del archivo (sin extensión). */
  filename: string;
  /** Genera el CSV. Puede devolver `{ error }` en vez de lanzar. */
  onExport: () => ExportCsvResult | Promise<ExportCsvResult>;
  /** Código del reporte; si se pasa, la exportación queda en auditoría. */
  auditar?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function ExportCsvButton({
  filename,
  onExport,
  auditar,
  label = "Exportar CSV",
  disabled = false,
  className = "flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60",
}: ExportCsvButtonProps) {
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setExportando(true);
    setError(null);
    try {
      const res = await onExport();
      if (res.error || !res.csv) {
        setError(res.error ?? "No se pudo generar el archivo.");
        return;
      }
      descargarCsv(res.filename ?? filename, res.csv);
      if (auditar) {
        const total = Math.max(0, res.csv.split("\r\n").length - 1);
        void registrarExportacionReporte(auditar, total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el archivo.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || exportando}
        className={className}
      >
        <Download className="h-4 w-4" />
        {exportando ? "Generando…" : label}
      </button>
      {error ? (
        <p className="text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
