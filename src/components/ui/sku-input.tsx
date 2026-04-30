"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

type SkuInputProps = {
  value: string;
  onChange: (value: string) => void;
  onDetected?: (skuCode: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
};

export function SkuInput({
  value,
  onChange,
  onDetected,
  placeholder = "Ej: ARZ-001",
  required = false,
  className = "",
  id,
}: SkuInputProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    const codeReader = new BrowserMultiFormatReader();
    let cancelled = false;
    let controls: { stop: () => void } | undefined;

    void codeReader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result && !cancelled) {
          const text = result.getText();
          onChange(text);
          onDetected?.(text);
          setScanning(false);
        }
        if (err && !String(err.message).toLowerCase().includes("not found")) {
          setScanError(err.message);
        }
      })
      .then((ctrl) => {
        controls = ctrl;
      })
      .catch((err) => setScanError(err.message));

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [scanning, onChange, onDetected]);

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full rounded border border-slate-300 py-1.5 pl-2 pr-9 text-sm focus:border-emerald-500 focus:outline-none ${className}`}
        />
        <button
          type="button"
          title="Escanear con cámara"
          onClick={() => { setScanError(null); setScanning((s) => !s); }}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 hover:text-emerald-600"
        >
          {scanning ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="7" width="3" height="10" rx="1" /><rect x="7" y="7" width="1" height="10" /><rect x="10" y="7" width="2" height="10" /><rect x="14" y="7" width="1" height="10" /><rect x="17" y="7" width="4" height="10" rx="1" />
            </svg>
          )}
        </button>
      </div>

      {scanning ? (
        <video ref={videoRef} className="h-40 w-full rounded-md bg-black object-cover" muted />
      ) : null}

      {scanError ? <p className="text-xs text-rose-600">{scanError}</p> : null}
    </div>
  );
}
