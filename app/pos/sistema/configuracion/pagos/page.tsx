
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabasePOS } from "@/lib/supabase";

type ConfiguracionMercadoPago = {
    id: string;
    negocio_id: string;
    habilitado: boolean;
    dispositivo: string;
};

export default function PagosConfiguracionPage() {
    const router = useRouter();

    const [configuracion, setConfiguracion] =
        useState<ConfiguracionMercadoPago | null>(null);

    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState("");

    useEffect(() => {
        cargarConfiguracion();
    }, []);

    async function cargarConfiguracion() {
        setCargando(true);
        setMensaje("");

        try {
            const {
                data: { user },
                error: errorAuth,
            } = await supabasePOS.auth.getUser();

            if (errorAuth || !user) {
                setMensaje("No se pudo identificar al usuario.");
                return;
            }

            const {
                data: negocioId,
                error: errorNegocio,
            } = await supabasePOS.rpc("get_mi_negocio_id");

            if (errorNegocio || !negocioId) {
                setMensaje("No se pudo identificar el negocio.");
                return;
            }

            const { data, error } = await supabasePOS
                .from("configuracion_mercado_pago")
                .select("id, negocio_id, habilitado, dispositivo")
                .eq("negocio_id", negocioId)
                .maybeSingle();

            if (error) {
                setMensaje("No se pudo cargar la configuración de pagos.");
                return;
            }

            if (data) {
                setConfiguracion(data);
            } else {
                setConfiguracion({
                    id: "",
                    negocio_id: negocioId,
                    habilitado: false,
                    dispositivo: "celular",
                });
            }
        } catch {
            setMensaje("Ocurrió un error al cargar la configuración.");
        } finally {
            setCargando(false);
        }
    }

    async function cambiarHabilitado(nuevoEstado: boolean) {
        if (!configuracion || guardando) return;

        setGuardando(true);
        setMensaje("");

        try {
            const { data, error } = await supabasePOS.rpc(
                "guardar_configuracion_mercado_pago",
                {
                    p_habilitado: nuevoEstado,
                    p_dispositivo: "celular",
                }
            );

            if (error) {
                setMensaje(
                    error.message ||
                    "No se pudo guardar la configuración de pagos."
                );
                return;
            }

            if (!data) {
                setMensaje("No se recibió la configuración guardada.");
                return;
            }

            setConfiguracion(data);
        } catch {
            setMensaje("Ocurrió un error al guardar la configuración.");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div
            className="min-h-screen"
            style={{
                backgroundColor: "var(--color-background)",
                color: "var(--color-text)",
            }}
        >
            <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                {/* ENCABEZADO */}
                <div className="flex items-center gap-3 mb-6">
                    <button
                        type="button"
                        onClick={() =>
                            router.push("/pos/sistema/configuracion")
                        }
                        className="w-10 h-10 rounded-xl border flex items-center justify-center transition"
                        style={{
                            borderColor: "var(--color-border)",
                            backgroundColor: "var(--color-surface)",
                            color: "var(--color-text)",
                        }}
                        aria-label="Regresar"
                    >
                        ←
                    </button>

                    <div>
                        <h1
                            className="text-2xl sm:text-3xl font-bold"
                            style={{
                                color: "var(--color-text)",
                            }}
                        >
                            Pagos con tarjeta
                        </h1>

                        <p
                            className="text-sm mt-1"
                            style={{
                                color: "var(--color-text-secondary)",
                            }}
                        >
                            Configura el uso de Mercado Pago para realizar
                            cobros con tarjeta desde el punto de venta.
                        </p>
                    </div>
                </div>

                {/* MENSAJE */}
                {mensaje && (
                    <div
                        className="mb-5 rounded-xl border px-4 py-3 text-sm"
                        style={{
                            borderColor: "var(--color-danger)",
                            backgroundColor: "var(--color-surface)",
                            color: "var(--color-danger)",
                        }}
                    >
                        {mensaje}
                    </div>
                )}

                {cargando ? (
                    <div
                        className="rounded-2xl border shadow-sm p-6"
                        style={{
                            backgroundColor: "var(--color-surface)",
                            borderColor: "var(--color-border)",
                        }}
                    >
                        <p
                            className="text-sm"
                            style={{
                                color: "var(--color-text-secondary)",
                            }}
                        >
                            Cargando configuración...
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* MERCADO PAGO */}
                        <div
                            className="rounded-2xl border shadow-sm p-5 sm:p-6"
                            style={{
                                backgroundColor: "var(--color-surface)",
                                borderColor: "var(--color-border)",
                            }}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4 min-w-0">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                                        style={{
                                            backgroundColor:
                                                "var(--color-background)",
                                        }}
                                    >
                                        💳
                                    </div>

                                    <div className="min-w-0">
                                        <h2 className="text-lg font-bold">
                                            Mercado Pago Point
                                        </h2>

                                        <p
                                            className="text-sm mt-1"
                                            style={{
                                                color: "var(--color-text-secondary)",
                                            }}
                                        >
                                            Permite preparar el punto de venta
                                            para realizar pagos con tarjeta
                                            mediante una terminal Mercado Pago.
                                        </p>
                                    </div>
                                </div>

                                {/* SWITCH */}
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={
                                        configuracion?.habilitado ?? false
                                    }
                                    aria-label="Habilitar cobro con terminal"
                                    disabled={guardando}
                                    onClick={() =>
                                        cambiarHabilitado(
                                            !(configuracion?.habilitado ?? false)
                                        )
                                    }
                                    style={{
                                        width: "52px",
                                        height: "30px",
                                        minWidth: "52px",
                                        borderRadius: "9999px",
                                        border: configuracion?.habilitado
                                            ? "1px solid var(--color-primary)"
                                            : "1px solid var(--color-border)",
                                        backgroundColor:
                                            configuracion?.habilitado
                                                ? "var(--color-primary)"
                                                : "var(--color-background)",
                                        padding: "0",
                                        cursor: guardando
                                            ? "not-allowed"
                                            : "pointer",
                                        opacity: guardando ? 0.6 : 1,
                                        transition: "all 0.2s ease",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "flex-start",
                                        flexShrink: 0,
                                    }}
                                >
                                    <span
                                        style={{
                                            display: "block",
                                            width: "22px",
                                            height: "22px",
                                            borderRadius: "50%",
                                            backgroundColor: "#ffffff",
                                            boxShadow:
                                                "0 1px 4px rgba(0,0,0,0.25)",
                                            transform:
                                                configuracion?.habilitado
                                                    ? "translateX(27px)"
                                                    : "translateX(3px)",
                                            transition:
                                                "transform 0.2s ease",
                                        }}
                                    />
                                </button>
                            </div>

                            <div
                                className="mt-5 pt-4 border-t"
                                style={{
                                    borderColor: "var(--color-border)",
                                }}
                            >
                                <p
                                    className="text-sm font-medium"
                                    style={{
                                        color: configuracion?.habilitado
                                            ? "var(--color-primary)"
                                            : "var(--color-text-secondary)",
                                    }}
                                >
                                    Cobro con terminal
                                </p>

                                <p
                                    className="text-sm mt-1"
                                    style={{
                                        color: "var(--color-text-secondary)",
                                    }}
                                >
                                    {configuracion?.habilitado
                                        ? "La función está habilitada."
                                        : "La función está desactivada actualmente."}
                                </p>
                            </div>
                        </div>

                        {/* DISPOSITIVO */}
                        <div
                            className="rounded-2xl border shadow-sm p-5 sm:p-6"
                            style={{
                                backgroundColor: "var(--color-surface)",
                                borderColor: "var(--color-border)",
                            }}
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                                    style={{
                                        backgroundColor:
                                            "var(--color-background)",
                                    }}
                                >
                                    📱
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold">
                                        Dispositivo
                                    </h2>

                                    <p
                                        className="text-sm mt-1"
                                        style={{
                                            color: "var(--color-text-secondary)",
                                        }}
                                    >
                                        La integración se realizará mediante
                                        un dispositivo móvil compatible.
                                    </p>

                                    <div className="mt-4">
                                        <span
                                            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium"
                                            style={{
                                                borderColor:
                                                    "var(--color-border)",
                                                backgroundColor:
                                                    "var(--color-background)",
                                            }}
                                        >
                                            📱 Celular
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ESTADO */}
                        <div
                            className="rounded-2xl border shadow-sm p-5 sm:p-6"
                            style={{
                                backgroundColor: "var(--color-surface)",
                                borderColor: "var(--color-border)",
                            }}
                        >
                            <h2 className="text-lg font-bold">
                                Estado de integración
                            </h2>

                            <p
                                className="text-sm mt-1"
                                style={{
                                    color: "var(--color-text-secondary)",
                                }}
                            >
                                Activa la función cuando estés listo para
                                configurar el dispositivo.
                            </p>

                            <div className="mt-4">
                                <span
                                    className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
                                    style={{
                                        backgroundColor:
                                            configuracion?.habilitado
                                                ? "var(--color-primary)"
                                                : "var(--color-background)",
                                        color: configuracion?.habilitado
                                            ? "#ffffff"
                                            : "var(--color-text-secondary)",
                                        border: configuracion?.habilitado
                                            ? "1px solid var(--color-primary)"
                                            : "1px solid var(--color-border)",
                                    }}
                                >
                                    {configuracion?.habilitado
                                        ? "Habilitado"
                                        : "Deshabilitado"}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}