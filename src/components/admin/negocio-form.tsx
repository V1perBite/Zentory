"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Negocio } from "@/lib/types";

type NegocioFormProps = {
  negocio: Negocio;
};

export function NegocioForm({ negocio }: NegocioFormProps) {
  const supabase = createClient();
  const [nombre, setNombre] = useState(negocio.nombre);
  const [direccion, setDireccion] = useState(negocio.direccion ?? "");
  const [telefono, setTelefono] = useState(negocio.telefono ?? "");
  const [nit, setNit] = useState(negocio.nit ?? "");
  const [mensaje, setMensaje] = useState(negocio.mensaje_agradecimiento);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const { error: updateError } = await supabase
      .from("negocio")
      .update({
        nombre: nombre.trim(),
        direccion: direccion.trim() || null,
        telefono: telefono.trim() || null,
        nit: nit.trim() || null,
        mensaje_agradecimiento: mensaje.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", negocio.id);

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {success ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Datos guardados correctamente.</p>
      ) : null}
      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-600">
          <span>Nombre del negocio *</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <label className="space-y-1 text-xs text-slate-600">
          <span>NIT</span>
          <input
            value={nit}
            onChange={(e) => setNit(e.target.value)}
            placeholder="900.123.456-7"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
        </label>

        <label className="space-y-1 text-xs text-slate-600">
          <span>Teléfono</span>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+57 300 000 0000"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
        </label>

        <label className="space-y-1 text-xs text-slate-600">
          <span>Dirección</span>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Calle 10 #5-23, Bogotá"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
        </label>

        <label className="col-span-full space-y-1 text-xs text-slate-600">
          <span>Mensaje de agradecimiento en tickets</span>
          <input
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Gracias por su compra"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || !nombre.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-slate-800"
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
