import Link from "next/link";

export default function FacturasPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Facturas</h1>
        <p className="text-sm text-slate-600">Genera facturas con carrito, escaneo y descuentos.</p>
      </div>

      <Link
        href="/facturas/nueva"
        className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Nueva factura
      </Link>
    </section>
  );
}
