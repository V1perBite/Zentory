"use client";

export function ReporteError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      <p className="font-semibold">No se pudieron cargar los datos.</p>
      <p className="mt-1 break-all font-mono text-xs">{mensaje}</p>
    </div>
  );
}
