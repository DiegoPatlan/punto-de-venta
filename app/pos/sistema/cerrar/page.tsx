"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerUsuarioPOS } from "../../../../lib/usuarioPOS";
import { supabasePOS } from "../../../../lib/supabase";

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

interface Caja {
    id: string;
    sucursal_id: string;
    nombre: string;
    activo: boolean;
    sucursal_nombre: string;
}

interface ResumenPagos {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    mixto: number;
    credito: number;
    otros: number;
    total: number;
}

interface ResumenMovimientos {
    entradas: number;
    salidas: number;
}

interface ResumenDevoluciones {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    mixto: number;
    otros: number;
    total: number;
}

interface MovimientoCaja {
    id: string;
    tipo: string | null;
    concepto: string | null;
    monto: number | null;
    created_at: string;
}

interface Devolucion {
    id: string;
    venta_id: string | null;
    monto_total: number | null;
    metodo_reembolso: string | null;
    estado: string | null;
    created_at: string;
}

/*
 * ============================================
 * HELPERS
 * ============================================
 */

function normalizarTexto(valor: unknown): string {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function normalizarMetodo(valor: unknown): string {
    const texto = normalizarTexto(valor);

    if (
        texto === "efectivo" ||
        texto === "cash"
    ) {
        return "efectivo";
    }

    /*
     * IMPORTANTE:
     * Crédito NO debe convertirse en tarjeta.
     */
    if (texto === "credito") {
        return "credito";
    }

    if (
        texto === "tarjeta" ||
        texto === "debito"
    ) {
        return "tarjeta";
    }

    if (
        texto === "transferencia" ||
        texto === "transfer"
    ) {
        return "transferencia";
    }

    if (
        texto === "mixto" ||
        texto === "mix"
    ) {
        return "mixto";
    }

    return texto;
}

function esDevolucionMovimiento(
    movimiento: MovimientoCaja
): boolean {
    const tipo = normalizarTexto(movimiento.tipo);
    const concepto = normalizarTexto(
        movimiento.concepto
    );

    if (
        tipo === "devolucion" ||
        tipo === "reembolso"
    ) {
        return true;
    }

    if (
        concepto.includes("devolucion") ||
        concepto.includes("reembolso")
    ) {
        return true;
    }

    return false;
}

/*
 * ============================================
 * COMPONENTE
 * ============================================
 */

export default function CerrarCajaPage() {
    const router = useRouter();

    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [sesion, setSesion] =
        useState<SesionCaja | null>(null);

    const [caja, setCaja] =
        useState<Caja | null>(null);

    const [montoReal, setMontoReal] =
        useState("");

    const [cargando, setCargando] =
        useState(true);

    const [cerrandoCaja, setCerrandoCaja] =
        useState(false);

    const [cerrada, setCerrada] =
        useState(false);

    const [error, setError] =
        useState("");

    const [resumenPagos, setResumenPagos] =
        useState<ResumenPagos>({
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            mixto: 0,
            credito: 0,
            otros: 0,
            total: 0,
        });

    const [resumenMovimientos, setResumenMovimientos] =
        useState<ResumenMovimientos>({
            entradas: 0,
            salidas: 0,
        });

    const [resumenDevoluciones, setResumenDevoluciones] =
        useState<ResumenDevoluciones>({
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            mixto: 0,
            otros: 0,
            total: 0,
        });

    /*
     * ============================================
     * CARGAR INFORMACIÓN
     * ============================================
     */

    useEffect(() => {
        let activo = true;

        async function cargarInformacion() {
            try {
                setCargando(true);
                setError("");

                /*
                 * USUARIO ACTUAL
                 */
                const usuarioActual =
                    await obtenerUsuarioPOS();

                if (
                    !usuarioActual?.id ||
                    !usuarioActual?.negocio_id
                ) {
                    router.replace("/pos/login");
                    return;
                }

                if (!activo) return;

                const usuarioNormalizado: UsuarioActual = {
                    id: usuarioActual.id,
                    negocio_id:
                        usuarioActual.negocio_id,
                    nombre:
                        usuarioActual.nombre ?? "",
                    rol:
                        usuarioActual.rol ?? "",
                };

                setUsuario(usuarioNormalizado);

                /*
                 * SESIÓN ABIERTA
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
                    .eq("estado", "abierta")
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
                        errorSesion.message ||
                        "No se pudo obtener la sesión de caja."
                    );

                    return;
                }

                if (!sesionData) {
                    setError(
                        "No se encontró una sesión de caja abierta."
                    );

                    return;
                }

                if (!activo) return;

                setSesion(
                    sesionData as SesionCaja
                );

                /*
                 * CAJA
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
                        sucursal: sucursales(
                            id,
                            nombre,
                            activo
                        )
                    `)
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
                        errorCaja.message ||
                        "No se pudo obtener la caja."
                    );

                    return;
                }

                if (!cajaData) {
                    setError(
                        "No se encontró la caja asociada a la sesión."
                    );

                    return;
                }

                const sucursal = Array.isArray(
                    cajaData.sucursal
                )
                    ? cajaData.sucursal[0]
                    : cajaData.sucursal;

                if (!activo) return;

                setCaja({
                    id: cajaData.id,
                    sucursal_id:
                        cajaData.sucursal_id,
                    nombre:
                        cajaData.nombre,
                    activo:
                        cajaData.activo,
                    sucursal_nombre:
                        sucursal?.nombre ??
                        "Sucursal",
                });

                /*
                 * ============================================
                 * VENTAS DE LA SESIÓN
                 * ============================================
                 */

                const {
                    data: ventasData,
                    error: errorVentas,
                } = await supabasePOS
                    .from("ventas")
                    .select(`
                        id,
                        total,
                        estado
                    `)
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
                        errorVentas.message ||
                        "No se pudieron obtener las ventas."
                    );

                    return;
                }

                const ventas =
                    ventasData ?? [];

                const ventaIds =
                    ventas.map(
                        (venta) => venta.id
                    );

                /*
                 * ============================================
                 * RESUMEN DE PAGOS
                 * ============================================
                 */

                let resumen: ResumenPagos = {
                    efectivo: 0,
                    tarjeta: 0,
                    transferencia: 0,
                    mixto: 0,
                    credito: 0,
                    otros: 0,

                    /*
                     * El total se calcula desde ventas.total,
                     * no desde pagos.
                     */
                    total: ventas.reduce(
                        (total, venta) =>
                            total +
                            Number(
                                venta.total ?? 0
                            ),
                        0
                    ),
                };

                if (ventaIds.length > 0) {
                    const {
                        data: pagosData,
                        error: errorPagos,
                    } = await supabasePOS
                        .from("pagos")
                        .select(`
                            id,
                            venta_id,
                            metodo_pago,
                            monto,
                            monto_recibido,
                            cambio
                        `)
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
                            errorPagos.message ||
                            "No se pudieron obtener los pagos."
                        );

                        return;
                    }

                    /*
                     * Agrupamos los métodos por venta
                     * para detectar ventas mixtas.
                     */
                    const metodosPorVenta =
                        new Map<
                            string,
                            Set<string>
                        >();

                    (
                        pagosData ?? []
                    ).forEach((pago) => {
                        const ventaId =
                            String(
                                pago.venta_id
                            );

                        const metodo =
                            normalizarMetodo(
                                pago.metodo_pago
                            );

                        if (
                            !metodosPorVenta.has(
                                ventaId
                            )
                        ) {
                            metodosPorVenta.set(
                                ventaId,
                                new Set()
                            );
                        }

                        metodosPorVenta
                            .get(ventaId)!
                            .add(metodo);
                    });

                    /*
                     * Componentes reales de pago.
                     *
                     * IMPORTANTE:
                     * Una venta mixta puede tener:
                     *
                     * $200 efectivo
                     * $200 tarjeta
                     *
                     * Los $200 de efectivo sí entran
                     * físicamente a caja.
                     *
                     * Los $200 de tarjeta no.
                     */
                    (
                        pagosData ?? []
                    ).forEach((pago) => {
                        const monto =
                            Number(
                                pago.monto ?? 0
                            );

                        if (monto <= 0) {
                            return;
                        }

                        const metodo =
                            normalizarMetodo(
                                pago.metodo_pago
                            );

                        /*
                         * Crédito:
                         * no se agrega a efectivo,
                         * tarjeta ni transferencia.
                         */
                        if (
                            metodo ===
                            "credito"
                        ) {
                            return;
                        }

                        if (
                            metodo ===
                            "efectivo"
                        ) {
                            resumen.efectivo +=
                                monto;
                            return;
                        }

                        if (
                            metodo ===
                            "tarjeta"
                        ) {
                            resumen.tarjeta +=
                                monto;
                            return;
                        }

                        if (
                            metodo ===
                            "transferencia"
                        ) {
                            resumen.transferencia +=
                                monto;
                            return;
                        }

                        /*
                         * Si existe explícitamente
                         * como mixto, lo dejamos como
                         * clasificación.
                         */
                        if (
                            metodo ===
                            "mixto"
                        ) {
                            return;
                        }

                        resumen.otros +=
                            monto;
                    });

                    /*
                     * Clasificación de ventas:
                     *
                     * - Si la venta tiene varios métodos,
                     *   es MIXTA.
                     * - Si tiene crédito, es CRÉDITO.
                     *
                     * Estas cantidades son solo
                     * clasificación y no vuelven a
                     * sumarse al total.
                     */
                    ventas.forEach((venta) => {
                        const metodos =
                            metodosPorVenta.get(
                                venta.id
                            );

                        if (!metodos) {
                            return;
                        }

                        const metodosReales =
                            Array.from(
                                metodos
                            ).filter(
                                (metodo) =>
                                    metodo !== ""
                            );

                        if (
                            metodosReales.includes(
                                "credito"
                            )
                        ) {
                            resumen.credito +=
                                Number(
                                    venta.total ??
                                    0
                                );

                            return;
                        }

                        if (
                            metodosReales.length >
                            1
                        ) {
                            resumen.mixto +=
                                Number(
                                    venta.total ??
                                    0
                                );
                        }
                    });
                }

                /*
                 * ============================================
                 * DEVOLUCIONES
                 * ============================================
                 */

                let resumenDev:
                    ResumenDevoluciones = {
                    efectivo: 0,
                    tarjeta: 0,
                    transferencia: 0,
                    mixto: 0,
                    otros: 0,
                    total: 0,
                };

                if (
                    ventaIds.length > 0
                ) {
                    const {
                        data: devolucionesData,
                        error:
                        errorDevoluciones,
                    } =
                        await supabasePOS
                            .from(
                                "devoluciones"
                            )
                            .select(`
                                id,
                                venta_id,
                                monto_total,
                                metodo_reembolso,
                                estado,
                                created_at
                            `)
                            .in(
                                "venta_id",
                                ventaIds
                            );

                    if (
                        errorDevoluciones
                    ) {
                        console.error(
                            "Error obteniendo devoluciones:",
                            errorDevoluciones
                        );
                    } else {
                        (
                            devolucionesData as
                            Devolucion[] ??
                            []
                        ).forEach(
                            (
                                devolucion
                            ) => {
                                const estado =
                                    normalizarTexto(
                                        devolucion.estado
                                    );

                                if (
                                    estado &&
                                    ![
                                        "completada",
                                        "completado",
                                        "aprobada",
                                        "aprobado",
                                    ].includes(
                                        estado
                                    )
                                ) {
                                    return;
                                }

                                const monto =
                                    Number(
                                        devolucion.monto_total ??
                                        0
                                    );

                                if (
                                    monto <= 0
                                ) {
                                    return;
                                }

                                const metodo =
                                    normalizarMetodo(
                                        devolucion.metodo_reembolso
                                    );

                                resumenDev.total +=
                                    monto;

                                if (
                                    metodo ===
                                    "efectivo"
                                ) {
                                    resumenDev.efectivo +=
                                        monto;
                                } else if (
                                    metodo ===
                                    "tarjeta"
                                ) {
                                    resumenDev.tarjeta +=
                                        monto;
                                } else if (
                                    metodo ===
                                    "transferencia"
                                ) {
                                    resumenDev.transferencia +=
                                        monto;
                                } else if (
                                    metodo ===
                                    "mixto"
                                ) {
                                    resumenDev.mixto +=
                                        monto;
                                } else {
                                    resumenDev.otros +=
                                        monto;
                                }
                            }
                        );
                    }
                }

                /*
                 * ============================================
                 * MOVIMIENTOS DE CAJA
                 * ============================================
                 */

                const {
                    data: movimientosData,
                    error: errorMovimientos,
                } = await supabasePOS
                    .from("movimientos_caja")
                    .select(`
                        id,
                        tipo,
                        concepto,
                        monto,
                        created_at
                    `)
                    .eq(
                        "sesion_caja_id",
                        sesionData.id
                    );

                if (
                    errorMovimientos
                ) {
                    console.error(
                        "Error obteniendo movimientos:",
                        errorMovimientos
                    );

                    setError(
                        errorMovimientos.message ||
                        "No se pudieron obtener los movimientos de caja."
                    );

                    return;
                }

                const resumenMov:
                    ResumenMovimientos = {
                    entradas: 0,
                    salidas: 0,
                };

                (
                    movimientosData ?? []
                ).forEach(
                    (movimiento) => {
                        /*
                         * Las devoluciones no se
                         * cuentan como retiros.
                         */
                        if (
                            esDevolucionMovimiento(
                                movimiento
                            )
                        ) {
                            return;
                        }

                        const monto =
                            Number(
                                movimiento.monto ??
                                0
                            );

                        const tipo =
                            normalizarTexto(
                                movimiento.tipo
                            );

                        if (
                            tipo ===
                            "entrada"
                        ) {
                            resumenMov.entradas +=
                                monto;
                        } else if (
                            tipo ===
                            "salida"
                        ) {
                            resumenMov.salidas +=
                                monto;
                        }
                    }
                );

                if (!activo) return;

                setResumenPagos(
                    resumen
                );

                setResumenDevoluciones(
                    resumenDev
                );

                setResumenMovimientos(
                    resumenMov
                );
            } catch (err) {
                console.error(
                    "Error cargando cierre:",
                    err
                );

                if (!activo) return;

                setError(
                    "Ocurrió un error al cargar la información del cierre."
                );
            } finally {
                if (activo) {
                    setCargando(false);
                }
            }
        }

        cargarInformacion();

        return () => {
            activo = false;
        };
    }, [router]);

    /*
     * ============================================
     * CÁLCULOS
     * ============================================
     */

    const montoContado =
        montoReal === ""
            ? null
            : Number(montoReal);

    const ventasEfectivoOriginal =
        resumenPagos.efectivo;

    const devolucionesEfectivo =
        resumenDevoluciones.efectivo;

    /*
     * Efectivo neto generado por ventas.
     */
    const efectivoNetoVentas =
        ventasEfectivoOriginal -
        devolucionesEfectivo;

    /*
     * EFECTIVO FÍSICO ESPERADO
     *
     * Fondo inicial
     * + ventas cobradas en efectivo
     * + entradas
     * - salidas
     * - devoluciones en efectivo
     *
     * Crédito NO participa.
     *
     * Tarjeta NO participa.
     *
     * Transferencia NO participa.
     *
     * En una venta mixta solo participa
     * la parte que realmente fue efectivo.
     */
    const efectivoEsperado =
        Number(
            sesion?.monto_inicial ?? 0
        ) +
        ventasEfectivoOriginal +
        resumenMovimientos.entradas -
        resumenMovimientos.salidas -
        devolucionesEfectivo;

    const montoEsperadoBD =
        Number(
            sesion?.monto_esperado ?? 0
        );

    const diferencia =
        montoContado === null ||
            Number.isNaN(montoContado)
            ? null
            : montoContado -
            efectivoEsperado;

    const tarjetaNeta = Math.max(
        0,
        resumenPagos.tarjeta -
        resumenDevoluciones.tarjeta
    );

    const transferenciaNeta =
        Math.max(
            0,
            resumenPagos.transferencia -
            resumenDevoluciones.transferencia
        );

    const mixtoNeto =
        Math.max(
            0,
            resumenPagos.mixto -
            resumenDevoluciones.mixto
        );

    const creditoNeto =
        resumenPagos.credito;

    const otrosNeto =
        Math.max(
            0,
            resumenPagos.otros -
            resumenDevoluciones.otros
        );

    /*
     * Ventas netas:
     *
     * TOTAL DE VENTAS
     * - DEVOLUCIONES
     *
     * El crédito sí forma parte de las ventas.
     */
    const totalVentasNeto =
        Math.max(
            0,
            resumenPagos.total -
            resumenDevoluciones.total
        );

    /*
     * ============================================
     * CERRAR CAJA
     * ============================================
     */

    async function cerrarCaja() {
        setError("");

        if (!usuario) {
            setError(
                "No se encontró el usuario actual."
            );
            return;
        }

        if (!sesion) {
            setError(
                "No se encontró una sesión de caja abierta."
            );
            return;
        }

        if (
            montoReal === "" ||
            montoContado === null ||
            Number.isNaN(montoContado) ||
            montoContado < 0
        ) {
            setError(
                "Introduce el monto contado en caja."
            );
            return;
        }

        try {
            setCerrandoCaja(true);

            console.log(
                "========== CERRANDO CAJA =========="
            );

            console.log(
                "Sesión:",
                sesion.id
            );

            console.log(
                "Fondo inicial:",
                sesion.monto_inicial
            );

            console.log(
                "Ventas efectivo:",
                ventasEfectivoOriginal
            );

            console.log(
                "Entradas:",
                resumenMovimientos.entradas
            );

            console.log(
                "Retiros:",
                resumenMovimientos.salidas
            );

            console.log(
                "Devoluciones efectivo:",
                devolucionesEfectivo
            );

            console.log(
                "Efectivo esperado:",
                efectivoEsperado
            );

            console.log(
                "Monto real:",
                montoContado
            );

            console.log(
                "Diferencia:",
                diferencia
            );

            console.log(
                "==================================="
            );

            const {
                data,
                error: errorRPC,
            } =
                await supabasePOS.rpc(
                    "cerrar_sesion_caja",
                    {
                        p_sesion_caja_id:
                            sesion.id,
                        p_monto_real:
                            montoContado,
                    }
                );

            if (errorRPC) {
                console.error(
                    "Error cerrando caja:",
                    errorRPC
                );

                setError(
                    errorRPC.message ||
                    "No se pudo cerrar la caja."
                );

                return;
            }

            if (!data) {
                setError(
                    "La caja no se cerró porque no se recibió confirmación."
                );

                return;
            }

            setSesion(
                data as SesionCaja
            );

            setCerrada(true);
        } catch (err) {
            console.error(
                "Error inesperado al cerrar caja:",
                err
            );

            setError(
                "Ocurrió un error inesperado al cerrar la caja."
            );
        } finally {
            setCerrandoCaja(false);
        }
    }

    /*
     * ============================================
     * SALIR
     * ============================================
     */

    async function salir() {
        await supabasePOS.auth.signOut();
        window.location.href =
            "/pos/login";
    }

    /*
     * ============================================
     * MONEDA
     * ============================================
     */

    function moneda(valor: number) {
        return valor.toLocaleString(
            "es-MX",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
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
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl shadow-sm">
                        💰
                    </div>

                    <p className="text-sm font-semibold text-[var(--color-text)]">
                        Cargando cierre de caja...
                    </p>

                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Preparando la información
                    </p>
                </div>
            </div>
        );
    }

    /*
     * ============================================
     * CIERRE COMPLETADO
     * ============================================
     */

    if (cerrada && sesion) {
        const diferenciaCierre =
            Number(
                sesion.diferencia ?? 0
            );

        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
                <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-3xl">
                        ✓
                    </div>

                    <h1 className="mt-5 text-center text-xl font-bold text-[var(--color-text)]">
                        Caja cerrada correctamente
                    </h1>

                    <p className="mt-2 text-center text-sm leading-6 text-[var(--color-text-secondary)]">
                        La sesión de caja se cerró correctamente.
                    </p>

                    <div className="mt-6 space-y-3 rounded-xl bg-slate-50 p-4">

                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-[var(--color-text-secondary)]">
                                Efectivo esperado
                            </span>

                            <span className="text-sm font-bold text-[var(--color-text)]">
                                $
                                {moneda(
                                    efectivoEsperado
                                )}
                            </span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-[var(--color-text-secondary)]">
                                Efectivo contado
                            </span>

                            <span className="text-sm font-bold text-[var(--color-text)]">
                                $
                                {moneda(
                                    Number(
                                        sesion.monto_real ??
                                        0
                                    )
                                )}
                            </span>
                        </div>

                        <div className="border-t border-slate-200 pt-3">
                            <div className="flex items-center justify-between gap-4">

                                <span className="text-sm font-semibold text-[var(--color-text)]">
                                    Diferencia
                                </span>

                                <span
                                    className={`text-sm font-bold ${diferenciaCierre ===
                                        0
                                        ? "text-green-600"
                                        : diferenciaCierre >
                                            0
                                            ? "text-blue-600"
                                            : "text-red-600"
                                        }`}
                                >
                                    {diferenciaCierre >=
                                        0
                                        ? "+"
                                        : ""}
                                    $
                                    {moneda(
                                        Math.abs(
                                            diferenciaCierre
                                        )
                                    )}
                                </span>

                            </div>
                        </div>

                    </div>

                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={salir}
                            className="w-full rounded-xl bg-[var(--color-primary)] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)]"
                        >
                            Salir del punto de venta
                        </button>
                    </div>

                </div>
            </div>
        );
    }

    /*
     * ============================================
     * ERROR / SIN SESIÓN
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
                        No se puede cerrar la caja
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                        {error ||
                            "No se encontró una sesión de caja abierta."}
                    </p>

                </div>
            </div>
        );
    }

    /*
     * ============================================
     * PANTALLA DE CIERRE
     * ============================================
     */

    return (
        <div className="min-h-screen bg-[var(--color-background)] px-4 py-6 sm:px-6 sm:py-10">
            <div className="mx-auto w-full max-w-3xl">

                {/* ENCABEZADO */}

                <div className="mb-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

                        <div>
                            <h1 className="text-2xl font-bold text-[var(--color-text)]">
                                Cierre de caja
                            </h1>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Revisa las ventas y movimientos antes de cerrar.
                            </p>
                        </div>

                        <div className="w-fit rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
                            Caja abierta
                        </div>

                    </div>
                </div>

                {/* INFORMACIÓN DE CAJA */}

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">

                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                        Caja
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-[var(--color-text)]">
                        {caja.nombre}
                    </h2>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {caja.sucursal_nombre}
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">

                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs text-[var(--color-text-secondary)]">
                                Fondo inicial
                            </p>

                            <p className="mt-1 text-lg font-bold text-[var(--color-text)]">
                                $
                                {moneda(
                                    Number(
                                        sesion.monto_inicial
                                    )
                                )}
                            </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs text-[var(--color-text-secondary)]">
                                Ventas
                            </p>

                            <p className="mt-1 text-lg font-bold text-[var(--color-text)]">
                                $
                                {moneda(
                                    resumenPagos.total
                                )}
                            </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs text-[var(--color-text-secondary)]">
                                Usuario
                            </p>

                            <p className="mt-1 text-sm font-bold text-[var(--color-text)]">
                                {usuario.nombre}
                            </p>
                        </div>

                    </div>
                </div>

                {/* RESUMEN DE VENTAS */}

                <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">

                    <h2 className="text-base font-bold text-[var(--color-text)]">
                        Resumen de ventas
                    </h2>

                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Ventas realizadas durante esta sesión.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                        {/* EFECTIVO */}

                        <div className="rounded-xl border border-green-200 bg-green-50 p-4">

                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-green-800">
                                    Efectivo
                                </span>

                                <span className="text-lg">
                                    💵
                                </span>
                            </div>

                            <p className="mt-2 text-xl font-bold text-green-700">
                                $
                                {moneda(
                                    efectivoNetoVentas
                                )}
                            </p>

                            {devolucionesEfectivo >
                                0 ? (
                                <p className="mt-1 text-[11px] text-green-700">
                                    Venta $
                                    {moneda(
                                        ventasEfectivoOriginal
                                    )}
                                    {" "}− devolución $
                                    {moneda(
                                        devolucionesEfectivo
                                    )}
                                </p>
                            ) : (
                                <p className="mt-1 text-[11px] text-green-700">
                                    Ventas netas
                                </p>
                            )}

                        </div>

                        {/* TARJETA */}

                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">

                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-blue-800">
                                    Tarjeta
                                </span>

                                <span className="text-lg">
                                    💳
                                </span>
                            </div>

                            <p className="mt-2 text-xl font-bold text-blue-700">
                                $
                                {moneda(
                                    tarjetaNeta
                                )}
                            </p>

                            {resumenDevoluciones.tarjeta >
                                0 && (
                                    <p className="mt-1 text-[11px] text-blue-700">
                                        Venta $
                                        {moneda(
                                            resumenPagos.tarjeta
                                        )}
                                        {" "}− devolución $
                                        {moneda(
                                            resumenDevoluciones.tarjeta
                                        )}
                                    </p>
                                )}

                        </div>

                        {/* TRANSFERENCIA */}

                        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">

                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-violet-800">
                                    Transferencia
                                </span>

                                <span className="text-lg">
                                    🏦
                                </span>
                            </div>

                            <p className="mt-2 text-xl font-bold text-violet-700">
                                $
                                {moneda(
                                    transferenciaNeta
                                )}
                            </p>

                            {resumenDevoluciones.transferencia >
                                0 && (
                                    <p className="mt-1 text-[11px] text-violet-700">
                                        Venta $
                                        {moneda(
                                            resumenPagos.transferencia
                                        )}
                                        {" "}− devolución $
                                        {moneda(
                                            resumenDevoluciones.transferencia
                                        )}
                                    </p>
                                )}

                        </div>

                        {/* MIXTO */}

                        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">

                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-orange-800">
                                    Mixto
                                </span>

                                <span className="text-lg">
                                    🔀
                                </span>
                            </div>

                            <p className="mt-2 text-xl font-bold text-orange-700">
                                $
                                {moneda(
                                    mixtoNeto
                                )}
                            </p>

                            <p className="mt-1 text-[11px] text-orange-700">
                                Clasificación de ventas
                            </p>

                        </div>

                        {/* CRÉDITO */}

                        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">

                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-purple-800">
                                    Crédito
                                </span>

                                <span className="text-lg">
                                    📒
                                </span>
                            </div>

                            <p className="mt-2 text-xl font-bold text-purple-700">
                                $
                                {moneda(
                                    creditoNeto
                                )}
                            </p>

                            <p className="mt-1 text-[11px] text-purple-700">
                                No afecta efectivo
                            </p>

                        </div>

                        {/* TOTAL */}

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-700">
                                    Total neto
                                </span>

                                <span className="text-lg">
                                    📊
                                </span>
                            </div>

                            <p className="mt-2 text-xl font-bold text-[var(--color-text)]">
                                $
                                {moneda(
                                    totalVentasNeto
                                )}
                            </p>

                        </div>

                    </div>

                    {resumenDevoluciones.total >
                        0 && (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">

                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-amber-900">
                                        Devoluciones
                                    </span>

                                    <span className="text-sm font-bold text-amber-800">
                                        -$
                                        {moneda(
                                            resumenDevoluciones.total
                                        )}
                                    </span>
                                </div>

                                <p className="mt-1 text-xs text-amber-800">
                                    Las devoluciones se descuentan según el método de reembolso.
                                </p>

                            </div>
                        )}

                    {resumenPagos.otros >
                        0 && (
                            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">

                                <div className="flex items-center justify-between">

                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                        Otros métodos de pago
                                    </span>

                                    <span className="text-sm font-bold text-[var(--color-text)]">
                                        $
                                        {moneda(
                                            otrosNeto
                                        )}
                                    </span>

                                </div>

                            </div>
                        )}

                    <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">

                        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                            <strong>Mixto</strong> y{" "}
                            <strong>Crédito</strong>{" "}
                            son clasificaciones de las ventas y no se suman nuevamente al total.
                        </p>

                    </div>

                </div>

                {/* MOVIMIENTOS DE CAJA */}

                <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">

                    <h2 className="text-base font-bold text-[var(--color-text)]">
                        Movimientos de caja
                    </h2>

                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Entradas y retiros reales registrados durante la sesión.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">

                        {/* ENTRADAS */}

                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">

                            <p className="text-xs font-semibold text-emerald-800">
                                Entradas
                            </p>

                            <p className="mt-2 text-xl font-bold text-emerald-700">
                                $
                                {moneda(
                                    resumenMovimientos.entradas
                                )}
                            </p>

                        </div>

                        {/* SALIDAS */}

                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">

                            <p className="text-xs font-semibold text-red-800">
                                Retiros
                            </p>

                            <p className="mt-2 text-xl font-bold text-red-700">
                                $
                                {moneda(
                                    resumenMovimientos.salidas
                                )}
                            </p>

                            <p className="mt-1 text-[11px] text-red-700">
                                Solo retiros reales de efectivo
                            </p>

                        </div>

                    </div>
                </div>

                {/* DEVOLUCIONES */}

                {resumenDevoluciones.total >
                    0 && (
                        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">

                            <div className="flex items-start justify-between gap-4">

                                <div>
                                    <h2 className="text-base font-bold text-amber-900">
                                        Devoluciones
                                    </h2>

                                    <p className="mt-1 text-xs text-amber-800">
                                        Se muestran por separado de los retiros.
                                    </p>
                                </div>

                                <span className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                                    -$
                                    {moneda(
                                        resumenDevoluciones.total
                                    )}
                                </span>

                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">

                                {/* EFECTIVO */}

                                <div className="rounded-xl border border-amber-200 bg-white p-4">

                                    <p className="text-xs font-semibold text-amber-800">
                                        Efectivo
                                    </p>

                                    <p className="mt-2 text-lg font-bold text-amber-900">
                                        -$
                                        {moneda(
                                            resumenDevoluciones.efectivo
                                        )}
                                    </p>

                                    <p className="mt-1 text-[11px] text-amber-700">
                                        Sí afecta el efectivo físico
                                    </p>

                                </div>

                                {/* TARJETA */}

                                <div className="rounded-xl border border-amber-200 bg-white p-4">

                                    <p className="text-xs font-semibold text-amber-800">
                                        Tarjeta
                                    </p>

                                    <p className="mt-2 text-lg font-bold text-amber-900">
                                        -$
                                        {moneda(
                                            resumenDevoluciones.tarjeta
                                        )}
                                    </p>

                                    <p className="mt-1 text-[11px] text-amber-700">
                                        No afecta el efectivo físico
                                    </p>

                                </div>

                                {/* TRANSFERENCIA */}

                                <div className="rounded-xl border border-amber-200 bg-white p-4">

                                    <p className="text-xs font-semibold text-amber-800">
                                        Transferencia
                                    </p>

                                    <p className="mt-2 text-lg font-bold text-amber-900">
                                        -$
                                        {moneda(
                                            resumenDevoluciones.transferencia
                                        )}
                                    </p>

                                    <p className="mt-1 text-[11px] text-amber-700">
                                        No afecta el efectivo físico
                                    </p>

                                </div>

                            </div>

                            {resumenDevoluciones.mixto >
                                0 && (
                                    <div className="mt-3 rounded-xl border border-amber-200 bg-white p-4">

                                        <p className="text-xs font-semibold text-amber-800">
                                            Mixto
                                        </p>

                                        <p className="mt-2 text-lg font-bold text-amber-900">
                                            -$
                                            {moneda(
                                                resumenDevoluciones.mixto
                                            )}
                                        </p>

                                        <p className="mt-1 text-[11px] text-amber-700">
                                            Reembolso con múltiples métodos
                                        </p>

                                    </div>
                                )}

                        </div>
                    )}

                {/* CÁLCULO DE EFECTIVO */}

                <div className="mt-5 rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">

                    <h2 className="text-base font-bold text-[var(--color-text)]">
                        Efectivo esperado en caja
                    </h2>

                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Este es el dinero que físicamente debería existir en la caja.
                    </p>

                    <div className="mt-5 overflow-hidden rounded-xl border border-[var(--color-border)]">

                        {/* FONDO */}

                        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-slate-50 px-4 py-3">

                            <span className="text-sm text-[var(--color-text-secondary)]">
                                Fondo inicial
                            </span>

                            <span className="text-sm font-bold text-[var(--color-text)]">
                                $
                                {moneda(
                                    Number(
                                        sesion.monto_inicial
                                    )
                                )}
                            </span>

                        </div>

                        {/* VENTAS EFECTIVO */}

                        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">

                            <span className="text-sm text-[var(--color-text-secondary)]">
                                + Ventas en efectivo
                            </span>

                            <span className="text-sm font-bold text-green-600">
                                +$
                                {moneda(
                                    ventasEfectivoOriginal
                                )}
                            </span>

                        </div>

                        {/* ENTRADAS */}

                        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">

                            <span className="text-sm text-[var(--color-text-secondary)]">
                                + Entradas
                            </span>

                            <span className="text-sm font-bold text-emerald-600">
                                +$
                                {moneda(
                                    resumenMovimientos.entradas
                                )}
                            </span>

                        </div>

                        {/* RETIROS */}

                        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">

                            <span className="text-sm text-[var(--color-text-secondary)]">
                                − Retiros
                            </span>

                            <span className="text-sm font-bold text-red-600">
                                −$
                                {moneda(
                                    resumenMovimientos.salidas
                                )}
                            </span>

                        </div>

                        {/* DEVOLUCIONES EFECTIVO */}

                        {devolucionesEfectivo >
                            0 && (
                                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">

                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                        − Devoluciones en efectivo
                                    </span>

                                    <span className="text-sm font-bold text-amber-600">
                                        −$
                                        {moneda(
                                            devolucionesEfectivo
                                        )}
                                    </span>

                                </div>
                            )}

                        {/* TOTAL */}

                        <div className="flex items-center justify-between bg-slate-50 px-4 py-4">

                            <div>
                                <span className="font-bold text-[var(--color-text)]">
                                    Efectivo esperado
                                </span>

                                <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                                    Dinero físico esperado en caja
                                </p>
                            </div>

                            <span className="text-xl font-bold text-[var(--color-text)]">
                                $
                                {moneda(
                                    efectivoEsperado
                                )}
                            </span>

                        </div>

                    </div>

                    {sesion.monto_esperado !==
                        null &&
                        sesion.monto_esperado !==
                        undefined &&
                        Math.abs(
                            montoEsperadoBD -
                            efectivoEsperado
                        ) > 0.01 && (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">

                                <p className="text-xs font-semibold text-amber-900">
                                    Aviso
                                </p>

                                <p className="mt-1 text-xs leading-5 text-amber-800">
                                    El monto esperado guardado en la sesión es $
                                    {moneda(
                                        montoEsperadoBD
                                    )}
                                    , mientras que el cálculo actual de efectivo da $
                                    {moneda(
                                        efectivoEsperado
                                    )}
                                    .
                                </p>

                            </div>
                        )}

                </div>

                {/* MONTO CONTADO */}

                <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">

                    <label
                        htmlFor="montoReal"
                        className="block text-sm font-bold text-[var(--color-text)]"
                    >
                        Efectivo contado
                    </label>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Cuenta físicamente todo el efectivo disponible en la caja e introduce el total.
                    </p>

                    <div className="relative mt-4">

                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[var(--color-text-secondary)]">
                            $
                        </span>

                        <input
                            id="montoReal"
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={montoReal}
                            onChange={(e) =>
                                setMontoReal(
                                    e.target.value
                                )
                            }
                            disabled={
                                cerrandoCaja
                            }
                            placeholder="0.00"
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-4 pl-9 pr-4 text-lg font-bold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                        />

                    </div>

                    {/* DIFERENCIA */}

                    {diferencia !==
                        null &&
                        !Number.isNaN(
                            diferencia
                        ) && (
                            <div
                                className={`mt-4 rounded-xl border p-4 ${diferencia ===
                                    0
                                    ? "border-green-200 bg-green-50"
                                    : diferencia >
                                        0
                                        ? "border-blue-200 bg-blue-50"
                                        : "border-red-200 bg-red-50"
                                    }`}
                            >

                                <div className="flex items-center justify-between gap-4">

                                    <span
                                        className={`text-sm font-semibold ${diferencia ===
                                            0
                                            ? "text-green-800"
                                            : diferencia >
                                                0
                                                ? "text-blue-800"
                                                : "text-red-800"
                                            }`}
                                    >
                                        Diferencia
                                    </span>

                                    <span
                                        className={`text-lg font-bold ${diferencia ===
                                            0
                                            ? "text-green-700"
                                            : diferencia >
                                                0
                                                ? "text-blue-700"
                                                : "text-red-700"
                                            }`}
                                    >
                                        {diferencia >=
                                            0
                                            ? "+"
                                            : ""}
                                        $
                                        {moneda(
                                            Math.abs(
                                                diferencia
                                            )
                                        )}
                                    </span>

                                </div>

                                <p
                                    className={`mt-1 text-xs ${diferencia ===
                                        0
                                        ? "text-green-700"
                                        : diferencia >
                                            0
                                            ? "text-blue-700"
                                            : "text-red-700"
                                        }`}
                                >
                                    {diferencia ===
                                        0
                                        ? "El efectivo coincide exactamente con el monto esperado."
                                        : diferencia >
                                            0
                                            ? "Hay un excedente de efectivo."
                                            : "Hay un faltante de efectivo."}
                                </p>

                            </div>
                        )}

                </div>

                {/* ERROR */}

                {error && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* CONFIRMAR */}

                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">

                    <p className="text-sm font-bold text-amber-900">
                        Antes de cerrar
                    </p>

                    <p className="mt-1 text-xs leading-5 text-amber-800">
                        Verifica que el efectivo contado sea correcto. Las ventas con tarjeta, transferencia y crédito no forman parte del efectivo físico de la caja. En las ventas mixtas solo la parte cobrada en efectivo forma parte del efectivo físico. Los retiros y las devoluciones en efectivo se muestran por separado.
                    </p>

                </div>

                {/* BOTÓN */}

                <button
                    type="button"
                    onClick={cerrarCaja}
                    disabled={
                        cerrandoCaja ||
                        montoReal === ""
                    }
                    className="mt-5 w-full rounded-xl bg-[var(--color-primary)] px-5 py-4 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {cerrandoCaja
                        ? "Cerrando caja..."
                        : "Confirmar cierre de caja"}
                </button>

            </div>
        </div>
    );
}