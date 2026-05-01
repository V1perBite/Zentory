"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Negocio, NegocioMensaje } from "@/lib/types";

type NegocioFormProps = {
  negocio: Negocio;
};

export function NegocioForm({ negocio }: NegocioFormProps) {
  const supabase = createClient();
  const [nombre, setNombre] = useState(negocio.nombre);
  const [direccion, setDireccion] = useState(negocio.direccion ?? "");
  const [telefono, setTelefono] = useState(negocio.telefono ?? "");
  const [email, setEmail] = useState(negocio.email ?? "");
  const [nit, setNit] = useState(negocio.nit ?? "");
  const initialMensajes = [...(negocio.negocio_mensajes ?? [])].sort((a, b) => a.orden - b.orden);
  const [encabezadoMensajes, setEncabezadoMensajes] = useState<NegocioMensaje[]>(
    initialMensajes.filter((m) => m.tipo === "encabezado"),
  );
  const [cierreMensajes, setCierreMensajes] = useState<NegocioMensaje[]>(
    initialMensajes.filter((m) => m.tipo === "cierre"),
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeLines = (list: NegocioMensaje[], tipo: "encabezado" | "cierre") =>
    list
      .map((m, index) => ({
        id: m.id,
        negocio_id: negocio.id,
        tipo,
        orden: index + 1,
        texto: m.texto.trim(),
      }))
      .filter((m) => m.texto.length > 0);

  const addMensaje = (tipo: "encabezado" | "cierre") => {
    const setter = tipo === "encabezado" ? setEncabezadoMensajes : setCierreMensajes;
    setter((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        negocio_id: negocio.id,
        tipo,
        orden: current.length + 1,
        texto: "",
      },
    ]);
  };

  const updateMensaje = (tipo: "encabezado" | "cierre", id: string, texto: string) => {
    const setter = tipo === "encabezado" ? setEncabezadoMensajes : setCierreMensajes;
    setter((current) => current.map((m) => (m.id === id ? { ...m, texto } : m)));
  };

  const removeMensaje = (tipo: "encabezado" | "cierre", id: string) => {
    const setter = tipo === "encabezado" ? setEncabezadoMensajes : setCierreMensajes;
    setter((current) => current.filter((m) => m.id !== id));
  };

  const moveMensaje = (tipo: "encabezado" | "cierre", id: string, direction: -1 | 1) => {
    const setter = tipo === "encabezado" ? setEncabezadoMensajes : setCierreMensajes;
    setter((current) => {
      const index = current.findIndex((m) => m.id === id);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

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
        email: email.trim() || null,
        nit: nit.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", negocio.id);

    if (!updateError) {
      const { error: deleteError } = await supabase
        .from("negocio_mensajes")
        .delete()
        .eq("negocio_id", negocio.id);

      if (!deleteError) {
        const payload = [
          ...normalizeLines(encabezadoMensajes, "encabezado"),
          ...normalizeLines(cierreMensajes, "cierre"),
        ];
        if (payload.length > 0) {
          const { error: insertError } = await supabase.from("negocio_mensajes").insert(payload);
          if (insertError) {
            setLoading(false);
            setError(insertError.message);
            return;
          }
        }
      } else {
        setLoading(false);
        setError(deleteError.message);
        return;
      }
    }

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
          <span>Correo electrónico</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contacto@negocio.com"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none"
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

        <div className="col-span-full space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Mensajes de encabezado</p>
            <button
              type="button"
              onClick={() => addMensaje("encabezado")}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            >
              + Agregar línea
            </button>
          </div>
          {encabezadoMensajes.map((m, index) => (
            <div key={m.id} className="flex gap-2">
              <input
                value={m.texto}
                onChange={(e) => updateMensaje("encabezado", m.id, e.target.value)}
                placeholder="Ej: Síguenos en Instagram @mi_tienda"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => moveMensaje("encabezado", m.id, -1)} disabled={index === 0} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">↑</button>
              <button type="button" onClick={() => moveMensaje("encabezado", m.id, 1)} disabled={index === encabezadoMensajes.length - 1} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">↓</button>
              <button type="button" onClick={() => removeMensaje("encabezado", m.id)} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700">✕</button>
            </div>
          ))}
          {encabezadoMensajes.length === 0 ? <p className="text-xs text-slate-400">Sin líneas de encabezado.</p> : null}
        </div>

        <div className="col-span-full space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Mensajes de cierre</p>
            <button
              type="button"
              onClick={() => addMensaje("cierre")}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            >
              + Agregar línea
            </button>
          </div>
          {cierreMensajes.map((m, index) => (
            <div key={m.id} className="flex gap-2">
              <input
                value={m.texto}
                onChange={(e) => updateMensaje("cierre", m.id, e.target.value)}
                placeholder="Ej: Gracias por su compra"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => moveMensaje("cierre", m.id, -1)} disabled={index === 0} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">↑</button>
              <button type="button" onClick={() => moveMensaje("cierre", m.id, 1)} disabled={index === cierreMensajes.length - 1} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40">↓</button>
              <button type="button" onClick={() => removeMensaje("cierre", m.id)} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700">✕</button>
            </div>
          ))}
          {cierreMensajes.length === 0 ? <p className="text-xs text-slate-400">Sin líneas de cierre.</p> : null}
        </div>
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
