"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [sugerencias, setSugerencias] = useState<ClienteSugerencia[]>([]);
  const [open, setOpen] = useState(false);
  const [activo, setActivo] = useState(0);

  useEffect(() => {
    const query = identificacion.trim();
    if (query.length < 2) {
      setSugerencias([]);
      setOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      const { data } = await supabase.current
        .from("clientes")
        .select("id,nombre,identificacion,nit,email,telefono,direccion")
        .or(`identificacion.ilike.%${query}%,nombre.ilike.%${query}%,nit.ilike.%${query}%`)
        .limit(6);

      const lista = (data as ClienteSugerencia[]) ?? [];
      setSugerencias(lista);
      setActivo(0);
      setOpen(lista.length > 0);
    }, 300);

    return () => clearTimeout(timeout);
  }, [identificacion]);

  useEffect(() => {
    if (!open || activo < 0) return;
    const el = document.getElementById(`${listId}-${activo}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activo, open, listId]);

  const seleccionar = (cliente: ClienteSugerencia) => {
    onSelect(cliente);
    setOpen(false);
    setActivo(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && sugerencias.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActivo((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp" && sugerencias.length > 0) {
      e.preventDefault();
      setActivo((i) => (i - 1 + sugerencias.length) % sugerencias.length);
    } else if (e.key === "Enter" && open && sugerencias[activo]) {
      e.preventDefault();
      seleccionar(sugerencias[activo]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const inputBase =
    "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="cliente-nombre" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nombre *
        </Label>
        <Input
          id="cliente-nombre"
          value={nombre}
          onChange={(e) => onNombreChange(e.target.value)}
          placeholder="Nombre del cliente"
          required
          autoComplete="off"
          className={inputBase}
        />
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="space-y-1.5">
            <Label htmlFor="cliente-identificacion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Identificación *
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                id="cliente-identificacion"
                value={identificacion}
                onChange={(e) => onIdentificacionChange(e.target.value)}
                onFocus={() => sugerencias.length > 0 && setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="CC / NIT / CE"
                required
                role="combobox"
                aria-expanded={open}
                aria-controls={`${listId}-listbox`}
                aria-autocomplete="list"
                aria-activedescendant={open && activo >= 0 ? `${listId}-${activo}` : undefined}
                aria-describedby={`${listId}-hint`}
                autoComplete="off"
                className={cn(inputBase, "pl-9")}
              />
            </div>
            <span id={`${listId}-hint`} className="sr-only">
              Escribe al menos 2 caracteres para buscar un cliente existente. Usa las flechas para navegar y Enter para seleccionar.
            </span>
          </div>
        </PopoverAnchor>

        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="w-[var(--radix-popper-anchor-width)] max-h-64 overflow-y-auto p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ul id={`${listId}-listbox`} role="listbox" aria-label="Clientes encontrados" className="space-y-0.5">
            {sugerencias.map((s, i) => (
              <li key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === activo}>
                <button
                  type="button"
                  // mantiene el foco en el input mientras se elige una opción
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => seleccionar(s)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                    i === activo ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-popover-foreground">{s.nombre}</span>
                    <span className="block truncate text-xs text-muted-foreground tabular-nums">
                      {s.identificacion}
                      {s.nit ? ` · NIT ${s.nit}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <div className="space-y-1.5">
        <Label htmlFor="cliente-nit" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          NIT (opcional)
        </Label>
        <Input
          id="cliente-nit"
          value={nit}
          onChange={(e) => onNitChange(e.target.value)}
          placeholder="NIT de la empresa"
          autoComplete="off"
          className={inputBase}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cliente-email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Correo electrónico (opcional)
        </Label>
        <Input
          id="cliente-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="correo@ejemplo.com"
          autoComplete="off"
          className={inputBase}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cliente-telefono" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Teléfono (opcional)
        </Label>
        <Input
          id="cliente-telefono"
          value={telefono}
          onChange={(e) => onTelefonoChange(e.target.value)}
          placeholder="Teléfono"
          autoComplete="off"
          className={inputBase}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cliente-direccion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dirección (opcional)
        </Label>
        <Input
          id="cliente-direccion"
          value={direccion}
          onChange={(e) => onDireccionChange(e.target.value)}
          placeholder="Dirección"
          autoComplete="off"
          className={inputBase}
        />
      </div>
    </div>
  );
}
