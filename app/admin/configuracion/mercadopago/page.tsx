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

interface ConfiguracionMercadoPago {
    id: string;
    negocio_id: string;
    habilitado: boolean;
    dispositivo: string | null;
    terminal_id: string | null;
    modo: "sandbox" | "produccion";
    estado_conexion:
    | "desconectado"
    | "conectando"
    | "conectado"
    | "error";
    usuario_mercado_pago_id: string | null;
}

export default function MercadoPagoConfiguracionPage() {
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [conectandoMP, setConectandoMP] = useState(false);

    const [recargoActivo, setRecargoActivo] = useState(false);
    const [porcentaje, setPorcentaje] = useState("3.50");
    const [montoEjemplo, setMontoEjemplo] = useState("100");

    const [configuracionMP, setConfiguracionMP] =
        useState<ConfiguracionMercadoPago | null>(null);

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

    useEffect(() => {
        const parametros = new URLSearchParams(window.location.search);
        const conexion = parametros.get("conexion");

        if (conexion === "ok") {
            mostrarMensaje(
                "exito",
                "Mercado Pago conectado",
                "La cuenta de Mercado Pago fue autorizada correctamente para este negocio."
            );

            window.history.replaceState(
                {},
                "",
                "/admin/configuracion/mercadopago"
            );
        }

        if (conexion === "error") {
            mostrarMensaje(
                "error",
                "No se pudo conectar Mercado Pago",
                "La autorización de Mercado Pago no pudo completarse. Verifica la configuración e inténtalo nuevamente."
            );

            window.history.replaceState(
                {},
                "",
                "/admin/configuracion/mercadopago"
            );
        }
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

            /*
             * ---------------------------------------------------------
             * CONFIGURACIÓN DEL NEGOCIO
             * ---------------------------------------------------------
             */

            const { data: negocio, error: negocioError } = await supabase
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

            /*
             * ---------------------------------------------------------
             * CONFIGURACIÓN DE MERCADO PAGO
             * ---------------------------------------------------------
             */

            const {
                data: configuracion,
                error: configuracionError,
            } = await supabase
                .from("configuracion_mercado_pago")
                .select(
                    `
                    id,
                    negocio_id,
                    habilitado,
                    dispositivo,
                    terminal_id,
                    modo,
                    estado_conexion,
                    usuario_mercado_pago_id
                    `
                )
                .eq("negocio_id", usuario.negocio_id)
                .maybeSingle();

            if (configuracionError) {
                console.error(
                    "Error cargando configuración de conexión de Mercado Pago:",
                    configuracionError
                );

                throw new Error(
                    "No se pudo cargar el estado de conexión de Mercado Pago."
                );
            }

            setConfiguracionMP(
                configuracion as ConfiguracionMercadoPago | null
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

    /*
     * -------------------------------------------------------------
     * CONECTAR MERCADO PAGO
     * -------------------------------------------------------------
     */

    async function conectarMercadoPago() {
        if (conectandoMP) {
            return;
        }

        try {
            setConectandoMP(true);

            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError) {
                console.error(
                    "Error obteniendo sesión de Supabase:",
                    sessionError
                );

                throw new Error(
                    "No se pudo obtener la sesión actual."
                );
            }

            if (!session?.access_token) {
                throw new Error(
                    "La sesión del administrador no está disponible. Inicia sesión nuevamente."
                );
            }

            console.log("Sesión encontrada:", {
                existe: !!session,
                userId: session?.user?.id,
                expira: session?.expires_at,
                tieneAccessToken: !!session?.access_token,
            });

            const respuesta = await fetch(
                "/api/mercadopago/oauth/connect",
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    cache: "no-store",
                }
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok || !resultado?.ok) {
                console.error(
                    "Error iniciando conexión con Mercado Pago:",
                    resultado
                );

                throw new Error(
                    resultado?.error ||
                    "No se pudo iniciar la conexión con Mercado Pago."
                );
            }

            if (!resultado.authorization_url) {
                throw new Error(
                    "Mercado Pago no devolvió la URL de autorización."
                );
            }

            /*
             * Redirigimos al administrador a Mercado Pago.
             *
             * La URL contiene un state generado en el servidor.
             * No almacenamos tokens en el navegador.
             */
            window.location.href = resultado.authorization_url;
        } catch (error) {
            console.error(
                "Error conectando Mercado Pago:",
                error
            );

            setConectandoMP(false);

            mostrarMensaje(
                "error",
                "No se pudo conectar Mercado Pago",
                error instanceof Error
                    ? error.message
                    : "No se pudo iniciar la autorización con Mercado Pago."
            );
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
                    )}%.`
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

    /*
     * -------------------------------------------------------------
     * ESTADO DE CONEXIÓN
     * -------------------------------------------------------------
     */

    function obtenerTextoEstado() {
        switch (configuracionMP?.estado_conexion) {
            case "conectado":
                return "Conectado";

            case "conectando":
                return "Conectando";

            case "error":
                return "Error de conexión";

            case "desconectado":
            default:
                return "Desconectado";
        }
    }

    function obtenerClaseEstado() {
        switch (configuracionMP?.estado_conexion) {
            case "conectado":
                return "border-emerald-200 bg-emerald-50 text-emerald-700";

            case "conectando":
                return "border-amber-200 bg-amber-50 text-amber-700";

            case "error":
                return "border-red-200 bg-red-50 text-red-700";

            case "desconectado":
            default:
                return "border-slate-200 bg-slate-50 text-slate-600";
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
                            Configura los pagos con tarjeta, la conexión
                            con Mercado Pago y el recargo aplicado a este
                            tipo de pago.
                        </p>
                    </div>
                </div>

                {/* =====================================================
                    CONEXIÓN CON MERCADO PAGO
                ====================================================== */}

                <Card className="p-5 sm:p-6">

                    <div className="mb-6">
                        <div className="flex items-start gap-3">

                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-xl text-white">
                                🔗
                            </div>

                            <div className="min-w-0">
                                <h2 className="font-semibold text-[var(--color-text)]">
                                    Conexión con Mercado Pago
                                </h2>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    Configuración de la cuenta de Mercado
                                    Pago y del dispositivo Point utilizado
                                    por este negocio.
                                </p>
                            </div>

                        </div>
                    </div>

                    <div className="space-y-4">

                        {/* ESTADO */}

                        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-4 sm:flex-row sm:items-center sm:justify-between">

                            <div>
                                <p className="font-medium text-[var(--color-text)]">
                                    Estado de conexión
                                </p>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    Estado actual de la conexión de este
                                    negocio con Mercado Pago.
                                </p>
                            </div>

                            <span
                                className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-sm font-semibold ${obtenerClaseEstado()}`}
                            >
                                <span className="mr-2 h-2 w-2 rounded-full bg-current" />

                                {obtenerTextoEstado()}
                            </span>

                        </div>

                        {/* INFORMACIÓN */}

                        <div className="grid gap-4 sm:grid-cols-2">

                            {/* CUENTA */}

                            <div className="rounded-2xl border border-[var(--color-border)] p-4">

                                <div className="mb-3 flex items-center gap-3">

                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-background-secondary)] text-lg">
                                        👤
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Cuenta
                                        </p>

                                        <p className="font-medium text-[var(--color-text)]">
                                            Mercado Pago
                                        </p>
                                    </div>

                                </div>

                                <p className="text-sm text-[var(--color-text-secondary)]">
                                    {configuracionMP?.usuario_mercado_pago_id
                                        ? `ID de usuario: ${configuracionMP.usuario_mercado_pago_id}`
                                        : "Cuenta de Mercado Pago no conectada."}
                                </p>

                            </div>

                            {/* DISPOSITIVO */}

                            <div className="rounded-2xl border border-[var(--color-border)] p-4">

                                <div className="mb-3 flex items-center gap-3">

                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-background-secondary)] text-lg">
                                        📱
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Dispositivo
                                        </p>

                                        <p className="font-medium text-[var(--color-text)]">
                                            {configuracionMP?.dispositivo ||
                                                "No configurado"}
                                        </p>
                                    </div>

                                </div>

                                <p className="text-sm text-[var(--color-text-secondary)]">
                                    Se configurará cuando se disponga de un
                                    Point compatible.
                                </p>

                            </div>

                            {/* TERMINAL */}

                            <div className="rounded-2xl border border-[var(--color-border)] p-4">

                                <div className="mb-3 flex items-center gap-3">

                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-background-secondary)] text-lg">
                                        🖥️
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Terminal
                                        </p>

                                        <p className="font-medium text-[var(--color-text)]">
                                            {configuracionMP?.terminal_id ||
                                                "No configurada"}
                                        </p>
                                    </div>

                                </div>

                                <p className="text-sm text-[var(--color-text-secondary)]">
                                    La terminal se asociará al dispositivo
                                    Point utilizado por el negocio.
                                </p>

                            </div>

                            {/* MODO */}

                            <div className="rounded-2xl border border-[var(--color-border)] p-4">

                                <div className="mb-3 flex items-center gap-3">

                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-background-secondary)] text-lg">
                                        ⚙️
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Modo
                                        </p>

                                        <p className="font-medium capitalize text-[var(--color-text)]">
                                            {configuracionMP?.modo ===
                                                "sandbox"
                                                ? "Sandbox"
                                                : "Producción"}
                                        </p>
                                    </div>

                                </div>

                                <p className="text-sm text-[var(--color-text-secondary)]">
                                    La conexión real utilizará el modo de
                                    producción cuando el negocio esté listo
                                    para operar.
                                </p>

                            </div>

                        </div>

                        {/* BOTÓN DE CONEXIÓN */}

                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-4 sm:p-5">

                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                                <div className="min-w-0">
                                    <p className="font-semibold text-[var(--color-text)]">
                                        Cuenta de Mercado Pago
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                                        Autoriza de forma segura la cuenta de
                                        Mercado Pago que utilizará este negocio.
                                        Los tokens de acceso se almacenan de
                                        forma cifrada en el servidor.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={conectarMercadoPago}
                                    disabled={conectandoMP || guardando}
                                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {conectandoMP
                                        ? "Conectando..."
                                        : configuracionMP?.estado_conexion ===
                                            "conectado"
                                            ? "Reconectar Mercado Pago"
                                            : "Conectar Mercado Pago"}
                                </button>

                            </div>

                        </div>

                        {/* AVISO */}

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">

                            <div className="flex gap-3">

                                <div className="text-lg">
                                    ℹ️
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-blue-900">
                                        Autorización segura
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-blue-800">
                                        Al presionar el botón de conexión serás
                                        enviado a Mercado Pago para autorizar
                                        la cuenta. La aplicación no solicita ni
                                        almacena tu contraseña de Mercado Pago.
                                    </p>
                                </div>

                            </div>

                        </div>

                    </div>
                </Card>

                {/* =====================================================
                    CONFIGURACIÓN DEL RECARGO
                ====================================================== */}

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
                                    Cuando esté activo, el porcentaje se
                                    agregará al monto pagado con tarjeta.
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

                                <div className="text-lg">
                                    ⚠️
                                </div>

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

                {/* =====================================================
                    VISTA PREVIA
                ====================================================== */}

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

                {/* =====================================================
                    INFORMACIÓN
                ====================================================== */}

                <Card className="p-5 sm:p-6">

                    <h2 className="font-semibold text-[var(--color-text)]">
                        Cómo funcionará en el POS
                    </h2>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">

                        <div className="rounded-2xl border border-[var(--color-border)] p-4">

                            <div className="mb-2 text-xl">
                                💵
                            </div>

                            <p className="font-medium text-[var(--color-text)]">
                                Efectivo
                            </p>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                No tendrá recargo.
                            </p>

                        </div>

                        <div className="rounded-2xl border border-[var(--color-border)] p-4">

                            <div className="mb-2 text-xl">
                                💳
                            </div>

                            <p className="font-medium text-[var(--color-text)]">
                                Tarjeta
                            </p>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Se aplicará el porcentaje configurado.
                            </p>

                        </div>

                        <div className="rounded-2xl border border-[var(--color-border)] p-4">

                            <div className="mb-2 text-xl">
                                🔀
                            </div>

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
                        disabled={guardando || conectandoMP}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-5 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={guardarConfiguracion}
                        disabled={guardando || conectandoMP}
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