"use client";

import { useEffect, useState } from "react";

interface ClienteCredito {
    id: string;
    nombre: string;
    limite_credito: number;
    saldo_credito: number;
}

interface DatosRecargoTarjeta {
    activo: boolean;
    porcentaje: number;
    montoBase: number;
    montoRecargo: number;
    montoTarjetaFinal: number;
    clienteAcepto: boolean;
}

interface ModalCobroProps {
    abierto: boolean;
    total: number;
    clienteSeleccionado?: ClienteCredito | null;

    recargoTarjetaActivo: boolean;
    recargoTarjetaPorcentaje: number;

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
        },
        datosRecargo?: DatosRecargoTarjeta
    ) => void | Promise<void>;

    onMercadoPago?: (
        montoTarjeta: number
    ) => Promise<boolean>;
}

export default function ModalCobro({
    abierto,
    total,
    clienteSeleccionado = null,
    recargoTarjetaActivo,
    recargoTarjetaPorcentaje,
    onCerrar,
    onConfirmar,
    onMercadoPago,
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

    const [procesandoMercadoPago, setProcesandoMercadoPago] =
        useState(false);

    const [aceptaRecargoTarjeta, setAceptaRecargoTarjeta] =
        useState(false);

    useEffect(() => {
        if (abierto) {
            setMetodoPago("efectivo");
            setMontoPagado("0");
            setMontoEfectivoMixto("");
            setProcesandoMercadoPago(false);
            setAceptaRecargoTarjeta(false);
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

    const redondear = (valor: number) =>
        Math.round(
            (Number(valor) + Number.EPSILON) * 100
        ) / 100;

    /*
    ==========================================
    CONFIGURACIÓN RECARGO TARJETA
    ==========================================
    */

    const porcentajeRecargo =
        Number.isFinite(
            Number(recargoTarjetaPorcentaje)
        )
            ? Math.max(
                Number(recargoTarjetaPorcentaje),
                0
            )
            : 0;

    const recargoConfigurado =
        Boolean(recargoTarjetaActivo) &&
        porcentajeRecargo > 0;

    /*
    ==========================================
    PAGO TARJETA
    ==========================================
    */

    const recargoTarjeta = recargoConfigurado
        ? redondear(
            total *
            (porcentajeRecargo / 100)
        )
        : 0;

    const montoTarjetaFinal = redondear(
        total + recargoTarjeta
    );

    const requiereAceptacionTarjeta =
        recargoTarjeta > 0;

    /*
    ==========================================
    PAGO MIXTO
    ==========================================
    */

    const tarjetaMixto = Math.max(
        total - efectivoMixto,
        0
    );

    const recargoTarjetaMixto =
        recargoConfigurado
            ? redondear(
                tarjetaMixto *
                (porcentajeRecargo / 100)
            )
            : 0;

    const montoTarjetaMixtoFinal =
        redondear(
            tarjetaMixto +
            recargoTarjetaMixto
        );

    const totalMixto =
        efectivoMixto +
        tarjetaMixto;

    const totalMixtoConRecargo =
        redondear(
            efectivoMixto +
            montoTarjetaMixtoFinal
        );

    const faltanteMixto = Math.max(
        total - totalMixto,
        0
    );

    const requiereAceptacionMixto =
        recargoTarjetaMixto > 0;

    /*
    ==========================================
    CAMBIO EFECTIVO
    ==========================================
    */

    const cambio = Math.max(
        montoNumerico - total,
        0
    );

    /*
    ==========================================
    CRÉDITO
    ==========================================
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
    ==========================================
    VALIDAR COBRO
    ==========================================
    */

    let puedeConfirmar = false;

    if (metodoPago === "efectivo") {
        puedeConfirmar =
            Number.isFinite(montoNumerico) &&
            montoNumerico >= total;
    }

    if (metodoPago === "tarjeta") {
        puedeConfirmar =
            onMercadoPago !== undefined &&
            total > 0 &&
            (
                !requiereAceptacionTarjeta ||
                aceptaRecargoTarjeta
            );
    }

    if (metodoPago === "transferencia") {
        puedeConfirmar = true;
    }

    if (metodoPago === "mixto") {
        puedeConfirmar =
            Number.isFinite(efectivoMixto) &&
            efectivoMixto > 0 &&
            efectivoMixto < total &&
            Number.isFinite(tarjetaMixto) &&
            tarjetaMixto > 0 &&
            Math.abs(totalMixto - total) <
            0.01 &&
            onMercadoPago !== undefined &&
            (
                !requiereAceptacionMixto ||
                aceptaRecargoTarjeta
            );
    }

    if (metodoPago === "credito") {
        puedeConfirmar =
            clienteSeleccionado !== null &&
            total <= creditoDisponible;
    }

    /*
    ==========================================
    CONFIRMAR COBRO
    ==========================================
    */

    async function confirmar() {
        if (
            !puedeConfirmar ||
            procesandoMercadoPago
        ) {
            return;
        }

        /*
        ==========================================
        TARJETA - MERCADO PAGO
        ==========================================
        */

        if (metodoPago === "tarjeta") {
            if (!onMercadoPago) {
                return;
            }

            try {
                setProcesandoMercadoPago(true);

                const aprobado =
                    await onMercadoPago(
                        montoTarjetaFinal
                    );

                /*
                Si Mercado Pago no aprobó,
                NO registramos la venta.
                */

                if (!aprobado) {
                    return;
                }

                await onConfirmar(
                    "tarjeta",
                    total,
                    undefined,
                    {
                        activo:
                            recargoTarjeta > 0,

                        porcentaje:
                            porcentajeRecargo,

                        montoBase:
                            total,

                        montoRecargo:
                            recargoTarjeta,

                        montoTarjetaFinal:
                            montoTarjetaFinal,

                        clienteAcepto:
                            recargoTarjeta > 0
                                ? aceptaRecargoTarjeta
                                : false,
                    }
                );
            } catch (error) {
                console.error(
                    "Error en el flujo de Mercado Pago:",
                    error
                );

                setProcesandoMercadoPago(false);
            }

            return;
        }

        /*
        ==========================================
        PAGO MIXTO - MERCADO PAGO
        ==========================================
        */

        if (metodoPago === "mixto") {
            if (!onMercadoPago) {
                return;
            }

            try {
                setProcesandoMercadoPago(true);

                /*
                Mercado Pago recibe:

                tarjeta base + recargo.

                La venta en Supabase conserva:

                efectivo + tarjeta base = total venta.
                */

                const aprobado =
                    await onMercadoPago(
                        montoTarjetaMixtoFinal
                    );

                if (!aprobado) {
                    return;
                }

                await onConfirmar(
                    "mixto",
                    efectivoMixto,
                    {
                        efectivo:
                            efectivoMixto,

                        tarjeta:
                            tarjetaMixto,
                    },
                    {
                        activo:
                            recargoTarjetaMixto > 0,

                        porcentaje:
                            porcentajeRecargo,

                        montoBase:
                            tarjetaMixto,

                        montoRecargo:
                            recargoTarjetaMixto,

                        montoTarjetaFinal:
                            montoTarjetaMixtoFinal,

                        clienteAcepto:
                            recargoTarjetaMixto > 0
                                ? aceptaRecargoTarjeta
                                : false,
                    }
                );
            } catch (error) {
                console.error(
                    "Error en el flujo de pago mixto:",
                    error
                );

                setProcesandoMercadoPago(false);
            }

            return;
        }

        /*
        ==========================================
        RESTO DE MÉTODOS
        ==========================================
        */

        await onConfirmar(
            metodoPago,
            metodoPago === "efectivo"
                ? montoNumerico
                : total
        );
    }

    /*
    ==========================================
    CAMBIAR MÉTODO
    ==========================================
    */

    function cambiarMetodo(
        metodo:
            | "efectivo"
            | "tarjeta"
            | "transferencia"
            | "mixto"
            | "credito"
    ) {
        if (procesandoMercadoPago) {
            return;
        }

        setMetodoPago(metodo);
        setAceptaRecargoTarjeta(false);
    }

    function cerrarModal() {
        if (procesandoMercadoPago) {
            return;
        }

        onCerrar();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">
                <div className="min-h-0 flex-1 overflow-y-auto p-6">

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
                            onClick={cerrarModal}
                            disabled={
                                procesandoMercadoPago
                            }
                            className="rounded-lg px-3 py-2 text-lg text-[var(--color-text-secondary)] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            ✕
                        </button>
                    </div>

                    {/* TOTAL */}

                    <div className="mt-6 rounded-2xl bg-blue-50 p-5 text-center">
                        <p className="text-sm font-medium text-blue-700">
                            Total de la venta
                        </p>

                        <p className="mt-1 text-4xl font-bold text-blue-900">
                            ${total.toFixed(2)}
                        </p>

                        {(metodoPago === "tarjeta" ||
                            metodoPago === "mixto") &&
                            recargoConfigurado && (
                                <p className="mt-2 text-xs text-blue-700">
                                    El recargo se aplica
                                    únicamente a la parte
                                    pagada con tarjeta.
                                </p>
                            )}
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
                                disabled={
                                    procesandoMercadoPago
                                }
                                onClick={() =>
                                    cambiarMetodo(
                                        "efectivo"
                                    )
                                }
                                className={`rounded - xl border p - 3 text - sm font - semibold transition ${metodoPago ===
                                    "efectivo"
                                    ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                                    : "border-[var(--color-border)] hover:bg-slate-50"
                                    } disabled: cursor - not - allowed disabled: opacity - 50`}
                            >
                                💵

                                <span className="mt-1 block text-xs">
                                    Efectivo
                                </span>
                            </button>

                            {/* TARJETA */}

                            <button
                                type="button"
                                disabled={
                                    procesandoMercadoPago
                                }
                                onClick={() =>
                                    cambiarMetodo(
                                        "tarjeta"
                                    )
                                }
                                className={`rounded - xl border p - 3 text - sm font - semibold transition ${metodoPago ===
                                    "tarjeta"
                                    ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                                    : "border-[var(--color-border)] hover:bg-slate-50"
                                    } disabled: cursor - not - allowed disabled: opacity - 50`}
                            >
                                💳

                                <span className="mt-1 block text-xs">
                                    Tarjeta
                                </span>
                            </button>

                            {/* TRANSFERENCIA */}

                            <button
                                type="button"
                                disabled={
                                    procesandoMercadoPago
                                }
                                onClick={() =>
                                    cambiarMetodo(
                                        "transferencia"
                                    )
                                }
                                className={`rounded - xl border p - 3 text - sm font - semibold transition ${metodoPago ===
                                    "transferencia"
                                    ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                                    : "border-[var(--color-border)] hover:bg-slate-50"
                                    } disabled: cursor - not - allowed disabled: opacity - 50`}
                            >
                                🏦

                                <span className="mt-1 block text-xs">
                                    Transferencia
                                </span>
                            </button>

                            {/* MIXTO */}

                            <button
                                type="button"
                                disabled={
                                    procesandoMercadoPago
                                }
                                onClick={() =>
                                    cambiarMetodo(
                                        "mixto"
                                    )
                                }
                                className={`rounded - xl border p - 3 text - sm font - semibold transition ${metodoPago ===
                                    "mixto"
                                    ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                                    : "border-[var(--color-border)] hover:bg-slate-50"
                                    } disabled: cursor - not - allowed disabled: opacity - 50`}
                            >
                                🔀

                                <span className="mt-1 block text-xs">
                                    Mixto
                                </span>
                            </button>

                            {/* CRÉDITO */}

                            <button
                                type="button"
                                disabled={
                                    procesandoMercadoPago
                                }
                                onClick={() =>
                                    cambiarMetodo(
                                        "credito"
                                    )
                                }
                                className={`rounded - xl border p - 3 text - sm font - semibold transition ${metodoPago ===
                                    "credito"
                                    ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                                    : "border-[var(--color-border)] hover:bg-slate-50"
                                    } disabled: cursor - not - allowed disabled: opacity - 50`}
                            >
                                💰

                                <span className="mt-1 block text-xs">
                                    Crédito
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* TARJETA */}

                    {metodoPago === "tarjeta" && (
                        <div className="mt-5">
                            {!procesandoMercadoPago ? (
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">

                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl">
                                            💳
                                        </div>

                                        <div>
                                            <p className="text-sm font-semibold text-blue-900">
                                                Pago con Mercado Pago
                                            </p>

                                            <p className="mt-1 text-xs text-blue-700">
                                                El cobro se enviará a la terminal configurada.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2 rounded-lg bg-white/70 p-3">

                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-blue-700">
                                                Monto de la venta
                                            </span>

                                            <span className="font-semibold text-blue-900">
                                                ${total.toFixed(2)}
                                            </span>
                                        </div>

                                        {recargoConfigurado && (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-blue-700">
                                                        Recargo tarjeta (
                                                        {porcentajeRecargo.toFixed(
                                                            2
                                                        )}
                                                        %)
                                                    </span>

                                                    <span className="font-semibold text-blue-900">
                                                        $
                                                        {recargoTarjeta.toFixed(
                                                            2
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between border-t border-blue-100 pt-2">
                                                    <span className="text-sm font-bold text-blue-900">
                                                        Total a cobrar
                                                    </span>

                                                    <span className="text-lg font-bold text-blue-900">
                                                        $
                                                        {montoTarjetaFinal.toFixed(
                                                            2
                                                        )}
                                                    </span>
                                                </div>
                                            </>
                                        )}

                                        {!recargoConfigurado && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-blue-700">
                                                    Monto a cobrar
                                                </span>

                                                <span className="text-lg font-bold text-blue-900">
                                                    ${total.toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {requiereAceptacionTarjeta && (
                                        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    aceptaRecargoTarjeta
                                                }
                                                onChange={(e) =>
                                                    setAceptaRecargoTarjeta(
                                                        e.target.checked
                                                    )
                                                }
                                                disabled={
                                                    procesandoMercadoPago
                                                }
                                                className="mt-0.5 h-4 w-4 shrink-0"
                                            />

                                            <span className="text-xs leading-5 text-amber-900">
                                                El cliente acepta el recargo del{" "}
                                                <strong>
                                                    {porcentajeRecargo.toFixed(
                                                        2
                                                    )}
                                                    %
                                                </strong>{" "}
                                                por pago con tarjeta.
                                            </span>
                                        </label>
                                    )}

                                    <p className="mt-3 text-center text-xs text-blue-700">
                                        Al continuar, espera a que el cliente complete el pago.
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">

                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-2xl">
                                        💳
                                    </div>

                                    <p className="mt-3 text-base font-bold text-blue-900">
                                        Procesando pago
                                    </p>

                                    <p className="mt-1 text-sm text-blue-700">
                                        Esperando confirmación de Mercado Pago...
                                    </p>

                                    <div className="mt-4 rounded-lg bg-white/70 p-3">
                                        <p className="text-xs text-blue-700">
                                            Monto
                                        </p>

                                        <p className="mt-1 text-xl font-bold text-blue-900">
                                            $
                                            {montoTarjetaFinal.toFixed(
                                                2
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-blue-700">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                                        Esperando confirmación...
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

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
                                        if (
                                            montoPagado ===
                                            "0"
                                        ) {
                                            setMontoPagado(
                                                ""
                                            );
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
                                        value={
                                            montoEfectivoMixto
                                        }
                                        onChange={(e) =>
                                            setMontoEfectivoMixto(
                                                e.target.value
                                            )
                                        }
                                        placeholder="0.00"
                                        disabled={
                                            procesandoMercadoPago
                                        }
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-8 pr-4 text-lg font-semibold outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                    Tarjeta
                                </label>

                                <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-slate-50 px-4 py-3">

                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                            Monto de tarjeta
                                        </span>

                                        <span className="text-lg font-bold text-[var(--color-text)]">
                                            ${tarjetaMixto.toFixed(2)}
                                        </span>
                                    </div>

                                    {recargoConfigurado &&
                                        tarjetaMixto > 0 && (
                                            <>
                                                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                                        Recargo (
                                                        {porcentajeRecargo.toFixed(
                                                            2
                                                        )}
                                                        %)
                                                    </span>

                                                    <span className="font-semibold text-[var(--color-text)]">
                                                        $
                                                        {recargoTarjetaMixto.toFixed(
                                                            2
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                                                    <span className="text-sm font-bold text-[var(--color-text)]">
                                                        Tarjeta a cobrar
                                                    </span>

                                                    <span className="text-lg font-bold text-[var(--color-text)]">
                                                        $
                                                        {montoTarjetaMixtoFinal.toFixed(
                                                            2
                                                        )}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                </div>
                            </div>

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

                                {recargoConfigurado &&
                                    tarjetaMixto > 0 && (
                                        <div className="mt-2 flex justify-between text-sm">
                                            <span>
                                                Recargo tarjeta
                                            </span>

                                            <span className="font-bold">
                                                $
                                                {recargoTarjetaMixto.toFixed(
                                                    2
                                                )}
                                            </span>
                                        </div>
                                    )}

                                <div className="mt-2 flex justify-between border-t pt-2 text-sm">
                                    <span className="font-semibold">
                                        Total venta
                                    </span>

                                    <span className="font-bold">
                                        ${totalMixto.toFixed(2)}
                                    </span>
                                </div>

                                {recargoConfigurado &&
                                    tarjetaMixto > 0 && (
                                        <div className="mt-2 flex justify-between border-t pt-2 text-sm">
                                            <span className="font-semibold">
                                                Total cobrado
                                            </span>

                                            <span className="font-bold text-blue-700">
                                                $
                                                {totalMixtoConRecargo.toFixed(
                                                    2
                                                )}
                                            </span>
                                        </div>
                                    )}

                                {faltanteMixto > 0 && (
                                    <div className="mt-2 flex justify-between text-sm text-red-600">
                                        <span>
                                            Faltante
                                        </span>

                                        <span className="font-bold">
                                            $
                                            {faltanteMixto.toFixed(
                                                2
                                            )}
                                        </span>
                                    </div>
                                )}

                                {puedeConfirmar && (
                                    <div className="mt-2 rounded-lg bg-green-50 p-2 text-center text-sm font-semibold text-green-700">
                                        ✓ Pago completo
                                    </div>
                                )}
                            </div>

                            {requiereAceptacionMixto && (
                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                    <input
                                        type="checkbox"
                                        checked={
                                            aceptaRecargoTarjeta
                                        }
                                        onChange={(e) =>
                                            setAceptaRecargoTarjeta(
                                                e.target.checked
                                            )
                                        }
                                        disabled={
                                            procesandoMercadoPago
                                        }
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                    />

                                    <span className="text-xs leading-5 text-amber-900">
                                        El cliente acepta el recargo del{" "}
                                        <strong>
                                            {porcentajeRecargo.toFixed(
                                                2
                                            )}
                                            %
                                        </strong>{" "}
                                        sobre la parte pagada con tarjeta.
                                    </span>
                                </label>
                            )}

                            {puedeConfirmar &&
                                !procesandoMercadoPago && (
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
                                        <p className="text-sm font-semibold text-blue-900">
                                            💳 Se cobrará $
                                            {montoTarjetaMixtoFinal.toFixed(
                                                2
                                            )}{" "}
                                            con Mercado Pago
                                        </p>

                                        <p className="mt-1 text-xs text-blue-700">
                                            Primero se solicitará el pago con tarjeta y después se registrará la venta.
                                        </p>
                                    </div>
                                )}

                            {procesandoMercadoPago && (
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">

                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-2xl">
                                        💳
                                    </div>

                                    <p className="mt-3 text-base font-bold text-blue-900">
                                        Procesando pago con tarjeta
                                    </p>

                                    <p className="mt-1 text-sm text-blue-700">
                                        Esperando confirmación de Mercado Pago...
                                    </p>

                                    <div className="mt-3 rounded-lg bg-white/70 p-3">
                                        <p className="text-xs text-blue-700">
                                            Monto con tarjeta
                                        </p>

                                        <p className="mt-1 text-xl font-bold text-blue-900">
                                            $
                                            {montoTarjetaMixtoFinal.toFixed(
                                                2
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-blue-700">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                                        Esperando confirmación...
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CRÉDITO */}

                    {metodoPago === "credito" && (
                        <div className="mt-5">
                            {clienteSeleccionado ? (
                                <>
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">

                                        <p className="text-sm font-semibold text-blue-900">
                                            {
                                                clienteSeleccionado.nombre
                                            }
                                        </p>

                                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">

                                            <div>
                                                <p className="text-xs text-blue-700">
                                                    Límite
                                                </p>

                                                <p className="font-bold text-blue-900">
                                                    $
                                                    {limiteCredito.toFixed(
                                                        2
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-blue-700">
                                                    Saldo
                                                </p>

                                                <p className="font-bold text-blue-900">
                                                    $
                                                    {saldoCredito.toFixed(
                                                        2
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-blue-700">
                                                    Disponible
                                                </p>

                                                <p className="font-bold text-green-700">
                                                    $
                                                    {creditoDisponible.toFixed(
                                                        2
                                                    )}
                                                </p>
                                            </div>

                                        </div>
                                    </div>

                                    <div
                                        className={`mt - 3 rounded - xl p - 3 text - sm ${total <=
                                            creditoDisponible
                                            ? "bg-green-50 text-green-700"
                                            : "bg-red-50 text-red-700"
                                            } `}
                                    >
                                        {total <=
                                            creditoDisponible
                                            ? "✓ El cliente tiene crédito suficiente para esta venta."
                                            : "✕ El crédito disponible es insuficiente para esta venta."}
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                                    Debes seleccionar un cliente para realizar una venta a crédito.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* BOTONES */}

                <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-6 pt-4">
                    <div className="grid grid-cols-2 gap-3">

                        <button
                            type="button"
                            onClick={cerrarModal}
                            disabled={
                                procesandoMercadoPago
                            }
                            className="rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            disabled={
                                !puedeConfirmar ||
                                procesandoMercadoPago
                            }
                            onClick={confirmar}
                            className="rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {procesandoMercadoPago
                                ? "Procesando..."
                                : metodoPago ===
                                    "tarjeta"
                                    ? "Cobrar con Mercado Pago"
                                    : metodoPago ===
                                        "mixto"
                                        ? "Cobrar tarjeta y confirmar"
                                        : "Confirmar cobro"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}