"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { obtenerUsuarioPOS } from "../../../lib/usuarioPOS";
import { supabasePOS } from "../../../lib/supabase";

import PuntoDeVenta from "../../components/PuntoDeVenta";

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

interface SesionCaja {
    id: string;
    caja_id: string;
    usuario_apertura_id: string;
    monto_inicial: number;
    monto_esperado: number | null;
    monto_real: number | null;
    diferencia: number | null;
    estado: string;
    fecha_apertura: string;
    fecha_cierre: string | null;
}

interface CajaActual {
    id: string;
    sucursal_id: string;
    nombre: string;
    activo: boolean;
    sucursal_nombre: string;
}

/*
 * ============================================
 * PÁGINA PUNTO DE VENTA
 * ============================================
 */

export default function PosPage() {
    const router = useRouter();

    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [sesion, setSesion] =
        useState<SesionCaja | null>(null);

    const [caja, setCaja] =
        useState<CajaActual | null>(null);

    const [cargando, setCargando] =
        useState(true);

    const [error, setError] =
        useState("");

    /*
     * ============================================
     * CARGAR POS
     * ============================================
     */

    useEffect(() => {
        async function cargarPOS() {
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
                 * VALIDAR USUARIO
                 * ========================================
                 */

                if (
                    !usuarioActual?.id ||
                    !usuarioActual.negocio_id
                ) {
                    router.replace("/pos/login");
                    return;
                }

                setUsuario(
                    usuarioActual
                );

                /*
                 * ========================================
                 * BUSCAR SESIÓN ABIERTA
                 * ========================================
                 */

                const {
                    data: sesionData,
                    error: errorSesion,
                } = await supabasePOS
                    .from("sesiones_caja")
                    .select(`
            id,
            caja_id,
            usuario_apertura_id,
            monto_inicial,
            monto_esperado,
            monto_real,
            diferencia,
            estado,
            fecha_apertura,
            fecha_cierre
          `)
                    .eq(
                        "usuario_apertura_id",
                        usuarioActual.id
                    )
                    .eq(
                        "estado",
                        "abierta"
                    )
                    .order(
                        "fecha_apertura",
                        {
                            ascending: false,
                        }
                    )
                    .limit(1)
                    .maybeSingle();

                /*
                 * ========================================
                 * ERROR SESIÓN
                 * ========================================
                 */

                if (errorSesion) {
                    console.error(
                        "Error buscando sesión:",
                        errorSesion
                    );

                    setError(
                        "No se pudo consultar la sesión de caja."
                    );

                    return;
                }

                /*
                 * ========================================
                 * NO HAY SESIÓN
                 * ========================================
                 *
                 * Si el usuario entró directamente a /pos
                 * sin abrir una caja primero, lo mandamos
                 * a /pos/caj.
                 */

                if (!sesionData) {


                    router.replace("/pos/caj");

                    return;
                }

                /*
                 * ========================================
                 * GUARDAR SESIÓN
                 * ========================================
                 */

                const sesionActual =
                    sesionData as SesionCaja;

                setSesion(
                    sesionActual
                );

                /*
                 * ========================================
                 * OBTENER CAJA
                 * ========================================
                 */

                const {
                    data: cajaData,
                    error: errorCaja,
                } = await supabasePOS
                    .from("cajas")
                    .select(`
            id,
            sucursal_id,
            nombre,
            activo,
            sucursal:sucursales(
              id,
              nombre,
              activo
            )
          `)
                    .eq(
                        "id",
                        sesionActual.caja_id
                    )
                    .eq(
                        "activo",
                        true
                    )
                    .maybeSingle();

                /*
                 * ========================================
                 * ERROR CAJA
                 * ========================================
                 */

                if (errorCaja) {
                    console.error(
                        "Error obteniendo caja:",
                        errorCaja
                    );

                    setError(
                        "No se pudo obtener la información de la caja."
                    );

                    return;
                }

                if (!cajaData) {
                    setError(
                        "No se encontró la caja asociada a la sesión."
                    );

                    return;
                }

                /*
                 * ========================================
                 * NORMALIZAR SUCURSAL
                 * ========================================
                 */

                const sucursal =
                    Array.isArray(
                        cajaData.sucursal
                    )
                        ? cajaData.sucursal[0]
                        : cajaData.sucursal;

                const cajaActual: CajaActual = {
                    id:
                        cajaData.id,

                    sucursal_id:
                        cajaData.sucursal_id,

                    nombre:
                        cajaData.nombre,

                    activo:
                        cajaData.activo,

                    sucursal_nombre:
                        sucursal?.nombre ??
                        "Sucursal",
                };

                setCaja(
                    cajaActual
                );

            } catch (error) {
                console.error(
                    "Error inesperado cargando POS:",
                    error
                );

                setError(
                    "Ocurrió un error al cargar el punto de venta."
                );
            } finally {
                setCargando(false);
            }
        }

        cargarPOS();
    }, [router]);

    /*
     * ============================================
     * CARGANDO
     * ============================================
     */

    if (cargando) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
                <div className="text-center">

                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl shadow-sm">
                        🏪
                    </div>

                    <p className="text-sm font-semibold text-[var(--color-text)]">
                        Cargando punto de venta...
                    </p>

                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Preparando tu sesión
                    </p>

                </div>
            </div>
        );
    }

    /*
     * ============================================
     * ERROR
     * ============================================
     */

    if (
        error ||
        !usuario ||
        !sesion ||
        !caja
    ) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">

                <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-sm">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">
                        ⚠️
                    </div>

                    <h1 className="mt-5 text-xl font-bold text-[var(--color-text)]">
                        No se puede iniciar el punto de venta
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                        {error ||
                            "No se encontró una sesión de caja disponible."}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            router.replace("/pos/caj")
                        }
                        className="mt-6 w-full rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)]"
                    >
                        Ir a selección de caja
                    </button>

                </div>

            </div>
        );
    }

    /*
     * ============================================
     * PUNTO DE VENTA
     * ============================================
     *
     * Aquí NO aparece ninguna interfaz
     * relacionada con apertura de caja.
     *
     * La caja ya fue seleccionada y abierta
     * anteriormente en /pos/caj.
     */

    return (
        <PuntoDeVenta
            sesionId={
                sesion.id
            }

            cajaId={
                sesion.caja_id
            }

            sucursalId={
                caja.sucursal_id
            }

            usuarioId={
                usuario.id
            }

            negocioId={
                usuario.negocio_id!
            }

            cajaNombre={
                caja.nombre
            }

            sucursalNombre={
                caja.sucursal_nombre
            }

            usuarioNombre={
                usuario.nombre
            }

            usuarioRol={
                usuario.rol
            }

            onSalir={async () => {
                await supabasePOS.auth.signOut();

                window.location.href =
                    "/pos/login";
            }}
        />
    );
}