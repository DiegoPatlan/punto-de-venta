"use client";

import { useEffect, useState } from "react";

import Card from "../../../components/Card";

import { supabase } from "../../../../lib/supabase";

import { obtenerUsuarioActual } from "../../../../lib/auth/roleGuard";

interface UsuarioActual {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

export default function FiscalPage() {
    const [impuestosActivos, setImpuestosActivos] =
        useState(false);

    const [ivaPorcentaje, setIvaPorcentaje] =
        useState(16);

    const [cargando, setCargando] =
        useState(true);

    const [guardando, setGuardando] =
        useState(false);

    const [error, setError] =
        useState("");

    const [mensajeExito, setMensajeExito] =
        useState("");

    /*
     * ==========================================
     * MODAL DE CONFIRMACIÓN
     * ==========================================
     */
    const [mostrarConfirmacion, setMostrarConfirmacion] =
        useState(false);

    const [estadoPendiente, setEstadoPendiente] =
        useState<boolean | null>(null);

    /*
     * ==========================================
     * CARGAR CONFIGURACIÓN
     * ==========================================
     */
    async function cargarConfiguracion() {
        setCargando(true);
        setError("");

        try {
            const usuario =
                (await obtenerUsuarioActual()) as
                | UsuarioActual
                | null;

            if (!usuario?.negocio_id) {
                setError(
                    "No se encontró el negocio del usuario."
                );
                return;
            }

            const {
                data,
                error: errorNegocio,
            } = await supabase
                .from("negocios")
                .select(
                    "impuestos_activos, iva_porcentaje"
                )
                .eq(
                    "id",
                    usuario.negocio_id
                )
                .single();

            if (errorNegocio) {
                console.error(
                    "Error cargando configuración:",
                    errorNegocio
                );

                setError(
                    "No se pudo cargar la configuración."
                );

                return;
            }

            setImpuestosActivos(
                data?.impuestos_activos ?? false
            );

            setIvaPorcentaje(
                Number(
                    data?.iva_porcentaje ?? 16
                )
            );
        } catch (error) {
            console.error(
                "Error inesperado:",
                error
            );

            setError(
                "Ocurrió un error al cargar la configuración."
            );
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargarConfiguracion();
    }, []);

    /*
     * ==========================================
     * ABRIR CONFIRMACIÓN
     * ==========================================
     */
    function solicitarCambioImpuestos(
        nuevoEstado: boolean
    ) {
        if (guardando) {
            return;
        }

        setError("");
        setMensajeExito("");
        setEstadoPendiente(nuevoEstado);
        setMostrarConfirmacion(true);
    }

    /*
     * ==========================================
     * CANCELAR CONFIRMACIÓN
     * ==========================================
     */
    function cancelarCambioImpuestos() {
        if (guardando) {
            return;
        }

        setMostrarConfirmacion(false);
        setEstadoPendiente(null);
    }

    /*
     * ==========================================
     * CAMBIAR IMPUESTOS
     * ==========================================
     */
    async function cambiarImpuestos(
        nuevoEstado: boolean
    ) {
        setError("");
        setMensajeExito("");
        setGuardando(true);

        try {
            const {
                error: errorRPC,
            } = await supabase.rpc(
                "actualizar_configuracion_fiscal",
                {
                    p_impuestos_activos:
                        nuevoEstado,
                }
            );

            if (errorRPC) {
                console.error(
                    "Error actualizando impuestos:",
                    errorRPC
                );

                setError(
                    errorRPC.message ||
                    "No se pudo actualizar la configuración."
                );

                return;
            }

            setImpuestosActivos(
                nuevoEstado
            );

            setMostrarConfirmacion(false);
            setEstadoPendiente(null);

            setMensajeExito(
                nuevoEstado
                    ? "Los impuestos fueron activados correctamente. Los precios de venta fueron actualizados aplicando el IVA."
                    : "Los impuestos fueron desactivados correctamente. Los precios de venta ahora utilizan nuevamente el precio base."
            );

            setTimeout(() => {
                setMensajeExito("");
            }, 5000);
        } catch (error) {
            console.error(
                "Error inesperado:",
                error
            );

            setError(
                "Ocurrió un error al actualizar la configuración."
            );
        } finally {
            setGuardando(false);
        }
    }

    /*
     * ==========================================
     * CONFIRMAR CAMBIO
     * ==========================================
     */
    function confirmarCambioImpuestos() {
        if (
            estadoPendiente === null ||
            guardando
        ) {
            return;
        }

        cambiarImpuestos(
            estadoPendiente
        );
    }

    /*
     * ==========================================
     * CERRAR MODAL
     * ==========================================
     */
    function cerrarModal() {
        if (guardando) {
            return;
        }

        setMostrarConfirmacion(false);
        setEstadoPendiente(null);
    }

    /*
     * ==========================================
     * CARGANDO
     * ==========================================
     */
    if (cargando) {
        return (
            <div className="space-y-6">
                <Card className="p-8">
                    <p className="text-center text-sm text-[var(--color-text-secondary)]">
                        Cargando configuración fiscal...
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* ==================================
                ENCABEZADO
            ================================== */}
            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                    Configuración fiscal
                </h1>

                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Administra los impuestos y la forma en que se calculan los precios de venta.
                </p>
            </div>

            {/* ==================================
                MENSAJE DE ÉXITO
            ================================== */}
            {mensajeExito && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-right-5 fade-in duration-300">
                    <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-2xl">
                        <div className="flex items-start gap-3">

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg">
                                ✓
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-green-800">
                                    Configuración actualizada
                                </p>

                                <p className="mt-1 text-sm leading-5 text-green-700">
                                    {mensajeExito}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setMensajeExito("")
                                }
                                className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================================
                ERROR
            ================================== */}
            {error && (
                <div className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-md">
                    <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-2xl">
                        <div className="flex items-start gap-3">

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg">
                                !
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-red-800">
                                    Ocurrió un error
                                </p>

                                <p className="mt-1 text-sm text-red-700">
                                    {error}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setError("")
                                }
                                className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================================
                CONTENIDO FISCAL
            ================================== */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                {/* ==================================
                    IMPUESTOS
                ================================== */}
                <Card className="p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-4">

                        <div>
                            <p className="font-semibold text-[var(--color-text)]">
                                Impuestos
                            </p>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Activa o desactiva el cálculo de impuestos para el negocio.
                            </p>
                        </div>

                        {/* SWITCH */}
                        <button
                            type="button"
                            role="switch"
                            aria-checked={impuestosActivos}
                            disabled={guardando}
                            onClick={() =>
                                solicitarCambioImpuestos(
                                    !impuestosActivos
                                )
                            }
                            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full transition ${impuestosActivos
                                ? "bg-[var(--color-primary)]"
                                : "bg-slate-300"
                                } ${guardando
                                    ? "cursor-not-allowed opacity-60"
                                    : ""
                                }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${impuestosActivos
                                    ? "translate-x-8"
                                    : "translate-x-1"
                                    }`}
                            />
                        </button>
                    </div>

                    <div className="mt-5 rounded-2xl border border-[var(--color-border)] p-4">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Estado actual
                        </p>

                        <p className="mt-1 font-semibold text-[var(--color-text)]">
                            {impuestosActivos
                                ? "Impuestos activados"
                                : "Impuestos desactivados"}
                        </p>
                    </div>
                </Card>

                {/* ==================================
                    IVA
                ================================== */}
                <Card className="p-5 sm:p-6">
                    <div className="flex items-center justify-between">

                        <div>
                            <p className="font-semibold text-[var(--color-text)]">
                                IVA
                            </p>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Tasa utilizada por el sistema.
                            </p>
                        </div>

                        <span className="text-2xl font-bold text-[var(--color-text)]">
                            {ivaPorcentaje}%
                        </span>
                    </div>

                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Esta tasa se utiliza cuando los impuestos están activos.
                        </p>
                    </div>
                </Card>

                {/* ==================================
                    ¿CÓMO FUNCIONA?
                ================================== */}
                <Card className="p-5 sm:p-6 lg:col-span-2">
                    <p className="font-semibold text-[var(--color-text)]">
                        ¿Cómo funciona?
                    </p>

                    <ul className="mt-3 space-y-2 text-sm leading-5 text-[var(--color-text-secondary)]">
                        <li>
                            • Al activar los impuestos, se aplica el IVA a los precios de los productos.
                        </li>

                        <li>
                            • El precio base se conserva.
                        </li>

                        <li>
                            • Al desactivar los impuestos, el sistema vuelve a utilizar el precio base.
                        </li>

                        <li>
                            • Los nuevos productos respetan la configuración fiscal vigente.
                        </li>
                    </ul>
                </Card>
            </div>

            {/* ==================================
                VENTANA DE CONFIRMACIÓN
            ================================== */}
            {mostrarConfirmacion && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    onMouseDown={(e) => {
                        if (
                            e.target ===
                            e.currentTarget &&
                            !guardando
                        ) {
                            cancelarCambioImpuestos();
                        }
                    }}
                >
                    <div className="w-full max-w-md overflow-hidden rounded-3xl bg-[var(--color-surface)] shadow-2xl">

                        {/* ICONO */}
                        <div className="flex justify-center pt-7">
                            <div
                                className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl ${estadoPendiente
                                    ? "bg-blue-100"
                                    : "bg-amber-100"
                                    }`}
                            >
                                {estadoPendiente
                                    ? "🧾"
                                    : "⚠️"}
                            </div>
                        </div>

                        {/* CONTENIDO */}
                        <div className="px-6 pb-6 pt-5 text-center">

                            <h3 className="text-xl font-bold text-[var(--color-text)]">
                                {estadoPendiente
                                    ? "Activar impuestos"
                                    : "Desactivar impuestos"}
                            </h3>

                            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                                {estadoPendiente
                                    ? `Al activar los impuestos se actualizarán los precios de venta de los productos existentes aplicando el IVA configurado del ${ivaPorcentaje}%. Los nuevos productos también utilizarán esta configuración.`
                                    : "Al desactivar los impuestos, los precios de venta volverán a utilizar el precio base y los nuevos productos tomarán directamente su precio de venta."}
                            </p>

                            <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">
                                ¿Deseas continuar?
                            </p>
                        </div>

                        {/* BOTONES */}
                        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] p-5 sm:flex-row sm:justify-end">

                            <button
                                type="button"
                                onClick={
                                    cancelarCambioImpuestos
                                }
                                disabled={guardando}
                                className="w-full rounded-xl border border-[var(--color-border)] px-5 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={
                                    confirmarCambioImpuestos
                                }
                                disabled={guardando}
                                className={`w-full rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${estadoPendiente
                                    ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
                                    : "bg-red-600 hover:bg-red-700"
                                    }`}
                            >
                                {guardando
                                    ? "Aplicando..."
                                    : estadoPendiente
                                        ? "Sí, activar impuestos"
                                        : "Sí, desactivar impuestos"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}