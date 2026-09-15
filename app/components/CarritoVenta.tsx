"use client";

import { ProductoVenta } from "./BuscadorProductos";

export interface ItemCarrito {
    producto: ProductoVenta;
    cantidad: number;
}

interface CarritoVentaProps {
    items: ItemCarrito[];
    onAumentar: (productoId: string) => void;
    onDisminuir: (productoId: string) => void;
    onEliminar: (productoId: string) => void;
    onCobrar: () => void;
}

export default function CarritoVenta({
    items,
    onAumentar,
    onDisminuir,
    onEliminar,
    onCobrar,
}: CarritoVentaProps) {
    const subtotal = items.reduce(
        (total, item) =>
            total +
            item.producto.precio_venta *
            item.cantidad,
        0
    );

    const total = subtotal;

    return (
        <div className="flex h-full flex-col">
            {/* ENCABEZADO */}
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">
                    Carrito
                </h2>

                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {items.length === 0
                        ? "No hay productos"
                        : `${items.length} producto${items.length === 1
                            ? ""
                            : "s"
                        } `}
                </p>
            </div>

            {/* PRODUCTOS */}
            <div className="min-h-[250px] flex-1">
                {items.length === 0 ? (
                    <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-slate-50 p-6 text-center">
                        <div>
                            <div className="text-4xl">
                                🛒
                            </div>

                            <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">
                                El carrito está vacío
                            </p>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Agrega productos para comenzar.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => {
                            const producto =
                                item.producto;

                            const importe =
                                producto.precio_venta *
                                item.cantidad;

                            return (
                                <div
                                    key={producto.id}
                                    className="rounded-xl border border-[var(--color-border)] p-3"
                                >
                                    <div className="flex justify-between gap-3">
                                        {/* FOTO + INFORMACIÓN */}
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            {/* FOTO */}
                                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-slate-50">
                                                {producto.imagen_url ? (
                                                    <img
                                                        src={producto.imagen_url}
                                                        alt={producto.nombre}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-xl text-slate-300">
                                                        📦
                                                    </div>
                                                )}
                                            </div>

                                            {/* INFORMACIÓN */}
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                                                    {producto.nombre}
                                                </p>

                                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                    $
                                                    {producto.precio_venta.toFixed(
                                                        2
                                                    )}{" "}
                                                    c/u
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                onEliminar(
                                                    producto.id
                                                )
                                            }
                                            className="text-xs font-medium text-red-600 hover:text-red-800"
                                        >
                                            Eliminar
                                        </button>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="flex items-center rounded-lg border border-[var(--color-border)]">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onDisminuir(
                                                        producto.id
                                                    )
                                                }
                                                className="px-3 py-1.5 text-lg font-semibold hover:bg-slate-50"
                                            >
                                                −
                                            </button>

                                            <span className="min-w-[40px] text-center text-sm font-semibold">
                                                {item.cantidad}
                                            </span>

                                            <button
                                                type="button"
                                                disabled={
                                                    item.cantidad >=
                                                    producto.stock
                                                }
                                                onClick={() =>
                                                    onAumentar(
                                                        producto.id
                                                    )
                                                }
                                                className="px-3 py-1.5 text-lg font-semibold hover:bg-slate-50 disabled:opacity-30"
                                            >
                                                +
                                            </button>
                                        </div>

                                        <p className="text-sm font-bold text-[var(--color-text)]">
                                            $
                                            {importe.toFixed(
                                                2
                                            )}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* TOTALES */}
            <div className="mt-5 border-t border-[var(--color-border)] pt-5">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">
                        Subtotal
                    </span>

                    <span className="text-sm font-semibold">
                        ${subtotal.toFixed(2)}
                    </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                    <span className="text-base font-semibold text-[var(--color-text)]">
                        Total
                    </span>

                    <span className="text-2xl font-bold text-[var(--color-text)]">
                        ${total.toFixed(2)}
                    </span>
                </div>

                <button
                    type="button"
                    disabled={items.length === 0}
                    onClick={onCobrar}
                    className="mt-4 w-full rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Cobrar venta
                </button>
            </div>
        </div>
    );
}