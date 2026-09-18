"use client";

import { useEffect, useState } from "react";

import Card from "../../../components/Card";
import ModalMensaje from "../../../components/ModalMensaje";

import { supabase } from "../../../../lib/supabase";
import { obtenerUsuarioActual } from "../../../../lib/auth/roleGuard";

interface UsuarioActual {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

export default function MercadoPagoConfiguracionPage() {
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

    const [recargoActivo, setRecargoActivo] = useState(false);
    const [porcentaje, setPorcentaje] = useState("3.50");
    const [montoEjemplo, setMontoEjemplo] = useState("100");

    const [modal, setModal] = useState<{
        abierto: boolean;
        tipo: "error" | "info" | "exito" | "confirmacion";
        titulo: string;
        mensaje: string;
    }>({
        abierto: false,
        tipo: "info",
        titulo: "",
        mensaje: "",
    });

    function mostrarMensaje(
        tipo: "error" | "info" | "exito" | "confirmacion",
        titulo: string,
        mensaje: string
    ) {
        setModal({
            abierto: true,
            tipo,
            titulo,
            mensaje,
        });
    }

    function cerrarMensaje() {
        setModal((actual) => ({
            ...actual,
            abierto: false,
        }));
    }

    useEffect(() => {
        cargarConfiguracion();
    }, []);

    async function cargarConfiguracion() {
        try {
            setCargando(true);

            const usuario = (await obtenerUsuarioActual()) as
                | UsuarioActual
                | null;

            if (!usuario?.negocio_id) {
                throw new Error(
                    "No se pudo determinar el negocio del usuario."
                );
            }

            const { data: negocio, error: negocioError } =
                await supabase
                    .from("negocios")
                    .select(
                        "recargo_tarjeta_activo, recargo_tarjeta_porcentaje"
                    )
                    .eq("id", usuario.negocio_id)
                    .single();

            if (negocioError) {
                console.error(
                    "Error cargando configuración de Mercado Pago:",
                    negocioError
                );

                throw new Error(
                    "No se pudo cargar la configuración de Mercado Pago."
                );
            }

            setRecargoActivo(
                Boolean(negocio?.recargo_tarjeta_activo ?? false)
            );

            setPorcentaje(
                Number(
                    negocio?.recargo_tarjeta_porcentaje ?? 3.5
                ).toFixed(2)
            );
        } catch (error) {
            console.error(
                "Error cargando configuración de Mercado Pago:",
                error
            );

            mostrarMensaje(
                "error",
                "Error",
                error instanceof Error
                    ? error.message
                    : "No se pudo cargar la configuración de Mercado Pago."
            );
        } finally {
            setCargando(false);
        }
    }

    async function guardarConfiguracion() {
        try {
            const porcentajeNumero = Number(porcentaje);

            if (
                !Number.isFinite(porcentajeNumero) ||
                porcentajeNumero < 0 ||
                porcentajeNumero > 100
            ) {
                mostrarMensaje(
                    "confirmacion",
                    "Porcentaje inválido",
                    "El porcentaje debe estar entre 0 y 100."
                );
                return;
            }

            setGuardando(true);

            const usuario = (await obtenerUsuarioActual()) as
                | UsuarioActual
                | null;

            if (!usuario?.negocio_id) {
                throw new Error(
                    "No se pudo determinar el negocio del usuario."
                );
            }

            const { error: updateError } = await supabase
                .from("negocios")
                .update({
                    recargo_tarjeta_activo: recargoActivo,
                    recargo_tarjeta_porcentaje: Number(
                        porcentajeNumero.toFixed(2)
                    ),
                })
                .eq("id", usuario.negocio_id);

            if (updateError) {
                console.error(
                    "Error guardando configuración de Mercado Pago:",
                    updateError
                );

                throw new Error(
                    "No se pudo guardar la configuración de Mercado Pago."
                );
            }

            setPorcentaje(porcentajeNumero.toFixed(2));

            mostrarMensaje(
                "exito",
                "Configuración guardada",
                recargoActivo
                    ? `El recargo por pago con tarjeta quedó activado al ${porcentajeNumero.toFixed(
                        2
                    )
                    }%.`
                    : "El recargo por pago con tarjeta quedó desactivado."
            );
        } catch (error) {
            console.error(
                "Error guardando configuración de Mercado Pago:",
                error
            );

            mostrarMensaje(
                "error",
                "Error al guardar",
                error instanceof Error
                    ? error.message
                    : "No se pudo guardar la configuración."
            );
        } finally {
            setGuardando(false);
        }
    }

    const monto = Number(montoEjemplo) || 0;
    const porcentajeNumero = Number(porcentaje) || 0;

    const recargo = recargoActivo
        ? monto * (porcentajeNumero / 100)
        : 0;

    const totalConRecargo = monto + recargo;

    if (cargando) {
        return (
            <div className="flex min-h-[300px] items-center justify-center">
                <div className="text-sm text-[var(--color-text-secondary)]">
                    Cargando configuración...
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                {/* ENCABEZADO */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <button
                            type="button"
                            onClick={() => {
                                window.location.href =
                                    "/admin/configuracion";
                            }}
                            className="mb-3 text-sm font-medium text-[var(--color-primary)] hover:underline"
                        >
                            ← Volver a configuración
                        </button>

                        <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                            Mercado Pago
                        </h1>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Configura los pagos con tarjeta y el recargo
                            aplicado a este tipo de pago.
                        </p>
                    </div>
                </div>

                {/* CONFIGURACIÓN DEL RECARGO */}
                <Card className="p-5 sm:p-6">
                    <div className="mb-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-xl text-white">
                                💳
                            </div>

                            <div>
                                <h2 className="font-semibold text-[var(--color-text)]">
                                    Recargo por pago con tarjeta
                                </h2>

                                <p className="text-sm text-[var(--color-text-secondary)]">
                                    El recargo se aplicará únicamente a la
                                    parte pagada con tarjeta.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* SWITCH */}
                        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-medium text-[var(--color-text)]">
                                    Activar recargo
                                </p>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    Cuando esté activo, el porcentaje se agregará al monto
                                    pagado con tarjeta.
                                </p>
                            </div>

                            <button
                                type="button"
                                role="switch"
                                aria-checked={recargoActivo}
                                disabled={guardando}
                                onClick={() =>
                                    setRecargoActivo((actual) => !actual)
                                }
                                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${recargoActivo
                                    ? "bg-[var(--color-primary)]"
                                    : "bg-slate-300"
                                    } ${guardando
                                        ? "cursor-not-allowed opacity-60"
                                        : "cursor-pointer"
                                    }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${recargoActivo
                                        ? "translate-x-6"
                                        : "translate-x-1"
                                        }`}
                                />
                            </button>
                        </div>

                        {/* PORCENTAJE */}
                        <div className="max-w-sm">
                            <label
                                htmlFor="porcentaje-recargo"
                                className="mb-2 block text-sm font-medium text-[var(--color-text)]"
                            >
                                Porcentaje del recargo
                            </label>

                            <div className="relative">
                                <input
                                    id="porcentaje-recargo"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={porcentaje}
                                    onChange={(e) =>
                                        setPorcentaje(e.target.value)
                                    }
                                    disabled={!recargoActivo || guardando}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 pr-12 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:cursor-not-allowed disabled:opacity-50"
                                />

                                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-medium text-[var(--color-text-secondary)]">
                                    %
                                </span>
                            </div>

                            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                Valor predeterminado: 3.50%
                            </p>
                        </div>

                        {/* AVISO */}
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex gap-3">
                                <div className="text-lg">⚠️</div>

                                <div>
                                    <p className="text-sm font-semibold text-amber-900">
                                        Importante
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-amber-800">
                                        Verifica que la aplicación de un
                                        recargo por pago con tarjeta sea
                                        compatible con las condiciones de tu
                                        proveedor de pagos y la normativa
                                        aplicable a tu negocio.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* VISTA PREVIA */}
                <Card className="p-5 sm:p-6">
                    <div className="mb-5">
                        <h2 className="font-semibold text-[var(--color-text)]">
                            Vista previa
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Observa cómo se calcularía el recargo en una venta
                            con tarjeta.
                        </p>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                        {/* MONTO */}
                        <div>
                            <label
                                htmlFor="monto-ejemplo"
                                className="mb-2 block text-sm font-medium text-[var(--color-text)]"
                            >
                                Monto de ejemplo
                            </label>

                            <div className="relative">
                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                                    $
                                </span>

                                <input
                                    id="monto-ejemplo"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={montoEjemplo}
                                    onChange={(e) =>
                                        setMontoEjemplo(e.target.value)
                                    }
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 pl-8 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                                />
                            </div>
                        </div>

                        {/* RESUMEN */}
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-5">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                        Subtotal
                                    </span>

                                    <span className="font-medium text-[var(--color-text)]">
                                        $
                                        {monto.toLocaleString("es-MX", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                        Recargo tarjeta (
                                        {porcentajeNumero.toFixed(2)}%)
                                    </span>

                                    <span className="font-medium text-[var(--color-text)]">
                                        $
                                        {recargo.toLocaleString("es-MX", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </span>
                                </div>

                                <div className="border-t border-[var(--color-border)] pt-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="font-semibold text-[var(--color-text)]">
                                            Total
                                        </span>

                                        <span className="text-xl font-bold text-[var(--color-primary)]">
                                            $
                                            {totalConRecargo.toLocaleString(
                                                "es-MX",
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                }
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* INFORMACIÓN */}
                <Card className="p-5 sm:p-6">
                    <h2 className="font-semibold text-[var(--color-text)]">
                        Cómo funcionará en el POS
                    </h2>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-[var(--color-border)] p-4">
                            <div className="mb-2 text-xl">💵</div>

                            <p className="font-medium text-[var(--color-text)]">
                                Efectivo
                            </p>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                No tendrá recargo.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-[var(--color-border)] p-4">
                            <div className="mb-2 text-xl">💳</div>

                            <p className="font-medium text-[var(--color-text)]">
                                Tarjeta
                            </p>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Se aplicará el porcentaje configurado.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-[var(--color-border)] p-4">
                            <div className="mb-2 text-xl">🔀</div>

                            <p className="font-medium text-[var(--color-text)]">
                                Pago mixto
                            </p>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                El recargo se aplicará únicamente a la parte
                                pagada con tarjeta.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* BOTONES */}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            window.location.href =
                                "/admin/configuracion";
                        }}
                        disabled={guardando}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-5 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={guardarConfiguracion}
                        disabled={guardando}
                        className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {guardando
                            ? "Guardando..."
                            : "Guardar configuración"}
                    </button>
                </div>
            </div>

            <ModalMensaje
                abierto={modal.abierto}
                tipo={modal.tipo}
                titulo={modal.titulo}
                mensaje={modal.mensaje}
                onCerrar={cerrarMensaje}
            />
        </>
    );
}
