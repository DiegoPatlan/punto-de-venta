"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { obtenerUsuarioPOS } from "../../../lib/usuarioPOS";

import {
    obtenerCajasAsignadas,
    type CajaAsignada,
} from "../../../lib/cajas";

import { supabasePOS } from "../../../lib/supabase";

/*
 * ============================================
 * TIPOS
 * ============================================
 */

interface UsuarioActual {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

interface SesionCajaAbierta {
    id: string;
    caja_id: string;
    usuario_apertura_id: string;
    monto_inicial: number;
    estado: string;
    fecha_apertura: string;
    usuario?: {
        nombre: string;
        rol: string;
    } | null;
}

/*
 * ============================================
 * PÁGINA SELECCIÓN / APERTURA DE CAJA
 * ============================================
 */

export default function CajaPage() {
    const router = useRouter();

    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [cajasDisponibles, setCajasDisponibles] =
        useState<CajaAsignada[]>([]);

    const [sesionesAbiertas, setSesionesAbiertas] =
        useState<SesionCajaAbierta[]>([]);

    const [cajaSeleccionada, setCajaSeleccionada] =
        useState<string>("");

    const [montoInicial, setMontoInicial] =
        useState<string>("");

    const [cargando, setCargando] =
        useState(true);

    const [abriendoCaja, setAbriendoCaja] =
        useState(false);

    const [error, setError] =
        useState("");

    /*
     * ============================================
     * CARGAR USUARIO Y CAJAS
     * ============================================
     */

    useEffect(() => {
        async function cargarDatos() {
            try {
                setCargando(true);
                setError("");

                /*
                 * ========================================
                 * OBTENER USUARIO
                 * ========================================
                 */

                const usuarioActual =
                    (await obtenerUsuarioPOS()) as
                    | UsuarioActual
                    | null;

                /*
                 * ========================================
                 * VALIDAR SESIÓN
                 * ========================================
                 */

                if (
                    !usuarioActual?.id ||
                    !usuarioActual.negocio_id
                ) {
                    router.replace("/pos/login");
                    return;
                }

                setUsuario(usuarioActual);

                /*
                 * ========================================
                 * BUSCAR SI EL USUARIO YA TIENE
                 * UNA CAJA ABIERTA
                 * ========================================
                 *
                 * Esta es la parte importante.
                 *
                 * Si el usuario ya tiene una sesión de
                 * caja abierta, no debe volver a seleccionar
                 * ni abrir otra caja.
                 *
                 * Debe entrar directamente al sistema.
                 */

                const {
                    data: sesionPropia,
                    error: errorSesionPropia,
                } = await supabasePOS
                    .from("sesiones_caja")
                    .select(
                        "id, caja_id, usuario_apertura_id, monto_inicial, monto_esperado, estado, fecha_apertura"
                    )
                    .eq(
                        "usuario_apertura_id",
                        usuarioActual.id
                    )
                    .eq(
                        "estado",
                        "abierta"
                    )
                    .maybeSingle();

                /*
                 * ========================================
                 * ERROR CONSULTANDO SESIÓN PROPIA
                 * ========================================
                 */

                if (errorSesionPropia) {
                    console.error(
                        "Error verificando sesión de caja del usuario:",
                        errorSesionPropia
                    );

                    setError(
                        "No se pudo verificar si tienes una caja abierta."
                    );

                    return;
                }

                /*
                 * ========================================
                 * EL USUARIO YA TIENE UNA CAJA ABIERTA
                 * ========================================
                 */

                if (sesionPropia) {
                    /*
                     * Ya existe una sesión abierta para
                     * este usuario.
                     *
                     * No mostramos nuevamente la pantalla
                     * de selección de caja.
                     */

                    router.replace("/pos/sistema");
                    return;
                }

                /*
                 * ========================================
                 * OBTENER CAJAS ASIGNADAS
                 * ========================================
                 */

                const {
                    data: cajasData,
                    error: errorCajas,
                } = await obtenerCajasAsignadas(
                    usuarioActual.negocio_id,
                    usuarioActual.id
                );

                if (errorCajas) {
                    console.error(
                        "Error obteniendo cajas:",
                        errorCajas
                    );

                    setError(
                        "No se pudieron cargar las cajas."
                    );

                    return;
                }

                const cajas = cajasData ?? [];

                setCajasDisponibles(cajas);

                /*
                 * ========================================
                 * OBTENER SESIONES ABIERTAS
                 * ========================================
                 *
                 * Buscamos todas las sesiones abiertas
                 * de las cajas que pertenecen al negocio.
                 *
                 * Esto permite detectar qué cajas están
                 * ocupadas por otros usuarios.
                 */

                const idsCajas =
                    cajas.map(
                        (caja) => caja.id
                    );

                if (idsCajas.length > 0) {
                    const {
                        data: sesionesData,
                        error: errorSesiones,
                    } = await supabasePOS
                        .from("sesiones_caja")
                        .select(`
                            id,
                            caja_id,
                            usuario_apertura_id,
                            monto_inicial,
                            estado,
                            fecha_apertura,
                            usuario:usuarios!sesiones_caja_usuario_apertura_fkey(
                                nombre,
                                rol
                            )
                        `)
                        .in(
                            "caja_id",
                            idsCajas
                        )
                        .eq(
                            "estado",
                            "abierta"
                        );

                    /*
                     * ========================================
                     * ERROR SESIONES ABIERTAS
                     * ========================================
                     */

                    if (errorSesiones) {
                        console.error(
                            "Error obteniendo sesiones abiertas:",
                            errorSesiones
                        );

                        setError(
                            "No se pudo consultar el estado de las cajas."
                        );

                        return;
                    }

                    /*
                     * ========================================
                     * NORMALIZAR DATOS DE USUARIO
                     * ========================================
                     */

                    const sesionesNormalizadas: SesionCajaAbierta[] =
                        (sesionesData ?? []).map(
                            (sesion: any) => {
                                const usuarioSesion =
                                    Array.isArray(
                                        sesion.usuario
                                    )
                                        ? sesion.usuario[0] ?? null
                                        : sesion.usuario ?? null;

                                return {
                                    id: sesion.id,
                                    caja_id:
                                        sesion.caja_id,
                                    usuario_apertura_id:
                                        sesion.usuario_apertura_id,
                                    monto_inicial:
                                        Number(
                                            sesion.monto_inicial ?? 0
                                        ),
                                    estado:
                                        sesion.estado,
                                    fecha_apertura:
                                        sesion.fecha_apertura,
                                    usuario:
                                        usuarioSesion,
                                };
                            }
                        );

                    setSesionesAbiertas(
                        sesionesNormalizadas
                    );
                } else {
                    setSesionesAbiertas([]);
                }
            } catch (error) {
                console.error(
                    "Error cargando cajas:",
                    error
                );

                setError(
                    "Ocurrió un error al cargar las cajas."
                );
            } finally {
                setCargando(false);
            }
        }

        cargarDatos();
    }, [router]);

    /*
     * ============================================
     * ABRIR CAJA
     * ============================================
     */

    async function abrirCaja() {
        setError("");

        if (!usuario) {
            setError(
                "No se encontró el usuario actual."
            );

            return;
        }

        if (!cajaSeleccionada) {
            setError(
                "Selecciona una caja disponible."
            );

            return;
        }

        /*
         * ========================================
         * VERIFICAR NUEVAMENTE SI ESTÁ OCUPADA
         * ========================================
         */

        const sesionActiva =
            sesionesAbiertas.find(
                (sesion) =>
                    sesion.caja_id ===
                    cajaSeleccionada
            );

        if (sesionActiva) {
            const nombre =
                sesionActiva.usuario?.nombre ??
                "otro usuario";

            setError(
                `Esta caja ya está ocupada por ${nombre}.`
            );

            return;
        }

        /*
         * ========================================
         * VALIDAR MONTO
         * ========================================
         */

        const monto =
            Number(montoInicial);

        if (
            montoInicial === "" ||
            Number.isNaN(monto) ||
            monto < 0
        ) {
            setError(
                "Introduce un monto inicial válido."
            );

            return;
        }

        try {
            setAbriendoCaja(true);

            /*
             * ========================================
             * COMPROBACIÓN FINAL CONTRA SUPABASE
             * ========================================
             */

            const {
                data: sesionExistente,
                error: errorExistente,
            } = await supabasePOS
                .from("sesiones_caja")
                .select(
                    "id, usuario_apertura_id"
                )
                .eq(
                    "caja_id",
                    cajaSeleccionada
                )
                .eq(
                    "estado",
                    "abierta"
                )
                .maybeSingle();

            if (errorExistente) {
                console.error(
                    "Error verificando caja:",
                    errorExistente
                );

                setError(
                    "No se pudo verificar el estado de la caja."
                );

                return;
            }

            if (sesionExistente) {
                setError(
                    "Esta caja ya está siendo utilizada por otro usuario."
                );

                window.location.reload();

                return;
            }

            /*
             * ========================================
             * CREAR SESIÓN DE CAJA
             * ========================================
             */

            const {
                data: nuevaSesion,
                error: errorApertura,
            } = await supabasePOS.rpc("abrir_sesion_caja", {
                p_caja_id: cajaSeleccionada,
                p_monto_inicial: monto,
            });

            /*
             * ========================================
             * ERROR AL ABRIR
             * ========================================
             */

            if (errorApertura) {
                console.error(
                    "Error abriendo caja:",
                    errorApertura
                );

                if (
                    errorApertura.code ===
                    "23505"
                ) {
                    setError(
                        "Esta caja acaba de ser abierta por otro usuario."
                    );

                    window.location.reload();

                    return;
                }

                setError(
                    errorApertura.message ||
                    "No se pudo abrir la caja."
                );

                return;
            }

            if (!nuevaSesion) {
                setError(
                    "No se recibió la información de la sesión."
                );

                return;
            }

            /*
             * ========================================
             * IR AL PUNTO DE VENTA
             * ========================================
             */

            router.replace("/pos/sistema");

        } catch (error) {
            console.error(
                "Error inesperado abriendo caja:",
                error
            );

            setError(
                "Ocurrió un error al abrir la caja."
            );
        } finally {
            setAbriendoCaja(false);
        }
    }

    /*
     * ============================================
     * FORMATEAR FECHA
     * ============================================
     */

    function formatearFecha(
        fecha: string
    ) {
        return new Date(
            fecha
        ).toLocaleString(
            "es-MX",
            {
                dateStyle: "short",
                timeStyle: "short",
            }
        );
    }

    /*
     * ============================================
     * CARGANDO
     * ============================================
     */

    if (cargando) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
                <div className="text-center">

                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl shadow-sm">
                        🏪
                    </div>

                    <p className="text-sm font-semibold text-[var(--color-text)]">
                        Cargando cajas...
                    </p>

                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Consultando disponibilidad
                    </p>

                </div>
            </div>
        );
    }

    /*
     * ============================================
     * SIN USUARIO
     * ============================================
     */

    if (!usuario) {
        return null;
    }

    /*
     * ============================================
     * INTERFAZ
     * ============================================
     */

    return (
        <div className="min-h-screen bg-[var(--color-background)] px-4 py-8">

            <div className="mx-auto w-full max-w-3xl">

                {/* ENCABEZADO */}

                <div className="mb-6">

                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Bienvenido
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-[var(--color-text)]">
                        {usuario.nombre}
                    </h1>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Selecciona la caja con la que vas a trabajar.
                    </p>

                </div>

                {/* ERROR */}

                {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* CAJAS */}

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">

                    <div className="mb-5">

                        <h2 className="text-lg font-bold text-[var(--color-text)]">
                            Cajas disponibles
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Las cajas ocupadas no pueden seleccionarse.
                        </p>

                    </div>

                    {cajasDisponibles.length === 0 ? (

                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">

                            <p className="text-sm font-semibold text-amber-800">
                                No tienes cajas asignadas
                            </p>

                            <p className="mt-1 text-xs leading-5 text-amber-700">
                                Solicita al administrador que
                                te asigne una caja.
                            </p>

                        </div>

                    ) : (

                        <div className="space-y-3">

                            {cajasDisponibles.map(
                                (item) => {

                                    /*
                                     * ==================================
                                     * BUSCAR SI ESTA CAJA ESTÁ OCUPADA
                                     * ==================================
                                     */

                                    const sesionActiva =
                                        sesionesAbiertas.find(
                                            (sesion) =>
                                                sesion.caja_id ===
                                                item.id
                                        );

                                    const ocupada =
                                        Boolean(
                                            sesionActiva
                                        );

                                    const seleccionada =
                                        cajaSeleccionada ===
                                        item.id;

                                    return (

                                        <button
                                            key={item.id}
                                            type="button"
                                            disabled={
                                                ocupada ||
                                                abriendoCaja
                                            }
                                            onClick={() => {
                                                if (!ocupada) {
                                                    setCajaSeleccionada(
                                                        item.id
                                                    );
                                                }
                                            }}
                                            className={`w-full rounded-xl border p-4 text-left transition ${ocupada
                                                ? "cursor-not-allowed border-red-200 bg-red-50"
                                                : seleccionada
                                                    ? "border-[var(--color-primary)] bg-blue-50"
                                                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] hover:bg-slate-50"
                                                } disabled:opacity-90`}
                                        >

                                            <div className="flex items-start justify-between gap-4">

                                                <div className="min-w-0">

                                                    <div className="flex items-center gap-2">

                                                        <p className="text-sm font-bold text-[var(--color-text)]">
                                                            {item.nombre}
                                                        </p>

                                                        {ocupada && (
                                                            <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">
                                                                Ocupada
                                                            </span>
                                                        )}

                                                        {!ocupada && (
                                                            <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-green-700">
                                                                Disponible
                                                            </span>
                                                        )}

                                                    </div>

                                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                        {item.sucursal_nombre ??
                                                            "Sucursal"}
                                                    </p>

                                                    {/* INFORMACIÓN DEL USUARIO */}

                                                    {ocupada &&
                                                        sesionActiva && (

                                                            <div className="mt-4 rounded-lg border border-red-200 bg-white/70 p-3">

                                                                <p className="text-xs font-semibold text-red-700">
                                                                    Caja en uso
                                                                </p>

                                                                <div className="mt-2 grid gap-2 sm:grid-cols-2">

                                                                    <div>

                                                                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                                                                            Usuario
                                                                        </p>

                                                                        <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                            {sesionActiva.usuario?.nombre ??
                                                                                "Usuario"}
                                                                        </p>

                                                                    </div>

                                                                    <div>

                                                                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                                                                            Rol
                                                                        </p>

                                                                        <p className="text-sm font-semibold capitalize text-[var(--color-text)]">
                                                                            {sesionActiva.usuario?.rol ??
                                                                                "Usuario"}
                                                                        </p>

                                                                    </div>

                                                                    <div>

                                                                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                                                                            Fondo inicial
                                                                        </p>

                                                                        <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                            $
                                                                            {sesionActiva.monto_inicial.toLocaleString(
                                                                                "es-MX",
                                                                                {
                                                                                    minimumFractionDigits: 2,
                                                                                    maximumFractionDigits: 2,
                                                                                }
                                                                            )}
                                                                        </p>

                                                                    </div>

                                                                    <div>

                                                                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                                                                            Apertura
                                                                        </p>

                                                                        <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                            {formatearFecha(
                                                                                sesionActiva.fecha_apertura
                                                                            )}
                                                                        </p>

                                                                    </div>

                                                                </div>

                                                            </div>

                                                        )}

                                                </div>

                                                {/* INDICADOR */}

                                                <div
                                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${ocupada
                                                        ? "border-red-300 bg-red-100"
                                                        : seleccionada
                                                            ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                                                            : "border-slate-300 bg-white"
                                                        }`}
                                                >

                                                    {ocupada ? (

                                                        <span className="text-xs text-red-600">
                                                            ×
                                                        </span>

                                                    ) : (

                                                        seleccionada && (

                                                            <span className="text-xs text-white">
                                                                ✓
                                                            </span>

                                                        )

                                                    )}

                                                </div>

                                            </div>

                                        </button>

                                    );
                                }
                            )}

                        </div>

                    )}

                    {/* MONTO */}

                    {cajaSeleccionada && (

                        <div className="mt-6">

                            <label
                                htmlFor="montoInicial"
                                className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                            >
                                Fondo inicial
                            </label>

                            <div className="relative">

                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-secondary)]">
                                    $
                                </span>

                                <input
                                    id="montoInicial"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={montoInicial}
                                    onChange={(e) =>
                                        setMontoInicial(
                                            e.target.value
                                        )
                                    }
                                    disabled={abriendoCaja}
                                    placeholder="0.00"
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-8 pr-4 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                                />

                            </div>

                            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                Cantidad de efectivo con la que inicia la caja.
                            </p>

                        </div>

                    )}

                    {/* BOTÓN */}

                    {cajaSeleccionada && (

                        <button
                            type="button"
                            onClick={abrirCaja}
                            disabled={
                                abriendoCaja ||
                                !cajaSeleccionada ||
                                montoInicial === ""
                            }
                            className="mt-5 w-full rounded-xl bg-[var(--color-primary)] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                        >

                            {abriendoCaja
                                ? "Abriendo caja..."
                                : "Abrir caja"}

                        </button>

                    )}

                </div>

                {/* INFORMACIÓN */}

                <div className="mt-5 rounded-xl bg-slate-50 p-4">

                    <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                        Las cajas ocupadas se muestran automáticamente
                        para evitar que dos usuarios trabajen con la
                        misma caja al mismo tiempo.
                    </p>

                </div>

            </div>

        </div>
    );
}