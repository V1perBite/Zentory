/** Par [titulo de columna, clave del objeto]. */
export type ColumnaCsv = readonly [titulo: string, clave: string];

function escalar(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

/**
 * Serializa filas a CSV con BOM UTF-8 y saltos \r\n, para que Excel abra
 * los acentos correctamente. Todas las cillas van entre comillas dobles
 * con las comillas internas escapadas.
 */
export function aCsv<T extends object>(
  filas: ReadonlyArray<T>,
  columnas: readonly ColumnaCsv[],
): string {
  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lineas = [columnas.map(([titulo]) => celda(titulo)).join(",")];

  for (const fila of filas) {
    const registro = fila as Record<string, unknown>;
    lineas.push(columnas.map(([, clave]) => celda(escalar(registro[clave]))).join(","));
  }

  return `﻿${lineas.join("\r\n")}`;
}

/** Dispara la descarga de un archivo de texto en el navegador. */
export function descargarCsv(filename: string, contenido: string): void {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Sello de tiempo apto para nombre de archivo: 2026-10-06-12-30-45 */
export function marcaArchivo(d: Date = new Date()): string {
  return d.toISOString().slice(0, 19).replace(/[:T]/g, "-");
}
