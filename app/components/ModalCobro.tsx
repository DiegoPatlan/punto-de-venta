"use client";

import { useEffect, useState } from "react";

interface ClienteCredito {
    id: string;
    nombre: string;
    limite_credito: number;
    saldo_credito: number;
}

interface ModalCobroProps {
    abierto: boolean;
    total: number;
    clienteSeleccionado?: ClienteCredito | null;
    onCerrar: () => void;
    onConfirmar: (
        metodoPago:
            | "efectivo"
            | "tarjeta"
            | "transferencia"
            | "mixto"
            | "credito",
        montoPagado: number,
        pagoMixto?: {
            efectivo: number;
            tarjeta: number;
        }
    ) => void;
}

export default function ModalCobro({
    abierto,
    total,
    clienteSeleccionado = null,
    onCerrar,
    onConfirmar,
}: ModalCobroProps) {
    const [metodoPago, setMetodoPago] = useState<
        | "efectivo"
        | "tarjeta"
        | "transferencia"
        | "mixto"
        | "credito"
    >("efectivo");

    const [montoPagado, setMontoPagado] = useState("");

    const [montoEfectivoMixto, setMontoEfectivoMixto] =
        useState("");

    useEffect(() => {
        if (abierto) {
            setMetodoPago("efectivo");
            setMontoPagado("0");
            setMontoEfectivoMixto("");
        }
    }, [abierto, total]);

    if (!abierto) {
        return null;
    }

    const montoNumerico =
        montoPagado === ""
            ? 0
            : Number(montoPagado);

    const efectivoMixto =
        montoEfectivoMixto === ""
            ? 0
            : Number(montoEfectivoMixto);

    /*
     * En pago mixto:
     *
     * El cajero únicamente captura cuánto recibe
     * en efectivo.
     *
     * La tarjeta se calcula automáticamente.
     */
    const tarjetaMixto = Math.max(
        total - efectivoMixto,
        0
    );

    const totalMixto =
        efectivoMixto + tarjetaMixto;

    const faltanteMixto = Math.max(
        total - totalMixto,
        0
    );

    /*
     * CAMBIO EFECTIVO
     */
    const cambio = Math.max(
        montoNumerico - total,
        0
    );

    /*
     * CRÉDITO
     */
    const limiteCredito = Number(
        clienteSeleccionado?.limite_credito ?? 0
    );

    const saldoCredito = Number(
        clienteSeleccionado?.saldo_credito ?? 0
    );

    const creditoDisponible = Math.max(
        limiteCredito - saldoCredito,
        0
    );

    /*
     * VALIDAR COBRO
     */
    let puedeConfirmar = false;

    if (metodoPago === "efectivo") {
        puedeConfirmar =
            Number.isFinite(montoNumerico) &&
            montoNumerico >= total;
    }

    if (
        metodoPago === "tarjeta" ||
        metodoPago === "transferencia"
    ) {
        puedeConfirmar = true;
    }

    if (metodoPago === "mixto") {
        /*
         * El efectivo debe ser mayor que 0
         * y menor que el total.
         *
         * La tarjeta se calcula automáticamente.
         */
        puedeConfirmar =
            Number.isFinite(efectivoMixto) &&
            efectivoMixto > 0 &&
            efectivoMixto < total &&
            Math.abs(totalMixto - total) < 0.01;
    }

    if (metodoPago === "credito") {
        puedeConfirmar =
            clienteSeleccionado !== null &&
            total <= creditoDisponible;
    }

    /*
     * CONFIRMAR
     */
    function confirmar() {
        if (!puedeConfirmar) {
            return;
        }

        if (metodoPago === "mixto") {
            onConfirmar(
                "mixto",
                efectivoMixto,
                {
                    efectivo: efectivoMixto,
                    tarjeta: tarjetaMixto,
                }
            );

            return;
        }

        onConfirmar(
            metodoPago,
            metodoPago === "efectivo"
                ? montoNumerico
                : total
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-6 shadow-2xl">

                {/* ENCABEZADO */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--color-text)]">
                            Cobrar venta
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Selecciona el método de pago.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onCerrar}
                        className="rounded-lg px-3 py-2 text-lg text-[var(--color-text-secondary)] transition hover:bg-slate-100"
                    >
                        ✕
                    </button>
                </div>

                {/* TOTAL */}
                <div className="mt-6 rounded-2xl bg-blue-50 p-5 text-center">
                    <p className="text-sm font-medium text-blue-700">
                        Total a pagar
                    </p>

                    <p className="mt-1 text-4xl font-bold text-blue-900">
                        ${total.toFixed(2)}
                    </p>
                </div>

                {/* MÉTODO DE PAGO */}
                <div className="mt-6">
                    <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">
                        Método de pago
                    </p>

                    <div className="grid grid-cols-3 gap-2">

                        {/* EFECTIVO */}
                        <button
                            type="button"
                            onClick={() =>
                                setMetodoPago("efectivo")
                            }
                            className={`rounded-xl border p-3 text-sm font-semibold transition ${metodoPago === "efectivo"
                                ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                                : "border-[var(--color-border)] hover:bg-slate-50"
                                }`}
                        >
                            💵

                            <span className="mt-1 block text-xs">
                                Efectivo
                            </span>
                        </button>

                        {/* TARJETA */}
                        <button
                            type="button"
                            onClick={() =>
                                setMetodoPago("tarjeta")
                            }
                            className={`rounded-xl border p-3 text-sm font-semibold transition ${metodoPago === "tarjeta"
                                ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                                : "border-[var(--color-border)] hover:bg-slate-50"
                                }`}
                        >
                            💳

                            <span className="mt-1 block text-xs">
                                Tarjeta
                            </span>
                        </button>

                        {/* TRANSFERENCIA */}
                        <button
                            type="button"
                            onClick={() =>
                                setMetodoPago("transferencia")
                            }
                            className={`rounded-xl border p-3 text-sm font-semibold transition ${metodoPago === "transferencia"
                                ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                                : "border-[var(--color-border)] hover:bg-slate-50"
                                }`}
                        >
                            🏦

                            <span className="mt-1 block text-xs">
                                Transferencia
                            </span>
                        </button>

                        {/* MIXTO */}
                        <button
                            type="button"
                            onClick={() =>
                                setMetodoPago("mixto")
                            }
                            className={`rounded-xl border p-3 text-sm font-semibold transition ${metodoPago === "mixto"
                                ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                                : "border-[var(--color-border)] hover:bg-slate-50"
                                }`}
                        >
                            🔀

                            <span className="mt-1 block text-xs">
                                Mixto
                            </span>
                        </button>

                        {/* CRÉDITO */}
                        <button
                            type="button"
                            onClick={() =>
                                setMetodoPago("credito")
                            }
                            className={`rounded-xl border p-3 text-sm font-semibold transition ${metodoPago === "credito"
                                ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                                : "border-[var(--color-border)] hover:bg-slate-50"
                                }`}
                        >
                            💰

                            <span className="mt-1 block text-xs">
                                Crédito
                            </span>
                        </button>
                    </div>
                </div>

                {/* EFECTIVO */}
                {metodoPago === "efectivo" && (
                    <div className="mt-5">
                        <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                            Efectivo recibido
                        </label>

                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                                $
                            </span>

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={montoPagado}
                                onFocus={() => {
                                    if (montoPagado === "0") {
                                        setMontoPagado("");
                                    }
                                }}
                                onChange={(e) =>
                                    setMontoPagado(
                                        e.target.value
                                    )
                                }
                                placeholder="0.00"
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-8 pr-4 text-lg font-semibold outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100"
                            />
                        </div>

                        {/* CAMBIO */}
                        <div className="mt-3 flex items-center justify-between rounded-xl bg-green-50 p-3">
                            <span className="text-sm font-medium text-green-700">
                                Cambio
                            </span>

                            <span className="text-lg font-bold text-green-800">
                                ${cambio.toFixed(2)}
                            </span>
                        </div>
                    </div>
                )}

                {/* MIXTO */}
                {metodoPago === "mixto" && (
                    <div className="mt-5 space-y-4">

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                Efectivo
                            </label>

                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                                    $
                                </span>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={montoEfectivoMixto}
                                    onChange={(e) =>
                                        setMontoEfectivoMixto(
                                            e.target.value
                                        )
                                    }
                                    placeholder="0.00"
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-8 pr-4 text-lg font-semibold outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        {/* TARJETA CALCULADA */}
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                Tarjeta
                            </label>

                            <div className="rounded-xl border border-[var(--color-border)] bg-slate-50 px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                        Monto con tarjeta
                                    </span>

                                    <span className="text-lg font-bold text-[var(--color-text)]">
                                        ${tarjetaMixto.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* RESUMEN MIXTO */}
                        <div className="rounded-xl bg-slate-50 p-3">
                            <div className="flex justify-between text-sm">
                                <span>
                                    Efectivo
                                </span>

                                <span className="font-bold">
                                    ${efectivoMixto.toFixed(2)}
                                </span>
                            </div>

                            <div className="mt-2 flex justify-between text-sm">
                                <span>
                                    Tarjeta
                                </span>

                                <span className="font-bold">
                                    ${tarjetaMixto.toFixed(2)}
                                </span>
                            </div>

                            <div className="mt-2 flex justify-between border-t pt-2 text-sm">
                                <span className="font-semibold">
                                    Total
                                </span>

                                <span className="font-bold">
                                    ${totalMixto.toFixed(2)}
                                </span>
                            </div>

                            {faltanteMixto > 0 && (
                                <div className="mt-2 flex justify-between text-sm text-red-600">
                                    <span>
                                        Faltante
                                    </span>

                                    <span className="font-bold">
                                        ${faltanteMixto.toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {puedeConfirmar && (
                                <div className="mt-2 rounded-lg bg-green-50 p-2 text-center text-sm font-semibold text-green-700">
                                    ✓ Pago completo
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* CRÉDITO */}
                {metodoPago === "credito" && (
                    <div className="mt-5">

                        {clienteSeleccionado ? (
                            <>
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">

                                    <p className="text-sm font-semibold text-blue-900">
                                        {clienteSeleccionado.nombre}
                                    </p>

                                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">

                                        <div>
                                            <p className="text-xs text-blue-700">
                                                Límite
                                            </p>

                                            <p className="font-bold text-blue-900">
                                                ${limiteCredito.toFixed(2)}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-blue-700">
                                                Saldo
                                            </p>

                                            <p className="font-bold text-blue-900">
                                                ${saldoCredito.toFixed(2)}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-blue-700">
                                                Disponible
                                            </p>

                                            <p className="font-bold text-green-700">
                                                ${creditoDisponible.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className={`mt-3 rounded-xl p-3 text-sm ${total <= creditoDisponible
                                        ? "bg-green-50 text-green-700"
                                        : "bg-red-50 text-red-700"
                                        }`}
                                >
                                    {total <= creditoDisponible
                                        ? "✓ El cliente tiene crédito suficiente para esta venta."
                                        : "✕ El crédito disponible es insuficiente para esta venta."
                                    }
                                </div>
                            </>
                        ) : (
                            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                                Debes seleccionar un cliente para realizar una venta a crédito.
                            </div>
                        )}
                    </div>
                )}

                {/* BOTONES */}
                <div className="mt-6 grid grid-cols-2 gap-3">

                    <button
                        type="button"
                        onClick={onCerrar}
                        className="rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-slate-50"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        disabled={!puedeConfirmar}
                        onClick={confirmar}
                        className="rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Confirmar cobro
                    </button>
                </div>
            </div>
        </div>
    );
}