"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import {
    obtenerUsuarioPOS,
    type UsuarioPOS,
} from "../../../../lib/usuarioPOS";

import { supabasePOS } from "../../../../lib/supabase";

/*
 * ============================================================
 * TIPOS
 * ============================================================
 */

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

interface Caja {
    id: string;
    nombre: string;
    sucursal_nombre: string;
}

interface ResumenPago {
    /*
     * Componentes reales de dinero.
     *
     * Estos valores NO representan necesariamente
     * la modalidad completa de una venta.
     */
    efectivo: number;
    tarjeta: number;
    transferencia: number;

    /*
     * Modalidades completas de venta.
     *
     * Estos valores NO se suman a los componentes
     * anteriores porque provocarían doble conteo.
     */
    mixto: number;
    credito: number;
}

interface ResumenMovimientos {
    entrada: number;
    salida: number;
}

interface ResumenDevoluciones {
    total: number;
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    cantidad: number;
}

/*
 * ============================================================
 * PÁGINA CORTE
 * ============================================================
 */

export default function CortePage() {
    const router = useRouter();

    const [usuario, setUsuario] =
        useState<UsuarioPOS | null>(null);

    const [sesion, setSesion] =
        useState<SesionCaja | null>(null);

    const [caja, setCaja] =
        useState<Caja | null>(null);

    const [pagos, setPagos] =
        useState<ResumenPago>({
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            mixto: 0,
            credito: 0,
        });

    /*
     * Ventas brutas reales.
     *
     * Se obtiene directamente de ventas.total para
     * incluir correctamente ventas en crédito y mixtas.
     */
    const [ventasBrutas, setVentasBrutas] =
        useState(0);

    const [movimientos, setMovimientos] =
        useState<ResumenMovimientos>({
            entrada: 0,
            salida: 0,
        });

    const [devoluciones, setDevoluciones] =
        useState<ResumenDevoluciones>({
            total: 0,
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            cantidad: 0,
        });

    const [cargando, setCargando] =
        useState(true);

    const [error, setError] =
        useState("");

    /*
     * ========================================================
     * CARGAR CORTE
     * ========================================================
     */

    useEffect(() => {
        async function cargarCorte() {
            try {
                setCargando(true);
                setError("");

                /*
                 * ========================================
                 * USUARIO
                 * ========================================
                 */

                const usuarioActual =
                    await obtenerUsuarioPOS();

                if (!usuarioActual) {
                    router.replace("/pos/login");
                    return;
                }

                setUsuario(usuarioActual);

                /*
                 * ========================================
                 * SESIÓN DE CAJA
                 * ========================================
                 */

                const {
                    data: sesionData,
                    error: errorSesion,
                } = await supabasePOS
                    .from("sesiones_caja")
                    .select(
                        `
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
        `
                    )
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

                if (errorSesion) {
                    console.error(
                        "Error obteniendo sesión:",
                        errorSesion
                    );

                    setError(
                        "No se pudo consultar la sesión de caja."
                    );

                    return;
                }

                if (!sesionData) {
                    setError(
                        "No tienes una sesión de caja abierta."
                    );

                    return;
                }

                setSesion(
                    sesionData as SesionCaja
                );

                /*
                 * ========================================
                 * CAJA
                 * ========================================
                 */

                const {
                    data: cajaData,
                    error: errorCaja,
                } = await supabasePOS
                    .from("cajas")
                    .select(
                        `
id,
nombre,
sucursal: sucursales(
    nombre
)
        `
                    )
                    .eq(
                        "id",
                        sesionData.caja_id
                    )
                    .maybeSingle();

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

                if (cajaData) {
                    const sucursal =
                        Array.isArray(
                            cajaData.sucursal
                        )
                            ? cajaData.sucursal[0]
                            : cajaData.sucursal;

                    setCaja({
                        id: cajaData.id,
                        nombre: cajaData.nombre,
                        sucursal_nombre:
                            sucursal?.nombre ??
                            "Sucursal",
                    });
                }

                /*
                 * ========================================
                 * VENTAS DE LA SESIÓN
                 * ========================================
                 */

                const {
                    data: ventasData,
                    error: errorVentas,
                } = await supabasePOS
                    .from("ventas")
                    .select(
                        `
id,
total,
estado,
sesion_caja_id
        `
                    )
                    .eq(
                        "sesion_caja_id",
                        sesionData.id
                    )
                    .eq(
                        "estado",
                        "completada"
                    );

                if (errorVentas) {
                    console.error(
                        "Error obteniendo ventas:",
                        errorVentas
                    );

                    setError(
                        "No se pudieron consultar las ventas."
                    );

                    return;
                }

                /*
                 * ========================================
                 * VENTAS BRUTAS
                 * ========================================
                 *
                 * IMPORTANTE:
                 *
                 * Las ventas brutas se obtienen desde
                 * ventas.total.
                 *
                 * Esto permite incluir:
                 *
                 * - Efectivo
                 * - Tarjeta
                 * - Transferencia
                 * - Mixto
                 * - Crédito
                 *
                 * sin duplicar las ventas mixtas.
                 */

                const totalVentasBrutas =
                    (ventasData ?? []).reduce(
                        (total, venta) =>
                            total +
                            Number(
                                venta.total ?? 0
                            ),
                        0
                    );

                setVentasBrutas(
                    totalVentasBrutas
                );

                /*
                 * ========================================
                 * PAGOS
                 * ========================================
                 */

                const ventaIds =
                    (ventasData ?? []).map(
                        (venta) => venta.id
                    );

                let resumenPagos: ResumenPago = {
                    efectivo: 0,
                    tarjeta: 0,
                    transferencia: 0,
                    mixto: 0,
                    credito: 0,
                };

                /*
                 * Mapa para determinar la modalidad
                 * completa de cada venta.
                 */
                const pagosPorVenta =
                    new Map<
                        string,
                        {
                            total: number;
                            metodos: Set<string>;
                        }
                    >();

                if (ventaIds.length > 0) {
                    const {
                        data: pagosData,
                        error: errorPagos,
                    } = await supabasePOS
                        .from("pagos")
                        .select(
                            `
venta_id,
metodo_pago,
monto
        `
                        )
                        .in(
                            "venta_id",
                            ventaIds
                        );

                    if (errorPagos) {
                        console.error(
                            "Error obteniendo pagos:",
                            errorPagos
                        );

                        setError(
                            "No se pudieron consultar los pagos."
                        );

                        return;
                    }

                    for (
                        const pago of pagosData ?? []
                    ) {
                        const ventaId =
                            String(
                                pago.venta_id
                            );

                        const metodo =
                            String(
                                pago.metodo_pago
                            )
                                .toLowerCase()
                                .trim();

                        const monto =
                            Number(
                                pago.monto ?? 0
                            );

                        /*
                         * ==================================
                         * COMPONENTES REALES DE COBRO
                         * ==================================
                         *
                         * Estos sí representan dinero
                         * recibido por cada medio.
                         */

                        if (
                            metodo ===
                            "efectivo"
                        ) {
                            resumenPagos.efectivo +=
                                monto;
                        }

                        if (
                            metodo ===
                            "tarjeta"
                        ) {
                            resumenPagos.tarjeta +=
                                monto;
                        }

                        if (
                            metodo ===
                            "transferencia"
                        ) {
                            resumenPagos.transferencia +=
                                monto;
                        }

                        /*
                         * ==================================
                         * AGRUPAR PAGOS POR VENTA
                         * ==================================
                         */

                        const existente =
                            pagosPorVenta.get(
                                ventaId
                            );

                        if (existente) {
                            existente.total +=
                                monto;

                            existente.metodos.add(
                                metodo
                            );
                        } else {
                            pagosPorVenta.set(
                                ventaId,
                                {
                                    total: monto,
                                    metodos:
                                        new Set([
                                            metodo,
                                        ]),
                                }
                            );
                        }
                    }

                    /*
                     * ==================================
                     * CLASIFICAR MODALIDAD DE VENTA
                     * ==================================
                     */

                    for (
                        const venta of
                        pagosPorVenta.values()
                    ) {
                        const metodos =
                            venta.metodos;

                        /*
                         * Si existe explícitamente
                         * el método mixto.
                         */
                        if (
                            metodos.has(
                                "mixto"
                            )
                        ) {
                            resumenPagos.mixto +=
                                venta.total;

                            continue;
                        }

                        /*
                         * Crédito puro.
                         *
                         * No afecta efectivo.
                         */
                        if (
                            metodos.has(
                                "credito"
                            ) &&
                            metodos.size === 1
                        ) {
                            resumenPagos.credito +=
                                venta.total;

                            continue;
                        }

                        /*
                         * Si existen dos o más métodos
                         * reales, la venta es mixta.
                         *
                         * Ejemplo:
                         *
                         * efectivo $200
                         * tarjeta  $200
                         *
                         * Venta total = $400
                         *
                         * Mixto = $400
                         */
                        const metodosReales =
                            Array.from(
                                metodos
                            ).filter(
                                (metodo) =>
                                    metodo !==
                                    "credito" &&
                                    metodo !==
                                    "mixto"
                            );

                        if (
                            metodosReales.length >
                            1
                        ) {
                            resumenPagos.mixto +=
                                venta.total;
                        }
                    }
                }

                setPagos(
                    resumenPagos
                );

                /*
                 * ========================================
                 * MOVIMIENTOS DE CAJA
                 * ========================================
                 *
                 * Las devoluciones NO se incluyen
                 * como salidas aquí.
                 *
                 * Se calculan por separado mediante
                 * la tabla devoluciones.
                 *
                 */

                const {
                    data: movimientosData,
                    error: errorMovimientos,
                } = await supabasePOS
                    .from("movimientos_caja")
                    .select(
                        `
tipo,
monto,
concepto
        `
                    )
                    .eq(
                        "sesion_caja_id",
                        sesionData.id
                    );

                if (errorMovimientos) {
                    console.error(
                        "Error obteniendo movimientos:",
                        errorMovimientos
                    );

                    setError(
                        "No se pudieron consultar los movimientos de caja."
                    );

                    return;
                }

                const resumenMovimientos:
                    ResumenMovimientos = {
                    entrada: 0,
                    salida: 0,
                };

                for (
                    const movimiento of
                    movimientosData ?? []
                ) {
                    const tipo =
                        String(
                            movimiento.tipo
                        )
                            .toLowerCase()
                            .trim();

                    const concepto =
                        String(
                            movimiento.concepto ??
                            ""
                        )
                            .toLowerCase()
                            .trim();

                    const monto =
                        Number(
                            movimiento.monto ??
                            0
                        );

                    /*
                     * ENTRADAS
                     */

                    if (
                        tipo ===
                        "entrada"
                    ) {
                        resumenMovimientos.entrada +=
                            monto;
                    }

                    /*
                     * SALIDAS
                     *
                     * Las devoluciones se excluyen
                     * porque se calculan mediante
                     * devoluciones.efectivo.
                     */

                    if (
                        tipo ===
                        "salida" &&
                        !concepto.includes(
                            "reembolso por devolución"
                        )
                    ) {
                        resumenMovimientos.salida +=
                            monto;
                    }
                }

                setMovimientos(
                    resumenMovimientos
                );

                /*
                 * ========================================
                 * DEVOLUCIONES
                 * ========================================
                 */

                const {
                    data: devolucionesData,
                    error: errorDevoluciones,
                } = await supabasePOS
                    .from("devoluciones")
                    .select(
                        `
id,
monto_total,
estado,
metodo_reembolso,
sesion_caja_id
        `
                    )
                    .eq(
                        "sesion_caja_id",
                        sesionData.id
                    );

                if (errorDevoluciones) {
                    console.error(
                        "Error obteniendo devoluciones:",
                        errorDevoluciones
                    );

                    setError(
                        "No se pudieron consultar las devoluciones."
                    );

                    return;
                }

                const resumenDevoluciones:
                    ResumenDevoluciones = {
                    total: 0,
                    efectivo: 0,
                    tarjeta: 0,
                    transferencia: 0,
                    cantidad: 0,
                };

                for (
                    const devolucion of
                    devolucionesData ?? []
                ) {
                    /*
                     * Las devoluciones canceladas
                     * o anuladas no afectan el corte.
                     */

                    const estado =
                        String(
                            devolucion.estado ??
                            ""
                        )
                            .toLowerCase()
                            .trim();

                    if (
                        estado ===
                        "cancelada" ||
                        estado ===
                        "anulada"
                    ) {
                        continue;
                    }

                    const monto =
                        Number(
                            devolucion.monto_total ??
                            0
                        );

                    const metodo =
                        String(
                            devolucion.metodo_reembolso ??
                            ""
                        )
                            .toLowerCase()
                            .trim();

                    resumenDevoluciones.total +=
                        monto;

                    resumenDevoluciones.cantidad +=
                        1;

                    if (
                        metodo ===
                        "efectivo"
                    ) {
                        resumenDevoluciones.efectivo +=
                            monto;
                    }

                    if (
                        metodo ===
                        "tarjeta"
                    ) {
                        resumenDevoluciones.tarjeta +=
                            monto;
                    }

                    if (
                        metodo ===
                        "transferencia"
                    ) {
                        resumenDevoluciones.transferencia +=
                            monto;
                    }
                }

                setDevoluciones(
                    resumenDevoluciones
                );
            } catch (error) {
                console.error(
                    "Error cargando corte:",
                    error
                );

                setError(
                    "Ocurrió un error al cargar el corte."
                );
            } finally {
                setCargando(false);
            }
        }

        cargarCorte();
    }, [router]);

    /*
     * ========================================================
     * TOTALES
     * ========================================================
     *
     * IMPORTANTE:
     *
     * ventasBrutas = suma real de ventas.total.
     *
     * NO se suman aquí:
     *
     * pagos.mixto
     * pagos.credito
     *
     * porque esos valores son clasificaciones
     * de ventas y no componentes adicionales.
     */

    const totalPagos =
        ventasBrutas;

    /*
     * ========================================================
     * VENTAS NETAS
     * ========================================================
     */

    const totalVentasNetas =
        totalPagos -
        devoluciones.total;

    /*
     * ========================================================
     * NETOS POR MÉTODO
     * ========================================================
     *
     * Mixto no se calcula como:
     *
     * mixto - devolución
     *
     * porque una venta mixta ya está distribuida
     * entre sus componentes reales.
     *
     * Crédito tampoco afecta efectivo.
     */

    const efectivoNeto =
        pagos.efectivo -
        devoluciones.efectivo;

    const tarjetaNeta =
        pagos.tarjeta -
        devoluciones.tarjeta;

    const transferenciaNeta =
        pagos.transferencia -
        devoluciones.transferencia;

    /*
     * ========================================================
     * EFECTIVO ESPERADO
     * ========================================================
     *
     * Fondo inicial
     * + ventas cobradas en efectivo
     * + entradas
     * - retiros reales
     * - devoluciones en efectivo
     *
     * IMPORTANTE:
     *
     * Una venta mixta solamente aporta
     * su componente efectivo.
     *
     * Una venta a crédito aporta $0.
     *
     * Tarjeta y transferencia aportan $0.
     */

    const efectivoEsperado =
        Number(
            sesion?.monto_inicial ?? 0
        ) +
        pagos.efectivo +
        movimientos.entrada -
        movimientos.salida -
        devoluciones.efectivo;

    /*
     * ========================================================
     * CARGANDO
     * ========================================================
     */

    if (cargando) {
        return (
            <div className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-[var(--color-background)] px-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl shadow-sm">
                        📊
                    </div>

                    <p className="text-sm font-bold text-[var(--color-text)]">
                        Cargando corte...
                    </p>

                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Calculando movimientos y pagos
                    </p>
                </div>
            </div>
        );
    }

    /*
     * ========================================================
     * ERROR
     * ========================================================
     */

    if (
        error ||
        !usuario ||
        !sesion
    ) {
        return (
            <div className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-[var(--color-background)] px-4">
                <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">
                        ⚠️
                    </div>

                    <h1 className="mt-5 text-xl font-bold text-[var(--color-text)]">
                        No se puede mostrar el corte
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                        {error ||
                            "No se encontró una sesión de caja abierta."}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/pos/sistema"
                            )
                        }
                        className="mt-6 w-full rounded-xl bg-[var(--color-primary)] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)]"
                    >
                        Volver al punto de venta
                    </button>
                </div>
            </div>
        );
    }

    /*
     * ========================================================
     * PANTALLA CORTE
     * ========================================================
     */

    return (
        <div className="min-h-[calc(100vh-72px)] bg-[var(--color-background)] px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">

                {/* ENCABEZADO */}

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">
                        Corte de caja
                    </h1>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Resumen de ventas, pagos, devoluciones y movimientos de la sesión actual.
                    </p>
                </div>

                {/* INFORMACIÓN DE CAJA */}

                <div className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Sesión actual
                            </p>

                            <h2 className="mt-1 text-lg font-bold text-[var(--color-text)]">
                                {caja?.nombre ??
                                    "Caja"}
                            </h2>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                {caja?.sucursal_nombre ??
                                    "Sucursal"}
                            </p>
                        </div>

                        <div className="rounded-xl bg-emerald-50 px-4 py-3">
                            <p className="text-xs font-semibold text-emerald-700">
                                Usuario
                            </p>

                            <p className="mt-1 text-sm font-bold text-emerald-900">
                                {usuario.nombre}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ====================================================
                    RESUMEN PRINCIPAL
                   ==================================================== */}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

                    {/* VENTAS BRUTAS */}

                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-2xl">
                                🛒
                            </span>

                            <span className="text-xs font-bold text-[var(--color-text-secondary)]">
                                VENTAS BRUTAS
                            </span>
                        </div>

                        <p className="mt-5 text-2xl font-extrabold text-[var(--color-text)]">
                            $
                            {totalPagos.toFixed(
                                2
                            )}
                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Total de ventas realizadas
                        </p>
                    </div>

                    {/* EFECTIVO */}

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-2xl">
                                💵
                            </span>

                            <span className="text-xs font-bold text-emerald-700">
                                EFECTIVO
                            </span>
                        </div>

                        <p className="mt-5 text-2xl font-extrabold text-emerald-900">
                            $
                            {pagos.efectivo.toFixed(
                                2
                            )}
                        </p>

                        <p className="mt-1 text-xs text-emerald-700">
                            Cobros originales
                        </p>
                    </div>

                    {/* TARJETA */}

                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-2xl">
                                💳
                            </span>

                            <span className="text-xs font-bold text-blue-700">
                                TARJETA
                            </span>
                        </div>

                        <p className="mt-5 text-2xl font-extrabold text-blue-900">
                            $
                            {pagos.tarjeta.toFixed(
                                2
                            )}
                        </p>

                        <p className="mt-1 text-xs text-blue-700">
                            Cobros originales
                        </p>
                    </div>

                    {/* TRANSFERENCIA */}

                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-2xl">
                                🏦
                            </span>

                            <span className="text-xs font-bold text-violet-700">
                                TRANSFERENCIA
                            </span>
                        </div>

                        <p className="mt-5 text-2xl font-extrabold text-violet-900">
                            $
                            {pagos.transferencia.toFixed(
                                2
                            )}
                        </p>

                        <p className="mt-1 text-xs text-violet-700">
                            Cobros originales
                        </p>
                    </div>

                    {/* MIXTO */}

                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-2xl">
                                🔀
                            </span>

                            <span className="text-xs font-bold text-cyan-700">
                                MIXTO
                            </span>
                        </div>

                        <p className="mt-5 text-2xl font-extrabold text-cyan-900">
                            $
                            {pagos.mixto.toFixed(
                                2
                            )}
                        </p>

                        <p className="mt-1 text-xs text-cyan-700">
                            Ventas con múltiples métodos
                        </p>
                    </div>

                    {/* CRÉDITO */}

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-2xl">
                                📒
                            </span>

                            <span className="text-xs font-bold text-amber-700">
                                CRÉDITO
                            </span>
                        </div>

                        <p className="mt-5 text-2xl font-extrabold text-amber-900">
                            $
                            {pagos.credito.toFixed(
                                2
                            )}
                        </p>

                        <p className="mt-1 text-xs text-amber-700">
                            Ventas pendientes de cobro
                        </p>
                    </div>
                </div>

                {/* ====================================================
                    VENTAS NETAS
                   ==================================================== */}

                <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                    📊
                                </span>

                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                                        Ventas netas
                                    </p>

                                    <p className="mt-1 text-sm text-indigo-800">
                                        Ventas brutas menos devoluciones.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white/80 px-5 py-4 text-right">
                            <p className="text-xs font-semibold text-indigo-700">
                                Total neto
                            </p>

                            <p className="mt-1 text-3xl font-extrabold text-indigo-950">
                                $
                                {totalVentasNetas.toFixed(
                                    2
                                )}
                            </p>
                        </div>
                    </div>

                    {/* NETOS POR MÉTODO */}

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">

                        {/* EFECTIVO */}

                        <div className="rounded-xl bg-white/70 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-indigo-900">
                                    💵 Efectivo
                                </span>

                                <span className="font-bold text-indigo-950">
                                    $
                                    {efectivoNeto.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            <p className="mt-1 text-xs text-indigo-700">
                                Cobro bruto menos devolución
                            </p>
                        </div>

                        {/* TARJETA */}

                        <div className="rounded-xl bg-white/70 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-indigo-900">
                                    💳 Tarjeta
                                </span>

                                <span className="font-bold text-indigo-950">
                                    $
                                    {tarjetaNeta.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            <p className="mt-1 text-xs text-indigo-700">
                                Cobro bruto menos devolución
                            </p>
                        </div>

                        {/* TRANSFERENCIA */}

                        <div className="rounded-xl bg-white/70 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-indigo-900">
                                    🏦 Transferencia
                                </span>

                                <span className="font-bold text-indigo-950">
                                    $
                                    {transferenciaNeta.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            <p className="mt-1 text-xs text-indigo-700">
                                Cobro bruto menos devolución
                            </p>
                        </div>
                    </div>
                </div>

                {/* ====================================================
                    DESGLOSE DE PAGOS
                   ==================================================== */}

                <div className="mt-5 grid gap-5 lg:grid-cols-2">

                    {/* PAGOS */}

                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
                        <h2 className="text-lg font-bold text-[var(--color-text)]">
                            Desglose de ventas brutas
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Distribución de los cobros y modalidades de las ventas realizadas.
                        </p>

                        <div className="mt-5 space-y-3">

                            {/* EFECTIVO */}

                            <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">
                                        💵
                                    </span>

                                    <span className="text-sm font-semibold text-emerald-900">
                                        Efectivo
                                    </span>
                                </div>

                                <span className="font-bold text-emerald-900">
                                    $
                                    {pagos.efectivo.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            {/* TARJETA */}

                            <div className="flex items-center justify-between rounded-xl bg-blue-50 p-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">
                                        💳
                                    </span>

                                    <span className="text-sm font-semibold text-blue-900">
                                        Tarjeta
                                    </span>
                                </div>

                                <span className="font-bold text-blue-900">
                                    $
                                    {pagos.tarjeta.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            {/* TRANSFERENCIA */}

                            <div className="flex items-center justify-between rounded-xl bg-violet-50 p-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">
                                        🏦
                                    </span>

                                    <span className="text-sm font-semibold text-violet-900">
                                        Transferencia
                                    </span>
                                </div>

                                <span className="font-bold text-violet-900">
                                    $
                                    {pagos.transferencia.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            {/* MIXTO */}

                            <div className="flex items-center justify-between rounded-xl bg-cyan-50 p-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">
                                        🔀
                                    </span>

                                    <div>
                                        <span className="text-sm font-semibold text-cyan-900">
                                            Mixto
                                        </span>

                                        <p className="text-xs text-cyan-700">
                                            Total de ventas mixtas
                                        </p>
                                    </div>
                                </div>

                                <span className="font-bold text-cyan-900">
                                    $
                                    {pagos.mixto.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            {/* CRÉDITO */}

                            <div className="flex items-center justify-between rounded-xl bg-amber-50 p-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">
                                        📒
                                    </span>

                                    <div>
                                        <span className="text-sm font-semibold text-amber-900">
                                            Crédito
                                        </span>

                                        <p className="text-xs text-amber-700">
                                            Ventas pendientes de cobro
                                        </p>
                                    </div>
                                </div>

                                <span className="font-bold text-amber-900">
                                    $
                                    {pagos.credito.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            {/* TOTAL BRUTO */}

                            <div className="border-t border-[var(--color-border)] pt-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-[var(--color-text)]">
                                        Total ventas brutas
                                    </span>

                                    <span className="text-lg font-extrabold text-[var(--color-text)]">
                                        $
                                        {totalPagos.toFixed(
                                            2
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                                    El importe de <strong>Mixto</strong> y <strong>Crédito</strong> es una clasificación de la venta. No se suma nuevamente al total porque ya está incluido en el total de ventas brutas.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* MOVIMIENTOS */}

                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
                        <h2 className="text-lg font-bold text-[var(--color-text)]">
                            Movimientos de caja
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Entradas y salidas reales de efectivo durante la sesión.
                        </p>

                        <div className="mt-5 space-y-3">

                            {/* ENTRADAS */}

                            <div className="flex items-center justify-between rounded-xl bg-green-50 p-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">
                                        ↗️
                                    </span>

                                    <div>
                                        <p className="text-sm font-semibold text-green-900">
                                            Entradas
                                        </p>

                                        <p className="text-xs text-green-700">
                                            {movimientos.entrada > 0
                                                ? "Movimientos de entrada"
                                                : "Sin entradas"}
                                        </p>
                                    </div>
                                </div>

                                <span className="font-bold text-green-900">
                                    $
                                    {movimientos.entrada.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            {/* SALIDAS */}

                            <div className="flex items-center justify-between rounded-xl bg-red-50 p-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">
                                        ↘️
                                    </span>

                                    <div>
                                        <p className="text-sm font-semibold text-red-900">
                                            Salidas
                                        </p>

                                        <p className="text-xs text-red-700">
                                            {movimientos.salida > 0
                                                ? "Retiros de efectivo"
                                                : "Sin salidas"}
                                        </p>
                                    </div>
                                </div>

                                <span className="font-bold text-red-900">
                                    $
                                    {movimientos.salida.toFixed(
                                        2
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ====================================================
                    DEVOLUCIONES
                   ==================================================== */}

                <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                    ↩️
                                </span>

                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                                        Devoluciones
                                    </p>

                                    <p className="mt-1 text-lg font-bold text-orange-950">
                                        {devoluciones.cantidad}{" "}
                                        {devoluciones.cantidad === 1
                                            ? "devolución"
                                            : "devoluciones"}
                                    </p>
                                </div>
                            </div>

                            <p className="mt-3 max-w-xl text-xs leading-5 text-orange-800">
                                Reembolsos realizados durante esta sesión. Se descuentan de las ventas para obtener el total neto.
                            </p>
                        </div>

                        <div className="rounded-xl bg-white/70 px-5 py-4 text-right">
                            <p className="text-xs font-semibold text-orange-700">
                                Total devuelto
                            </p>

                            <p className="mt-1 text-2xl font-extrabold text-orange-950">
                                $
                                {devoluciones.total.toFixed(
                                    2
                                )}
                            </p>
                        </div>
                    </div>

                    {/* DESGLOSE DEVOLUCIONES */}

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">

                        {/* EFECTIVO */}

                        <div className="rounded-xl bg-white/70 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-orange-900">
                                    💵 Efectivo
                                </span>

                                <span className="font-bold text-orange-950">
                                    $
                                    {devoluciones.efectivo.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            <p className="mt-1 text-xs text-orange-700">
                                Sale físicamente de la caja
                            </p>
                        </div>

                        {/* TARJETA */}

                        <div className="rounded-xl bg-white/70 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-orange-900">
                                    💳 Tarjeta
                                </span>

                                <span className="font-bold text-orange-950">
                                    $
                                    {devoluciones.tarjeta.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            <p className="mt-1 text-xs text-orange-700">
                                Reembolso por tarjeta
                            </p>
                        </div>

                        {/* TRANSFERENCIA */}

                        <div className="rounded-xl bg-white/70 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-orange-900">
                                    🏦 Transferencia
                                </span>

                                <span className="font-bold text-orange-950">
                                    $
                                    {devoluciones.transferencia.toFixed(
                                        2
                                    )}
                                </span>
                            </div>

                            <p className="mt-1 text-xs text-orange-700">
                                Reembolso por transferencia
                            </p>
                        </div>
                    </div>
                </div>

                {/* ====================================================
                    EFECTIVO ESPERADO
                   ==================================================== */}

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                                Efectivo esperado en caja
                            </p>

                            <p className="mt-2 text-3xl font-extrabold text-amber-950">
                                $
                                {efectivoEsperado.toFixed(
                                    2
                                )}
                            </p>

                            <p className="mt-1 max-w-xl text-xs leading-5 text-amber-800">
                                Fondo inicial + ventas cobradas en efectivo + entradas - salidas - devoluciones en efectivo. Los pagos con tarjeta, transferencia y crédito no forman parte del efectivo físico.
                            </p>
                        </div>

                        <div className="rounded-xl bg-white/70 px-4 py-3 text-right">
                            <p className="text-xs font-semibold text-amber-700">
                                Fondo inicial
                            </p>

                            <p className="mt-1 font-bold text-amber-950">
                                $
                                {Number(
                                    sesion.monto_inicial
                                ).toFixed(
                                    2
                                )}
                            </p>
                        </div>
                    </div>

                    {/* FORMULA VISIBLE */}

                    <div className="mt-5 rounded-xl bg-white/60 p-4">
                        <p className="text-xs font-semibold text-amber-800">
                            Cómo se calcula
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-amber-950">
                            <span>
                                $
                                {Number(
                                    sesion.monto_inicial
                                ).toFixed(2)}
                            </span>

                            <span>+</span>

                            <span>
                                $
                                {pagos.efectivo.toFixed(
                                    2
                                )}
                            </span>

                            <span>+</span>

                            <span>
                                $
                                {movimientos.entrada.toFixed(
                                    2
                                )}
                            </span>

                            <span>−</span>

                            <span>
                                $
                                {movimientos.salida.toFixed(
                                    2
                                )}
                            </span>

                            <span>−</span>

                            <span>
                                $
                                {devoluciones.efectivo.toFixed(
                                    2
                                )}
                            </span>

                            <span>=</span>

                            <span className="text-lg">
                                $
                                {efectivoEsperado.toFixed(
                                    2
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ====================================================
                    RESUMEN FINAL
                   ==================================================== */}

                <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                        Resumen final
                    </h2>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">

                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                                Ventas brutas
                            </p>

                            <p className="mt-1 text-xl font-extrabold text-[var(--color-text)]">
                                $
                                {totalPagos.toFixed(2)}
                            </p>
                        </div>

                        <div className="rounded-xl bg-orange-50 p-4">
                            <p className="text-xs font-semibold text-orange-700">
                                Devoluciones
                            </p>

                            <p className="mt-1 text-xl font-extrabold text-orange-950">
                                -$
                                {devoluciones.total.toFixed(2)}
                            </p>
                        </div>

                        <div className="rounded-xl bg-indigo-50 p-4">
                            <p className="text-xs font-semibold text-indigo-700">
                                Ventas netas
                            </p>

                            <p className="mt-1 text-xl font-extrabold text-indigo-950">
                                $
                                {totalVentasNetas.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* RESUMEN DE MODALIDADES */}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">

                        <div className="rounded-xl bg-cyan-50 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-cyan-700">
                                        Ventas mixtas
                                    </p>

                                    <p className="mt-1 text-xs text-cyan-600">
                                        Ventas con múltiples métodos
                                    </p>
                                </div>

                                <p className="text-lg font-extrabold text-cyan-950">
                                    $
                                    {pagos.mixto.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl bg-amber-50 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-amber-700">
                                        Ventas a crédito
                                    </p>

                                    <p className="mt-1 text-xs text-amber-600">
                                        Pendientes de cobro
                                    </p>
                                </div>

                                <p className="text-lg font-extrabold text-amber-950">
                                    $
                                    {pagos.credito.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ====================================================
                    ACCIONES
                   ==================================================== */}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/pos/sistema/caja"
                            )
                        }
                        className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3.5 text-sm font-bold text-[var(--color-text)] transition hover:bg-slate-50"
                    >
                        Ir a caja
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/pos/sistema"
                            )
                        }
                        className="flex-1 rounded-xl bg-[var(--color-primary)] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)]"
                    >
                        Volver al punto de venta
                    </button>
                </div>
            </div>
        </div>
    );
}