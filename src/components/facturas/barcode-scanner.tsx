"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

type BarcodeScannerProps = {
  onDetected: (skuCode: string) => void;
};

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !videoRef.current) return;

    const codeReader = new BrowserMultiFormatReader();
    let cancelled = false;
    let controls: { stop: () => void } | undefined;

    void codeReader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, scanError) => {
        if (result && !cancelled) {
          onDetected(result.getText());
        }

        if (scanError && !String(scanError.message).toLowerCase().includes("not found")) {
          setError(scanError.message);
        }
      })
      .then((value) => {
        controls = value;
      })
      .catch((scanError) => setError(scanError.message));

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [enabled, onDetected]);

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Escáner de código de barras</p>
        <button
          type="button"
          onClick={() => setEnabled((value) => !value)}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <span aria-hidden>{enabled ? "🛑" : "📷"}</span>
          {enabled ? "Detener cámara" : "Activar cámara"}
        </button>
      </div>

      {enabled ? (
        <video ref={videoRef} className="h-56 w-full rounded-md bg-black object-cover" muted />
      ) : (
        <div className="h-12 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Activa la cámara para escanear.
        </div>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
