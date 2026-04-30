import type { FacturaConDetalle } from "@/lib/types";

type TicketProps = {
  factura: FacturaConDetalle;
  printMode?: boolean;
};

export function Ticket({ factura, printMode = false }: TicketProps) {
  return (
    <article id={printMode ? "print-root" : undefined} className="ticket-width bg-white p-2 text-[8px] leading-tight">
      <header className="border-b border-dashed border-black pb-1 text-center">
        <p className="text-[14px] font-bold">Mi Negocio</p>
        <p>Dirección del negocio</p>
        <p>Tel: 0000000000</p>
      </header>

      <section className="border-b border-dashed border-black py-1">
        <p>Factura: #{factura.numero_factura}</p>
        <p>Fecha: {new Date(factura.created_at).toLocaleString()}</p>
        <p>
          Cliente: {factura.cliente.nombre} · {factura.cliente.identificacion}
        </p>
      </section>

      <section className="border-b border-dashed border-black py-1">
        {factura.items.map((item) => (
          <div key={item.id} className="mb-1">
            <p className="font-semibold">{item.producto.nombre}</p>
            <p>
              {item.cantidad} x ${Number(item.precio_unitario).toFixed(2)} | Desc: {item.tipo_descuento_item} {Number(item.descuento_item).toFixed(2)}
            </p>
            <p>Subtotal item: ${Number(item.subtotal_item).toFixed(2)}</p>
          </div>
        ))}
      </section>

      <section className="py-1">
        <p>Subtotal: ${Number(factura.subtotal).toFixed(2)}</p>
        <p>Descuento global: ${Number(factura.descuento_total).toFixed(2)}</p>
        <p className="text-[11px] font-bold">TOTAL: ${Number(factura.total).toFixed(2)}</p>
        <p>Vendedor: {factura.vendedor.nombre}</p>
      </section>

      <footer className="pt-1 text-center">
        <p>Gracias por su compra</p>
      </footer>
    </article>
  );
}
