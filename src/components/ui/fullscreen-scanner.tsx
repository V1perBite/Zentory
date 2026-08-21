"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, ZoomIn, ZoomOut, Zap, ZapOff, CheckCircle2 } from "lucide-react";

type FullscreenScannerProps = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

export function FullscreenScanner({ onDetected, onClose }: FullscreenScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successCode, setSuccessCode] = useState<string | null>(null);

  // Capabilities state
  const [zoomCapable, setZoomCapable] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [currentZoom, setCurrentZoom] = useState(1);
  const [torchCapable, setTorchCapable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Tap-to-focus animation state
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;

    async function initCamera() {
      try {
        let stream: MediaStream;
        try {
          // Attempt 1: 1080p with continuous focus
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              advanced: [{ focusMode: "continuous" } as any],
            },
            audio: false,
          });
        } catch (e) {
          // Attempt 2: Fallback if overconstrained (e.g., focusMode not supported)
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        }

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Require video to play so we can start decoding
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        trackRef.current = track;

        // Give the camera a moment to initialize its capabilities
        setTimeout(() => {
          if (!active) return;
          try {
            const caps = track.getCapabilities ? track.getCapabilities() : ({} as any);
            const settings = track.getSettings ? track.getSettings() : ({} as any);

            // Zoom support
            if (caps.zoom) {
              setZoomCapable(true);
              setZoomRange({
                min: caps.zoom.min || 1,
                max: caps.zoom.max || 3,
                step: caps.zoom.step || 0.1,
              });
              setCurrentZoom(settings.zoom || caps.zoom.min || 1);
            }

            // Torch support
            if (caps.torch) {
              setTorchCapable(true);
              setTorchOn(settings.torch || false);
            }

            // Attempt to apply continuous focus
            if (caps.focusMode && caps.focusMode.includes("continuous")) {
              track.applyConstraints({
                advanced: [{ focusMode: "continuous" } as any],
              }).catch(() => {});
            }
          } catch (e) {
            console.warn("Could not read track capabilities", e);
          }
        }, 500);

        // Start ZXing Reader
        readerRef.current = new BrowserMultiFormatReader();
        if (videoRef.current) {
          readerRef.current.decodeFromVideoElement(videoRef.current, (result, err) => {
            if (!active) return;
            if (result) {
              handleSuccess(result.getText());
            }
          });
        }
      } catch (err: any) {
        if (!active) return;
        setHasCamera(false);
        setErrorMsg(err.message || "No se pudo acceder a la cámara.");
      }
    }

    initCamera();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      active = false;
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    trackRef.current = null;
  };

  const handleSuccess = (code: string) => {
    if (successCode) return; // Prevent double detection
    setSuccessCode(code);
    cleanup();
    
    if (navigator.vibrate) {
      navigator.vibrate([100]);
    }

    setTimeout(() => {
      onDetected(code);
    }, 800); // 800ms to show the success checkmark
  };

  const handleZoomChange = async (newZoom: number) => {
    if (!trackRef.current || !zoomCapable) return;
    const clamped = Math.max(zoomRange.min, Math.min(zoomRange.max, newZoom));
    try {
      await trackRef.current.applyConstraints({
        advanced: [{ zoom: clamped } as any],
      });
      setCurrentZoom(clamped);
    } catch (e) {
      console.warn("Error applying zoom", e);
    }
  };

  const toggleTorch = async () => {
    if (!trackRef.current || !torchCapable) return;
    try {
      await trackRef.current.applyConstraints({
        advanced: [{ torch: !torchOn } as any],
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn("Error applying torch", e);
    }
  };

  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Show visual indicator at tap location
    setFocusPoint({ x, y });
    setTimeout(() => setFocusPoint(null), 1000);

    // Apply focus via constraints if supported
    if (!trackRef.current) return;
    try {
      const caps = trackRef.current.getCapabilities ? trackRef.current.getCapabilities() : ({} as any);
      if (caps.focusMode && (caps.focusMode.includes("single-shot") || caps.focusMode.includes("manual"))) {
        // Many browsers don't strictly implement pointsOfInterest correctly, but we can try
        await trackRef.current.applyConstraints({
          advanced: [
            {
              focusMode: "single-shot",
              pointsOfInterest: [{ x: x / rect.width, y: y / rect.height }],
            } as any,
          ],
        });
      }
    } catch (err) {
      console.warn("Tap to focus not fully supported by device", err);
    }
  };

  if (!hasCamera) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-6 text-center text-white">
        <p className="mb-4 text-rose-500">
          No podemos acceder a la cámara. Revisa los permisos de cámara de tu navegador.
        </p>
        <p className="mb-6 text-sm text-slate-400">{errorMsg}</p>
        <button
          onClick={onClose}
          className="rounded-lg bg-slate-800 px-6 py-3 font-semibold transition hover:bg-slate-700"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top Header */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
        <span className="text-sm font-medium text-white/90 drop-shadow-md">
          Escáner de código
        </span>
        <div className="flex gap-4">
          {torchCapable && (
            <button
              onClick={toggleTorch}
              className="rounded-full bg-black/40 p-2 text-white backdrop-blur-md transition hover:bg-black/60"
            >
              {torchOn ? <Zap className="h-5 w-5 text-yellow-400" /> : <ZapOff className="h-5 w-5" />}
            </button>
          )}
          <button
            onClick={() => { cleanup(); onClose(); }}
            className="rounded-full bg-black/40 p-2 text-white backdrop-blur-md transition hover:bg-black/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Camera Area */}
      <div className="relative flex-1 overflow-hidden" onClick={handleTapToFocus}>
        {/* The video element processes full resolution */}
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />

        {/* Visual Guide Overlay (Does not crop the actual video feed) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {/* Shaded border using massive box-shadow trick */}
          <div
            className="relative h-48 w-3/4 max-w-sm rounded-lg border-2 border-emerald-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-all"
          >
            {/* Scanline animation */}
            {!successCode && (
              <div className="absolute left-0 right-0 top-0 h-0.5 bg-emerald-400 opacity-70 animate-scanline shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
            )}
          </div>
        </div>

        {/* Tap to focus animation */}
        {focusPoint && (
          <div
            className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-white/80"
            style={{ left: focusPoint.x, top: focusPoint.y }}
          />
        )}

        {/* Success Overlay */}
        {successCode && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-900/90 text-white backdrop-blur-sm transition-all duration-300">
            <CheckCircle2 className="mb-4 h-16 w-16 text-emerald-400 animate-bounce" />
            <p className="text-xl font-bold">¡Código detectado!</p>
            <p className="mt-2 text-emerald-200">{successCode}</p>
          </div>
        )}
      </div>

      {/* Bottom Controls (Zoom) */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center bg-gradient-to-t from-black/90 to-transparent p-6 pb-10">
        <p className="mb-4 text-xs font-medium text-white/70 drop-shadow-md">
          Apunta al código para escanear
        </p>
        
        {zoomCapable && (
          <div className="flex w-full max-w-xs items-center justify-between rounded-full bg-black/60 px-4 py-2 backdrop-blur-md">
            <button
              onClick={(e) => { e.stopPropagation(); handleZoomChange(currentZoom - zoomRange.step); }}
              disabled={currentZoom <= zoomRange.min}
              className="p-3 text-white disabled:opacity-30"
            >
              <ZoomOut className="h-6 w-6" />
            </button>
            
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-white">{currentZoom.toFixed(1)}x</span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); handleZoomChange(currentZoom + zoomRange.step); }}
              disabled={currentZoom >= zoomRange.max}
              className="p-3 text-white disabled:opacity-30"
            >
              <ZoomIn className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
