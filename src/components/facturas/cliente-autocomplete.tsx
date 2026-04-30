"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ClienteSugerencia = {
  id: string;
  nombre: string;
  identificacion: string;
  nit: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
};

type ClienteAutocompleteProps = {
  onSelect: (cliente: ClienteSugerencia) => void;
  nombre: string;
  onNombreChange: (v: string) => void;
  identificacion: string;
  onIdentificacionChange: (v: string) => void;
  nit: string;
  onNitChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
  telefono: string;
  onTelefonoChange: (v: string) => void;
  direccion: string;
  onDireccionChange: (v: string) => void;
};

export function ClienteAutocomplete({
  onSelect,
  nombre,
  onNombreChange,
  identificacion,
  onIdentificacionChange,
  nit,
  onNitChange,
  email,
  onEmailChange,
  telefono,
  onTelefonoChange,
  direccion,
  onDireccionChange,
}: ClienteAutocompleteProps) {
  const supabase = useRef(createClient());
  const [sugerencias, setSugerencias] = useState<ClienteSugerencia[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = identificacion.trim();
    if (query.length < 2) {
      setSugerencias([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const { data } = await supabase.current
        .from("clientes")
        .select("id,nombre,identificacion,nit,email,telefono,direccion")
        .or(`identificacion.ilike.%${query}%,nombre.ilike.%${query}%,nit.ilike.%${query}%`)
        .limit(6);
      setSugerencias((data as ClienteSugerencia[]) ?? []);
      setShowDropdown(true);
    }, 300);

    return () => clearTimeout(timeout);
  }, [identificacion]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs text-slate-600">
        <span>Nombre *</span>
        <input
          value={nombre}
          onChange={(e) => onNombreChange(e.target.value)}
          placeholder="Nombre cliente"
          required
          className="w-full rounded-md border-2 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
        />
      </label>

      <div ref={containerRef} className="relative space-y-1">
        <label className="block text-xs text-slate-600">
          <span>Identificación *</span>
          <input
            value={identificacion}
            onChange={(e) => { onIdentificacionChange(e.target.value); setShowDropdown(true); }}
            onFocus={() => sugerencias.length > 0 && setShowDropdown(true)}
            placeholder="CC / NIT / CE"
            required
            className="mt-1 w-full rounded-md border-2 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
          />
        </label>

        {showDropdown && sugerencias.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-30 mt-0.5 rounded-md border border-slate-200 bg-white shadow-lg">
            {sugerencias.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                  onClick={() => {
                    onSelect(s);
                    setShowDropdown(false);
                  }}
                >
                  <span className="font-medium">{s.nombre}</span>
                  <span className="ml-2 text-slate-500">{s.identificacion}</span>
                  {s.nit ? <span className="ml-1 text-slate-400">· NIT {s.nit}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <label className="space-y-1 text-xs text-slate-600">
        <span>NIT (opcional)</span>
        <input
          value={nit}
          onChange={(e) => onNitChange(e.target.value)}
          placeholder="NIT empresa"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        />
      </label>

      <label className="space-y-1 text-xs text-slate-600">
        <span>Correo electrónico (opcional)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="correo@ejemplo.com"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        />
      </label>

      <label className="space-y-1 text-xs text-slate-600">
        <span>Teléfono (opcional)</span>
        <input
          value={telefono}
          onChange={(e) => onTelefonoChange(e.target.value)}
          placeholder="Teléfono"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        />
      </label>

      <label className="space-y-1 text-xs text-slate-600">
        <span>Dirección (opcional)</span>
        <input
          value={direccion}
          onChange={(e) => onDireccionChange(e.target.value)}
          placeholder="Dirección"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none"
        />
      </label>
    </div>
  );
}
