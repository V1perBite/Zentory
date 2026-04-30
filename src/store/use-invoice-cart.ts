"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { calcFacturaTotals, type CartItemInput } from "@/lib/invoice-calculations";
import { TIPO_DESCUENTO } from "@/lib/constants";

type CartState = {
  items: CartItemInput[];
  descuentoGlobalTipo: "porcentaje" | "valor";
  descuentoGlobalValor: number;
  hasHydrated: boolean;
  addOrIncrementItem: (item: Omit<CartItemInput, "cantidad" | "descuentoItem" | "tipoDescuentoItem">) => void;
  updateItem: (productoId: string, patch: Partial<CartItemInput>) => void;
  removeItem: (productoId: string) => void;
  setDescuentoGlobalTipo: (tipo: "porcentaje" | "valor") => void;
  setDescuentoGlobalValor: (valor: number) => void;
  clear: () => void;
  markHydrated: (value: boolean) => void;
};

const initialState = {
  items: [],
  descuentoGlobalTipo: TIPO_DESCUENTO.VALOR,
  descuentoGlobalValor: 0,
  hasHydrated: false,
};

export const useInvoiceCart = create<CartState>()(
  persist(
    (set, get) => ({
      ...initialState,
      addOrIncrementItem: (item) => {
        const existing = get().items.find((row) => row.productoId === item.productoId);

        if (existing) {
          set({
            items: get().items.map((row) =>
              row.productoId === item.productoId
                ? { ...row, cantidad: row.cantidad + 1 }
                : row,
            ),
          });
          return;
        }

        set({
          items: [
            ...get().items,
            {
              ...item,
              cantidad: 1,
              descuentoItem: 0,
              tipoDescuentoItem: TIPO_DESCUENTO.VALOR,
            },
          ],
        });
      },
      updateItem: (productoId, patch) => {
        set({
          items: get().items.map((row) =>
            row.productoId === productoId
              ? {
                  ...row,
                  ...patch,
                  cantidad: Math.max(1, Number(patch.cantidad ?? row.cantidad)),
                  descuentoItem: Math.max(0, Number(patch.descuentoItem ?? row.descuentoItem)),
                }
              : row,
          ),
        });
      },
      removeItem: (productoId) => {
        set({ items: get().items.filter((row) => row.productoId !== productoId) });
      },
      setDescuentoGlobalTipo: (tipo) => set({ descuentoGlobalTipo: tipo }),
      setDescuentoGlobalValor: (valor) => set({ descuentoGlobalValor: Math.max(0, Number(valor)) }),
      clear: () => set({ ...initialState, hasHydrated: true }),
      markHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "zentory-invoice-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        descuentoGlobalTipo: state.descuentoGlobalTipo,
        descuentoGlobalValor: state.descuentoGlobalValor,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated(true);
      },
    },
  ),
);

export function useInvoiceTotals() {
  const items = useInvoiceCart((state) => state.items);
  const descuentoGlobalTipo = useInvoiceCart((state) => state.descuentoGlobalTipo);
  const descuentoGlobalValor = useInvoiceCart((state) => state.descuentoGlobalValor);

  return calcFacturaTotals(items, descuentoGlobalTipo, descuentoGlobalValor);
}
