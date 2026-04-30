"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { createClient } from "@/lib/supabase/client";
import { FACTURA_ESTADOS } from "@/lib/constants";
import type { FacturaConDetalle } from "@/lib/types";
import { Ticket } from "@/components/printing/ticket";

export function PrintCenter() {
  const supabase = useRef(createClient());
  const ticketRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const [currentFactura, setCurrentFactura] = useState<FacturaConDetalle | null>(null);
  const [status, setStatus] = useState("Escuchando facturas pendientes...");

  const printNow = useReactToPrint({
    content: () => ticketRef.current,
    removeAfterPrint: false,
  });

  const getFacturaById = useCallback(async (facturaId: string) => {
    const { data, error } = await supabase.current
      .from("facturas")
      .select(
        "id,numero_factura,cliente_id,vendedor_id,subtotal,descuento_total,total,estado,created_at,cliente:clientes(id,nombre,identificacion,telefono,direccion),vendedor:usuarios(id,nombre),items:items_factura(id,factura_id,producto_id,cantidad,precio_unitario,descuento_item,tipo_descuento_item,subtotal_item,producto:productos(nombre,sku_code))",
      )
      .eq("id", facturaId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as unknown as FacturaConDetalle;
  }, []);

  const markPrinted = useCallback(async (facturaId: string) => {
    await supabase.current.rpc("marcar_factura_impresa", { p_factura_id: facturaId });
  }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current) {
      return;
    }

    processingRef.current = true;
    const nextId = queueRef.current.shift();
    if (!nextId) {
      processingRef.current = false;
      return;
    }

    const factura = await getFacturaById(nextId);
    if (!factura) {
      processingRef.current = false;
      return;
    }

    setCurrentFactura(factura);
    setStatus(`Imprimiendo factura #${factura.numero_factura}`);

    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      await printNow?.();
      await markPrinted(factura.id);
      setStatus(`Factura #${factura.numero_factura} impresa.`);
    } catch {
      queueRef.current.unshift(factura.id);
      setStatus(`No se pudo imprimir la factura #${factura.numero_factura}. Queda pendiente.`);
    }

    processingRef.current = false;

    setTimeout(() => {
      void processNext();
    }, 150);
  }, [getFacturaById, markPrinted, printNow]);

  useEffect(() => {
    const client = supabase.current;

    const enqueue = (id: string) => {
      if (!queueRef.current.includes(id)) {
        queueRef.current.push(id);
      }
      void processNext();
    };

    const loadBacklog = async () => {
      const { data } = await client
        .from("facturas")
        .select("id")
        .eq("estado", FACTURA_ESTADOS.PENDIENTE_IMPRESION)
        .order("created_at", { ascending: true })
        .limit(100);

      (data ?? []).forEach((row) => enqueue(row.id));
    };

    void loadBacklog();

    const channel = client
      .channel("facturas-pendientes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "facturas",
          filter: `estado=eq.${FACTURA_ESTADOS.PENDIENTE_IMPRESION}`,
        },
        (payload) => {
          enqueue(payload.new.id as string);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
      processingRef.current = false;
    };
  }, [processNext]);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Centro de impresión</h1>
        <p className="text-sm text-slate-600">Esta pestaña procesa facturas pendientes automáticamente.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{status}</div>

      <div ref={ticketRef}>
        {currentFactura ? (
          <Ticket factura={currentFactura} printMode />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Sin facturas para imprimir.
          </div>
        )}
      </div>
    </section>
  );
}
