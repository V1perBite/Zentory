import type { FacturaConDetalle, Negocio } from "@/lib/types";
import { formatCOP } from "@/lib/invoice-calculations";

type TicketProps = {
  factura: FacturaConDetalle;
  negocio?: Negocio | null;
  printMode?: boolean;
};

export function Ticket({ factura, negocio, printMode = false }: TicketProps) {
  return (
    <article id={printMode ? "print-root" : undefined} className="ticket-width bg-white p-2 text-[8px] leading-tight">
      <header className="border-b border-dashed border-black pb-1 text-center">
        <p className="text-[14px] font-bold">{negocio?.nombre ?? "Mi Negocio"}</p>
        {negocio?.direccion ? <p>{negocio.direccion}</p> : null}
        {negocio?.telefono ? <p>Tel: {negocio.telefono}</p> : null}
        {negocio?.nit ? <p>NIT: {negocio.nit}</p> : null}
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
              {item.cantidad} x {formatCOP(Number(item.precio_unitario))}
            </p>
            {Number(item.descuento_item) > 0 ? (
              <p>Desc. ({item.tipo_descuento_item}): {Number(item.descuento_item).toFixed(item.tipo_descuento_item === "porcentaje" ? 1 : 0)}{item.tipo_descuento_item === "porcentaje" ? "%" : ""}</p>
            ) : null}
            <p>Subtotal: {formatCOP(Number(item.subtotal_item))}</p>
          </div>
        ))}
      </section>

      <section className="py-1">
        <p>Subtotal: {formatCOP(Number(factura.subtotal))}</p>
        {Number(factura.descuento_total) > 0 ? (
          <p>Descuento: {formatCOP(Number(factura.descuento_total))}</p>
        ) : null}
        <p className="text-[11px] font-bold">TOTAL: {formatCOP(Number(factura.total))}</p>
        <p>Vendedor: {factura.vendedor.nombre}</p>
      </section>

      <footer className="pt-1 text-center">
        <p>{negocio?.mensaje_agradecimiento ?? "Gracias por su compra"}</p>
      </footer>
    </article>
  );
}
