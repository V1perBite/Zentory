import type { FacturaConDetalle, Negocio } from "@/lib/types";
import { formatCOP } from "@/lib/invoice-calculations";

type TicketProps = {
  factura: FacturaConDetalle;
  negocio?: Negocio | null;
  printMode?: boolean;
};

export function Ticket({ factura, negocio, printMode = false }: TicketProps) {
  const encabezadoMensajes = [...(negocio?.negocio_mensajes ?? [])]
    .filter((m) => m.tipo === "encabezado")
    .sort((a, b) => a.orden - b.orden);
  const cierreMensajes = [...(negocio?.negocio_mensajes ?? [])]
    .filter((m) => m.tipo === "cierre")
    .sort((a, b) => a.orden - b.orden);

  return (
    <article id={printMode ? "print-root" : undefined} className="ticket-width bg-white p-2 text-[10px] leading-snug">
      <header className="border-b border-dashed border-black pb-2 text-center">
        <p className="text-[13px] font-bold">{negocio?.nombre ?? "Mi Negocio"}</p>
        {negocio?.direccion ? <p>{negocio.direccion}</p> : null}
        {negocio?.telefono ? <p>Tel: {negocio.telefono}</p> : null}
        {negocio?.email ? <p>Email: {negocio.email}</p> : null}
        {negocio?.nit ? <p>NIT: {negocio.nit}</p> : null}
        {encabezadoMensajes.length > 0 ? (
          <div className="mt-1 border-t border-dashed border-black pt-1">
            {encabezadoMensajes.map((linea) => (
              <p key={linea.id}>{linea.texto}</p>
            ))}
          </div>
        ) : null}
      </header>

      <section className="border-b border-dashed border-black py-2">
        <p className="text-[13px] font-bold">Factura: #{factura.numero_factura}</p>
        <p>Fecha: {new Date(factura.created_at).toLocaleString()}</p>
        <p>
          Cliente: {factura.cliente.nombre} · {factura.cliente.identificacion}
        </p>
      </section>

      <section className="border-b border-dashed border-black py-2">
        {factura.items.map((item) => (
          <div key={item.id} className="mb-2">
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

      <section className="border-b border-dashed border-black py-2">
        <p>Subtotal: {formatCOP(Number(factura.subtotal))}</p>
        {Number(factura.descuento_total) > 0 ? (
          <p>Descuento: {formatCOP(Number(factura.descuento_total))}</p>
        ) : null}
        <p className="text-[13px] font-bold">TOTAL: {formatCOP(Number(factura.total))}</p>
        <p>Vendedor: {factura.vendedor.nombre}</p>
      </section>

      <footer className="pt-2 text-center">
        {cierreMensajes.length > 0 ? (
          cierreMensajes.map((linea) => <p key={linea.id}>{linea.texto}</p>)
        ) : (
          <p>Gracias por su compra</p>
        )}
      </footer>
    </article>
  );
}
