"use client";

import { useEffect, useState } from "react";

type NumberFieldProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  required?: boolean;
  placeholder?: string;
  className?: string;
  selectAllOnFocus?: boolean;
};

export function NumberField({
  value,
  onChange,
  min,
  step,
  required = false,
  placeholder,
  className,
  selectAllOnFocus = true,
}: NumberFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value));
    }
  }, [value, isFocused]);

  return (
    <input
      type="number"
      min={min}
      step={step}
      value={draft}
      required={required}
      placeholder={placeholder}
      onFocus={(e) => {
        setIsFocused(true);
        if (value === 0) {
          setDraft("");
        }
        if (selectAllOnFocus) {
          requestAnimationFrame(() => e.currentTarget.select());
        }
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (next.trim() === "") {
          return;
        }
        const parsed = Number(next);
        if (Number.isFinite(parsed)) {
          onChange(parsed);
        }
      }}
      onBlur={() => {
        setIsFocused(false);
        if (draft.trim() === "") {
          const fallback = typeof min === "number" && min > 0 ? min : 0;
          onChange(fallback);
          setDraft(String(fallback));
          return;
        }
        const parsed = Number(draft);
        if (Number.isFinite(parsed)) {
          onChange(parsed);
          setDraft(String(parsed));
        } else {
          setDraft(String(value));
        }
      }}
      className={className}
    />
  );
}
