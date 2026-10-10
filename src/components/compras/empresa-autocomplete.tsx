"use client";

import { useId, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

type EmpresaAutocompleteProps = {
  value: string;
  onChange: (v: string) => void;
  sugerencias: string[];
  id?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

function filtrar(sugerencias: string[], valor: string): string[] {
  const q = valor.trim().toLowerCase();
  return sugerencias
    .filter((s) => s.toLowerCase() !== q)
    .filter((s) => !q || s.toLowerCase().includes(q))
    .slice(0, 6);
}

/**
 * Autocompletado de empresa con Popover (portal a body): funciona con touch
 * en iOS Safari, a diferencia de `<datalist>` que Safari en iPhone no soporta.
 * Siempre permite escribir un valor libre.
 */
export function EmpresaAutocomplete({
  value,
  onChange,
  sugerencias,
  id,
  placeholder,
  required,
  className,
}: EmpresaAutocompleteProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activo, setActivo] = useState(0);

  const filtradas = filtrar(sugerencias, value);

  const seleccionar = (empresa: string) => {
    onChange(empresa);
    setOpen(false);
    setActivo(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && filtradas.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActivo((i) => (i + 1) % filtradas.length);
    } else if (e.key === "ArrowUp" && filtradas.length > 0) {
      e.preventDefault();
      setActivo((i) => (i - 1 + filtradas.length) % filtradas.length);
    } else if (e.key === "Enter" && open && filtradas[activo]) {
      e.preventDefault();
      seleccionar(filtradas[activo]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <input
          id={id}
          value={value}
          onChange={(e) => {
            const lista = filtrar(sugerencias, e.target.value);
            onChange(e.target.value);
            setActivo(0);
            setOpen(lista.length > 0);
          }}
          onFocus={() => {
            setActivo(0);
            setOpen(filtrar(sugerencias, value).length > 0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtradas[activo] ? `${listId}-${activo}` : undefined
          }
          className={className}
        />
      </PopoverAnchor>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popper-anchor-width)] max-h-60 overflow-y-auto p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          aria-label="Empresas usadas"
          className="space-y-0.5"
        >
          {filtradas.map((s, i) => (
            <li key={s} id={`${listId}-${i}`} role="option" aria-selected={i === activo}>
              <button
                type="button"
                // mantiene el foco en el input mientras se elige una opción
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActivo(i)}
                onClick={() => seleccionar(s)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  i === activo ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{s}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
