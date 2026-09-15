"use client";

import { useEffect, useMemo, useState } from "react";

import Card from "../../components/Card";

import { supabase } from "../../../lib/supabase";

import { obtenerUsuarioActual } from "../../../lib/auth/roleGuard";

/*
 * ==========================================
 * TIPOS
 * ==========================================
 */

interface Cliente {
    id: string;
    nombre: string;
    telefono: string | null;
    email: string | null;
    activo: boolean;
    negocio_id: string;
}

interface Venta {
    id: string;
    negocio_id: string;
    sucursal_id: string;
    caja_id: string;
    sesion_caja_id: string;
    usuario_id: string;
    cliente_id: string | null;

    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;

    metodo_pago: string;
    estado: string;
    referencia: string | null;
    notas: string | null;

    created_at: string;

    cajas: {
        nombre: string;
    } | null;

    sucursales: {
        nombre: string;
    } | null;

    usuarios: {
        nombre: string;
    } | null;

    clientes: {
        id: string;
        nombre: string;
        telefono: string | null;
        email: string | null;
    } | null;
}

interface DetalleVenta {
    id: string;
    venta_id: string;
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    descuento: number;
    impuesto: number;
    subtotal: number;
    total: number;

    productos: {
        nombre: string;
        codigo_barras: string | null;
        sku: string | null;
        unidad: string;
    } | null;
}

interface Pago {
    id: string;
    venta_id: string;
    metodo_pago: string;
    monto: number;
    monto_recibido: number | null;
    cambio: number;
    referencia: string | null;
    created_at: string;
}

interface Devolucion {
    id: string;
    venta_id: string;
    monto_total: number;
    estado: string;
    metodo_reembolso: string;
    created_at: string;
}

interface UsuarioActual {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

/*
 * ==========================================
 * COMPONENTE
 * ==========================================
 */

export default function VentasPage() {
    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [ventas, setVentas] =
        useState<Venta[]>([]);

    const [devoluciones, setDevoluciones] =
        useState<Devolucion[]>([]);

    const [cargando, setCargando] =
        useState(true);

    const [error, setError] =
        useState("");

    const [busqueda, setBusqueda] =
        useState("");

    const [fechaDesde, setFechaDesde] =
        useState("");

    const [fechaHasta, setFechaHasta] =
        useState("");

    const [ventaSeleccionada, setVentaSeleccionada] =
        useState<Venta | null>(null);

    const [detalleVenta, setDetalleVenta] =
        useState<DetalleVenta[]>([]);

    const [pagosVenta, setPagosVenta] =
        useState<Pago[]>([]);

    const [cargandoDetalle, setCargandoDetalle] =
        useState(false);

    /*
     * ==========================================
     * OBTENER FECHA LOCAL
     * ==========================================
     */

    function obtenerFechaLocal() {
        const ahora = new Date();

        const year =
            ahora.getFullYear();

        const month =
            String(
                ahora.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                ahora.getDate()
            ).padStart(2, "0");

        return `${year} -${month} -${day} `;
    }

    /*
     * ==========================================
     * CONVERTIR FECHA A YYYY-MM-DD LOCAL
     * ==========================================
     */

    function obtenerFechaLocalDeFecha(
        fecha: string
    ) {
        const fechaObjeto =
            new Date(fecha);

        const year =
            fechaObjeto.getFullYear();

        const month =
            String(
                fechaObjeto.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                fechaObjeto.getDate()
            ).padStart(2, "0");

        return `${year} -${month} -${day} `;
    }

    /*
     * ==========================================
     * FORMATEAR FECHA
     * ==========================================
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
     * ==========================================
     * FORMATEAR MONEDA
     * ==========================================
     */

    function formatearMoneda(
        cantidad: number
    ) {
        return Number(
            cantidad || 0
        ).toLocaleString(
            "es-MX",
            {
                style: "currency",
                currency: "MXN",
            }
        );
    }

    /*
     * ==========================================
     * OBTENER DEVOLUCIONES DE UNA VENTA
     * ==========================================
     */

    function obtenerDevolucionesVenta(
        ventaId: string
    ) {
        return devoluciones.filter(
            (devolucion) =>
                devolucion.venta_id === ventaId &&
                devolucion.estado === "completada"
        );
    }

    /*
     * ==========================================
     * TOTAL DEVUELTO
     * ==========================================
     */

    function obtenerTotalDevuelto(
        ventaId: string
    ) {
        return obtenerDevolucionesVenta(
            ventaId
        ).reduce(
            (total, devolucion) =>
                total +
                (
                    Number(
                        devolucion.monto_total
                    ) || 0
                ),
            0
        );
    }

    /*
     * ==========================================
     * TOTAL NETO
     * ==========================================
     */

    function obtenerTotalNeto(
        venta: Venta
    ) {
        const totalVenta =
            Number(
                venta.total
            ) || 0;

        const totalDevuelto =
            obtenerTotalDevuelto(
                venta.id
            );

        return Math.max(
            0,
            totalVenta -
            totalDevuelto
        );
    }

    /*
     * ==========================================
     * CARGAR VENTAS
     * ==========================================
     */

    async function cargarVentas() {
        setCargando(true);
        setError("");

        try {
            const usuarioActual =
                (
                    await obtenerUsuarioActual()
                ) as UsuarioActual | null;

            if (
                !usuarioActual?.id ||
                !usuarioActual.negocio_id
            ) {
                setError(
                    "No se encontró la información del usuario."
                );

                return;
            }

            /*
             * ======================================
             * SOLO ADMINISTRADORES
             * ======================================
             */

            if (
                usuarioActual.rol !==
                "admin"
            ) {
                setError(
                    "No tienes permisos para consultar las ventas administrativas."
                );

                return;
            }

            setUsuario(
                usuarioActual
            );

            /*
             * ======================================
             * VENTAS
             * ======================================
             */

            const {
                data,
                error: errorVentas,
            } = await supabase
                .from("ventas")
                .select(`
id,
    negocio_id,
    sucursal_id,
    caja_id,
    sesion_caja_id,
    usuario_id,
    cliente_id,
    subtotal,
    descuento,
    impuesto,
    total,
    metodo_pago,
    estado,
    referencia,
    notas,
    created_at,

    cajas: cajas(
        nombre
    ),

        sucursales: sucursales(
            nombre
        ),

            usuarios: usuarios(
                nombre
            ),

                clientes: clientes(
                    id,
                    nombre,
                    telefono,
                    email
                )
                    `)
                .eq(
                    "negocio_id",
                    usuarioActual.negocio_id
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (errorVentas) {
                setError(
                    errorVentas.message ||
                    "No se pudieron cargar las ventas."
                );

                return;
            }

            /*
             * ======================================
             * DEVOLUCIONES
             * ======================================
             */

            const {
                data: dataDevoluciones,
                error: errorDevoluciones,
            } = await supabase
                .from("devoluciones")
                .select(`
id,
    venta_id,
    monto_total,
    estado,
    metodo_reembolso,
    created_at
        `)
                .eq(
                    "negocio_id",
                    usuarioActual.negocio_id
                )
                .eq(
                    "estado",
                    "completada"
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (errorDevoluciones) {
                setError(
                    errorDevoluciones.message ||
                    "No se pudieron cargar las devoluciones."
                );

                return;
            }

            setVentas(
                (data as unknown as Venta[]) ?? []
            );

            setDevoluciones(
                (dataDevoluciones as Devolucion[]) ?? []
            );

        } catch {
            setError(
                "Ocurrió un error al cargar las ventas."
            );

        } finally {
            setCargando(false);
        }
    }

    /*
     * ==========================================
     * CARGA INICIAL
     * ==========================================
     */

    useEffect(() => {
        const hoy =
            obtenerFechaLocal();

        setFechaDesde(hoy);
        setFechaHasta(hoy);

        cargarVentas();
    }, []);

    /*
     * ==========================================
     * LIMPIAR FILTROS
     * ==========================================
     */

    function limpiarFiltros() {
        setBusqueda("");

        setFechaDesde("");

        setFechaHasta("");
    }

    /*
     * ==========================================
     * VENTAS FILTRADAS
     * ==========================================
     */

    const ventasFiltradas =
        useMemo(() => {
            return ventas.filter(
                (venta) => {

                    const fechaVenta =
                        obtenerFechaLocalDeFecha(
                            venta.created_at
                        );

                    if (
                        fechaDesde &&
                        fechaVenta <
                        fechaDesde
                    ) {
                        return false;
                    }

                    if (
                        fechaHasta &&
                        fechaVenta >
                        fechaHasta
                    ) {
                        return false;
                    }

                    const texto =
                        busqueda
                            .trim()
                            .toLowerCase();

                    if (!texto) {
                        return true;
                    }

                    const idCorto =
                        venta.id
                            .slice(
                                0,
                                8
                            )
                            .toLowerCase();

                    const coincide =
                        venta.id
                            .toLowerCase()
                            .includes(texto) ||

                        idCorto
                            .includes(texto) ||

                        venta.referencia
                            ?.toLowerCase()
                            .includes(texto) ||

                        venta.usuarios?.nombre
                            ?.toLowerCase()
                            .includes(texto) ||

                        venta.cajas?.nombre
                            ?.toLowerCase()
                            .includes(texto) ||

                        venta.sucursales?.nombre
                            ?.toLowerCase()
                            .includes(texto) ||

                        venta.metodo_pago
                            ?.toLowerCase()
                            .includes(texto) ||

                        venta.clientes?.nombre
                            ?.toLowerCase()
                            .includes(texto) ||

                        venta.clientes?.telefono
                            ?.toLowerCase()
                            .includes(texto) ||

                        venta.clientes?.email
                            ?.toLowerCase()
                            .includes(texto);

                    return Boolean(
                        coincide
                    );
                }
            );
        }, [
            ventas,
            busqueda,
            fechaDesde,
            fechaHasta,
        ]);

    /*
     * ==========================================
     * RESUMEN
     * ==========================================
     */

    const resumen =
        useMemo(() => {

            let ventasBrutas = 0;

            let devolucionesTotal = 0;

            let ventasNetas = 0;

            let efectivo = 0;

            let tarjeta = 0;

            let transferencia = 0;

            ventasFiltradas.forEach(
                (venta) => {

                    if (
                        venta.estado !==
                        "completada"
                    ) {
                        return;
                    }

                    const monto =
                        Number(
                            venta.total
                        ) || 0;

                    const devuelto =
                        obtenerTotalDevuelto(
                            venta.id
                        );

                    const neto =
                        Math.max(
                            0,
                            monto -
                            devuelto
                        );

                    ventasBrutas +=
                        monto;

                    devolucionesTotal +=
                        devuelto;

                    ventasNetas +=
                        neto;

                    if (
                        venta.metodo_pago ===
                        "efectivo"
                    ) {
                        efectivo +=
                            monto;
                    }

                    if (
                        venta.metodo_pago ===
                        "tarjeta"
                    ) {
                        tarjeta +=
                            monto;
                    }

                    if (
                        venta.metodo_pago ===
                        "transferencia"
                    ) {
                        transferencia +=
                            monto;
                    }
                }
            );

            ventasFiltradas.forEach(
                (venta) => {

                    const devolucionesVenta =
                        obtenerDevolucionesVenta(
                            venta.id
                        );

                    devolucionesVenta.forEach(
                        (devolucion) => {

                            const monto =
                                Number(
                                    devolucion.monto_total
                                ) || 0;

                            if (
                                devolucion.metodo_reembolso ===
                                "efectivo"
                            ) {
                                efectivo -=
                                    monto;
                            }

                            if (
                                devolucion.metodo_reembolso ===
                                "tarjeta"
                            ) {
                                tarjeta -=
                                    monto;
                            }

                            if (
                                devolucion.metodo_reembolso ===
                                "transferencia"
                            ) {
                                transferencia -=
                                    monto;
                            }
                        }
                    );
                }
            );

            efectivo =
                Math.max(
                    0,
                    efectivo
                );

            tarjeta =
                Math.max(
                    0,
                    tarjeta
                );

            transferencia =
                Math.max(
                    0,
                    transferencia
                );

            const ventasCompletadas =
                ventasFiltradas.filter(
                    (venta) =>
                        venta.estado ===
                        "completada"
                ).length;

            const ventasConCliente =
                ventasFiltradas.filter(
                    (venta) =>
                        venta.cliente_id !== null
                ).length;

            return {
                ventasBrutas,
                devolucionesTotal,
                ventasNetas,
                efectivo,
                tarjeta,
                transferencia,
                ventasCompletadas,
                ventasConCliente,
            };

        }, [
            ventasFiltradas,
            devoluciones,
        ]);

    /*
     * ==========================================
     * VER DETALLE
     * ==========================================
     */

    async function abrirDetalle(
        venta: Venta
    ) {
        setVentaSeleccionada(
            venta
        );

        setDetalleVenta([]);

        setPagosVenta([]);

        setCargandoDetalle(true);

        setError("");

        try {

            const {
                data: detalles,
                error: errorDetalles,
            } = await supabase
                .from("detalle_ventas")
                .select(`
id,
    venta_id,
    producto_id,
    cantidad,
    precio_unitario,
    descuento,
    impuesto,
    subtotal,
    total,

    productos: productos(
        nombre,
        codigo_barras,
        sku,
        unidad
    )
        `)
                .eq(
                    "venta_id",
                    venta.id
                )
                .order(
                    "created_at",
                    {
                        ascending: true,
                    }
                );

            if (errorDetalles) {
                setError(
                    "No se pudo obtener el detalle de la venta."
                );

                return;
            }

            const {
                data: pagos,
                error: errorPagos,
            } = await supabase
                .from("pagos")
                .select(`
id,
    venta_id,
    metodo_pago,
    monto,
    monto_recibido,
    cambio,
    referencia,
    created_at
        `)
                .eq(
                    "venta_id",
                    venta.id
                )
                .order(
                    "created_at",
                    {
                        ascending: true,
                    }
                );

            if (errorPagos) {
                setError(
                    "No se pudieron obtener los pagos de la venta."
                );

                return;
            }

            setDetalleVenta(
                (detalles as unknown as DetalleVenta[]) ?? []
            );

            setPagosVenta(
                (pagos as Pago[]) ?? []
            );

        } catch {
            setError(
                "Ocurrió un error al obtener el detalle de la venta."
            );

        } finally {
            setCargandoDetalle(
                false
            );
        }
    }

    /*
     * ==========================================
     * CERRAR MODAL
     * ==========================================
     */

    function cerrarDetalle() {
        setVentaSeleccionada(
            null
        );

        setDetalleVenta([]);

        setPagosVenta([]);
    }

    /*
     * ==========================================
     * MÉTODO DE PAGO
     * ==========================================
     */

    function obtenerNombreMetodo(
        metodo: string
    ) {
        switch (
        metodo
        ) {

            case "efectivo":
                return "Efectivo";

            case "tarjeta":
                return "Tarjeta";

            case "transferencia":
                return "Transferencia";

            default:
                return metodo ||
                    "Otro";
        }
    }

    /*
     * ==========================================
     * ESTADO DE VENTA
     * ==========================================
     */

    function obtenerEstadoVenta(
        estado: string
    ) {
        switch (
        estado
        ) {

            case "completada":
                return {
                    texto: "Completada",
                    clase:
                        "bg-green-100 text-green-700",
                };

            case "cancelada":
                return {
                    texto: "Cancelada",
                    clase:
                        "bg-red-100 text-red-700",
                };

            case "pendiente":
                return {
                    texto: "Pendiente",
                    clase:
                        "bg-amber-100 text-amber-700",
                };

            default:
                return {
                    texto: estado,
                    clase:
                        "bg-[var(--color-background)] text-[var(--color-text-secondary)]",
                };
        }
    }

    /*
     * ==========================================
     * RENDER
     * ==========================================
     */

    return (
        <div className="space-y-6">

            {/* =====================================
                ENCABEZADO
            ===================================== */}

            <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                    Ventas
                </h1>

                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Consulta y administra las ventas realizadas en tu negocio.
                </p>
            </div>

            {/* =====================================
                ERROR
            ===================================== */}

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">

                        <span className="text-xl">
                            ⚠️
                        </span>

                        <p className="text-sm text-red-700">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                setError("")
                            }
                            className="ml-auto text-red-700 transition hover:text-red-900"
                        >
                            ×
                        </button>

                    </div>
                </div>
            )}

            {/* =====================================
                USUARIO
            ===================================== */}

            {usuario && (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                    <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                            {usuario.nombre}
                        </p>

                        <p className="text-xs capitalize text-[var(--color-text-secondary)]">
                            {usuario.rol}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={cargarVentas}
                        disabled={cargando}
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {cargando
                            ? "Actualizando..."
                            : "↻ Actualizar"}
                    </button>

                </div>
            )}

            {/* =====================================
                RESUMEN
            ===================================== */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">

                {/* VENTAS BRUTAS */}

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Ventas brutas
                            </p>

                            <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                                {formatearMoneda(
                                    resumen.ventasBrutas
                                )}
                            </p>
                        </div>

                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                                color:
                                    "var(--color-primary)",
                            }}
                        >
                            💰
                        </div>

                    </div>
                </Card>

                {/* DEVOLUCIONES */}

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Devoluciones
                            </p>

                            <p className="mt-2 text-2xl font-bold text-red-600">
                                -{formatearMoneda(
                                    resumen.devolucionesTotal
                                )}
                            </p>
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-xl">
                            ↩️
                        </div>

                    </div>
                </Card>

                {/* VENTAS NETAS */}

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Ventas netas
                            </p>

                            <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                                {formatearMoneda(
                                    resumen.ventasNetas
                                )}
                            </p>
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-xl">
                            📈
                        </div>

                    </div>
                </Card>

                {/* EFECTIVO */}

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Efectivo
                            </p>

                            <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                                {formatearMoneda(
                                    resumen.efectivo
                                )}
                            </p>
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-xl">
                            💵
                        </div>

                    </div>
                </Card>

                {/* TARJETA */}

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Tarjeta
                            </p>

                            <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                                {formatearMoneda(
                                    resumen.tarjeta
                                )}
                            </p>
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-xl">
                            💳
                        </div>

                    </div>
                </Card>

                {/* TRANSFERENCIA */}

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Transferencia
                            </p>

                            <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                                {formatearMoneda(
                                    resumen.transferencia
                                )}
                            </p>
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-xl">
                            🏦
                        </div>

                    </div>
                </Card>

            </div>

            {/* =====================================
                FILTROS
            ===================================== */}

            <Card className="p-5">

                <div className="mb-4">

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                        <div>
                            <h2 className="text-base font-bold text-[var(--color-text)]">
                                Buscar ventas
                            </h2>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Filtra por folio, cliente, teléfono, correo, cajero, sucursal, caja, método o fecha.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={limpiarFiltros}
                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background)]"
                        >
                            Limpiar filtros
                        </button>

                    </div>

                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

                    {/* BUSCADOR */}

                    <div className="xl:col-span-2">

                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                            Buscar
                        </label>

                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) =>
                                setBusqueda(
                                    e.target.value
                                )
                            }
                            placeholder="Folio, cliente, teléfono, correo, cajero, sucursal..."
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
                        />

                    </div>

                    {/* DESDE */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                            Desde
                        </label>

                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={(e) =>
                                setFechaDesde(
                                    e.target.value
                                )
                            }
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
                        />

                    </div>

                    {/* HASTA */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                            Hasta
                        </label>

                        <input
                            type="date"
                            value={fechaHasta}
                            onChange={(e) =>
                                setFechaHasta(
                                    e.target.value
                                )
                            }
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
                        />

                    </div>

                </div>

                {/* RESUMEN DE FILTROS */}

                <div className="mt-4 flex flex-wrap items-center gap-2">

                    {fechaDesde && (
                        <span
                            className="rounded-full px-3 py-1 text-xs font-semibold"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                                color:
                                    "var(--color-primary)",
                            }}
                        >
                            Desde: {fechaDesde}
                        </span>
                    )}

                    {fechaHasta && (
                        <span
                            className="rounded-full px-3 py-1 text-xs font-semibold"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                                color:
                                    "var(--color-primary)",
                            }}
                        >
                            Hasta: {fechaHasta}
                        </span>
                    )}

                    {busqueda && (
                        <span className="rounded-full bg-[var(--color-background)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                            Buscar: {busqueda}
                        </span>
                    )}

                    {!fechaDesde &&
                        !fechaHasta &&
                        !busqueda && (
                            <span className="text-xs text-[var(--color-text-secondary)]">
                                Sin filtros activos
                            </span>
                        )}

                </div>

            </Card>

            {/* =====================================
                TABLA
            ===================================== */}

            <Card className="overflow-hidden">

                <div className="border-b border-[var(--color-border)] px-5 py-4">

                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                            <h2 className="text-base font-bold text-[var(--color-text)]">
                                Historial de ventas
                            </h2>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                {resumen.ventasCompletadas} ventas completadas
                                {" · "}
                                {resumen.ventasConCliente} con cliente
                            </p>

                        </div>

                        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                            {ventasFiltradas.length} resultado
                            {ventasFiltradas.length === 1
                                ? ""
                                : "s"}
                        </span>

                    </div>

                </div>

                {cargando ? (

                    <div className="flex min-h-64 items-center justify-center p-8">

                        <div className="text-center">

                            <div
                                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-xl"
                                style={{
                                    backgroundColor:
                                        "var(--color-primary)",
                                    color:
                                        "var(--color-surface)",
                                }}
                            >
                                ⏳
                            </div>

                            <p className="text-sm font-semibold text-[var(--color-text)]">
                                Cargando ventas...
                            </p>

                        </div>

                    </div>

                ) : ventasFiltradas.length === 0 ? (

                    <div className="p-10 text-center">

                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background)] text-2xl">
                            🧾
                        </div>

                        <p className="mt-4 text-base font-semibold text-[var(--color-text)]">
                            No se encontraron ventas
                        </p>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Prueba cambiando los filtros de búsqueda.
                        </p>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[1350px]">

                            <thead>

                                <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Venta
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Fecha
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Cliente
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Sucursal
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Cajero
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Caja
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Método
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Total
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Neto
                                    </th>

                                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Estado
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Acción
                                    </th>

                                </tr>

                            </thead>

                            <tbody className="divide-y divide-[var(--color-border)]">

                                {ventasFiltradas.map(
                                    (venta) => {

                                        const estado =
                                            obtenerEstadoVenta(
                                                venta.estado
                                            );

                                        const totalDevuelto =
                                            obtenerTotalDevuelto(
                                                venta.id
                                            );

                                        const totalNeto =
                                            obtenerTotalNeto(
                                                venta
                                            );

                                        return (

                                            <tr
                                                key={venta.id}
                                                className="transition hover:bg-[var(--color-background)]"
                                            >

                                                {/* VENTA */}

                                                <td className="px-5 py-4">

                                                    <div>

                                                        <p className="font-semibold text-[var(--color-text)]">
                                                            #
                                                            {venta.id
                                                                .slice(
                                                                    0,
                                                                    8
                                                                )
                                                                .toUpperCase()}
                                                        </p>

                                                        {venta.referencia && (
                                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                Ref:{" "}
                                                                {venta.referencia}
                                                            </p>
                                                        )}

                                                    </div>

                                                </td>

                                                {/* FECHA */}

                                                <td className="px-5 py-4">

                                                    <p className="text-sm text-[var(--color-text)]">
                                                        {formatearFecha(
                                                            venta.created_at
                                                        )}
                                                    </p>

                                                </td>

                                                {/* CLIENTE */}

                                                <td className="px-5 py-4">

                                                    {venta.clientes ? (

                                                        <div>

                                                            <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                {venta.clientes.nombre}
                                                            </p>

                                                            {venta.clientes.telefono && (
                                                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                    {venta.clientes.telefono}
                                                                </p>
                                                            )}

                                                        </div>

                                                    ) : (

                                                        <div>

                                                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                                                                Venta mostrador
                                                            </p>

                                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                Sin cliente
                                                            </p>

                                                        </div>

                                                    )}

                                                </td>

                                                {/* SUCURSAL */}

                                                <td className="px-5 py-4">

                                                    <p className="text-sm font-medium text-[var(--color-text)]">
                                                        {venta.sucursales?.nombre ??
                                                            "Sin sucursal"}
                                                    </p>

                                                </td>

                                                {/* CAJERO */}

                                                <td className="px-5 py-4">

                                                    <p className="text-sm font-medium text-[var(--color-text)]">
                                                        {venta.usuarios?.nombre ??
                                                            "Sin usuario"}
                                                    </p>

                                                </td>

                                                {/* CAJA */}

                                                <td className="px-5 py-4">

                                                    <p className="text-sm font-medium text-[var(--color-text)]">
                                                        {venta.cajas?.nombre ??
                                                            "Sin caja"}
                                                    </p>

                                                </td>

                                                {/* MÉTODO */}

                                                <td className="px-5 py-4">

                                                    <span className="inline-flex rounded-full bg-[var(--color-background)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                                                        {obtenerNombreMetodo(
                                                            venta.metodo_pago
                                                        )}
                                                    </span>

                                                </td>

                                                {/* TOTAL */}

                                                <td className="px-5 py-4 text-right">

                                                    <p className="text-sm font-bold text-[var(--color-text)]">
                                                        {formatearMoneda(
                                                            Number(
                                                                venta.total
                                                            )
                                                        )}
                                                    </p>

                                                    {totalDevuelto >
                                                        0 && (
                                                            <p className="mt-1 text-xs font-semibold text-red-600">
                                                                Devuelto: -
                                                                {formatearMoneda(
                                                                    totalDevuelto
                                                                )}
                                                            </p>
                                                        )}

                                                </td>

                                                {/* NETO */}

                                                <td className="px-5 py-4 text-right">

                                                    <p className="text-sm font-bold text-[var(--color-text)]">
                                                        {formatearMoneda(
                                                            totalNeto
                                                        )}
                                                    </p>

                                                </td>

                                                {/* ESTADO */}

                                                <td className="px-5 py-4 text-center">

                                                    <span
                                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${estado.clase}`}
                                                    >
                                                        {estado.texto}
                                                    </span>

                                                </td>

                                                {/* ACCIÓN */}

                                                <td className="px-5 py-4 text-right">

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirDetalle(
                                                                venta
                                                            )
                                                        }
                                                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background)]"
                                                    >
                                                        👁️ Ver detalle
                                                    </button>

                                                </td>

                                            </tr>

                                        );
                                    }
                                )}

                            </tbody>

                        </table>

                    </div>

                )}

            </Card>

            {/* =====================================
                MODAL DETALLE
            ===================================== */}

            {ventaSeleccionada && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">

                    <div
                        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                    >

                        {/* ENCABEZADO */}

                        <div className="shrink-0 border-b border-[var(--color-border)] px-6 py-5">

                            <div className="flex items-start justify-between gap-4">

                                <div>

                                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Detalle de venta
                                    </p>

                                    <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">
                                        #
                                        {ventaSeleccionada.id
                                            .slice(
                                                0,
                                                8
                                            )
                                            .toUpperCase()}
                                    </h2>

                                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                        {formatearFecha(
                                            ventaSeleccionada.created_at
                                        )}
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarDetalle
                                    }
                                    className="flex h-10 w-10 items-center justify-center rounded-xl text-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-background)] hover:text-[var(--color-text)]"
                                    aria-label="Cerrar"
                                >
                                    ✕
                                </button>

                            </div>

                        </div>

                        {/* CONTENIDO */}

                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">

                            {cargandoDetalle ? (

                                <div className="flex min-h-64 items-center justify-center">

                                    <div className="text-center">

                                        <div
                                            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-xl"
                                            style={{
                                                backgroundColor:
                                                    "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                                                color:
                                                    "var(--color-primary)",
                                            }}
                                        >
                                            ⏳
                                        </div>

                                        <p className="text-sm font-semibold text-[var(--color-text)]">
                                            Cargando detalle...
                                        </p>

                                    </div>

                                </div>

                            ) : (

                                <div className="space-y-5">

                                    {/* INFORMACIÓN */}

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                                        {/* CLIENTE */}

                                        <div
                                            className="rounded-xl p-4 sm:col-span-2"
                                            style={{
                                                backgroundColor:
                                                    "color-mix(in srgb, var(--color-primary) 9%, transparent)",
                                            }}
                                        >

                                            <p
                                                className="text-xs font-semibold uppercase tracking-wide"
                                                style={{
                                                    color:
                                                        "var(--color-primary)",
                                                }}
                                            >
                                                Cliente
                                            </p>

                                            {ventaSeleccionada.clientes ? (

                                                <div className="mt-2">

                                                    <p className="text-base font-bold text-[var(--color-text)]">
                                                        {ventaSeleccionada.clientes.nombre}
                                                    </p>

                                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">

                                                        {ventaSeleccionada.clientes.telefono && (
                                                            <span>
                                                                📱{" "}
                                                                {ventaSeleccionada.clientes.telefono}
                                                            </span>
                                                        )}

                                                        {ventaSeleccionada.clientes.email && (
                                                            <span>
                                                                ✉️{" "}
                                                                {ventaSeleccionada.clientes.email.replace(
                                                                    "mailto:",
                                                                    ""
                                                                )}
                                                            </span>
                                                        )}

                                                    </div>

                                                </div>

                                            ) : (

                                                <p className="mt-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                                                    Venta mostrador — sin cliente asignado
                                                </p>

                                            )}

                                        </div>

                                        {/* SUCURSAL */}

                                        <div className="rounded-xl bg-[var(--color-background)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Sucursal
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                {ventaSeleccionada.sucursales?.nombre ??
                                                    "Sin sucursal"}
                                            </p>

                                        </div>

                                        {/* CAJERO */}

                                        <div className="rounded-xl bg-[var(--color-background)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Cajero
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                {ventaSeleccionada.usuarios?.nombre ??
                                                    "Sin usuario"}
                                            </p>

                                        </div>

                                        {/* CAJA */}

                                        <div className="rounded-xl bg-[var(--color-background)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Caja
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                {ventaSeleccionada.cajas?.nombre ??
                                                    "Sin caja"}
                                            </p>

                                        </div>

                                        {/* MÉTODO */}

                                        <div className="rounded-xl bg-[var(--color-background)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Método
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                {obtenerNombreMetodo(
                                                    ventaSeleccionada.metodo_pago
                                                )}
                                            </p>

                                        </div>

                                    </div>

                                    {/* PRODUCTOS */}

                                    <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">

                                        <div className="border-b border-[var(--color-border)] px-4 py-3">

                                            <p className="text-sm font-bold text-[var(--color-text)]">
                                                Productos
                                            </p>

                                        </div>

                                        <div className="overflow-x-auto">

                                            <table className="w-full min-w-[600px]">

                                                <thead>

                                                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">

                                                        <th className="px-4 py-3 text-left text-xs font-bold text-[var(--color-text-secondary)]">
                                                            Producto
                                                        </th>

                                                        <th className="px-4 py-3 text-center text-xs font-bold text-[var(--color-text-secondary)]">
                                                            Cant.
                                                        </th>

                                                        <th className="px-4 py-3 text-right text-xs font-bold text-[var(--color-text-secondary)]">
                                                            Precio
                                                        </th>

                                                        <th className="px-4 py-3 text-right text-xs font-bold text-[var(--color-text-secondary)]">
                                                            Total
                                                        </th>

                                                    </tr>

                                                </thead>

                                                <tbody className="divide-y divide-[var(--color-border)]">

                                                    {detalleVenta.length === 0 ? (

                                                        <tr>

                                                            <td
                                                                colSpan={4}
                                                                className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]"
                                                            >
                                                                No hay productos registrados.
                                                            </td>

                                                        </tr>

                                                    ) : (

                                                        detalleVenta.map(
                                                            (
                                                                detalle
                                                            ) => (

                                                                <tr
                                                                    key={
                                                                        detalle.id
                                                                    }
                                                                >

                                                                    <td className="px-4 py-3">

                                                                        <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                            {detalle.productos?.nombre ??
                                                                                "Producto"}
                                                                        </p>

                                                                        {detalle.productos?.sku && (
                                                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                                SKU:{" "}
                                                                                {
                                                                                    detalle.productos.sku
                                                                                }
                                                                            </p>
                                                                        )}

                                                                    </td>

                                                                    <td className="px-4 py-3 text-center">

                                                                        <span className="text-sm font-medium text-[var(--color-text)]">
                                                                            {Number(
                                                                                detalle.cantidad
                                                                            )}
                                                                        </span>

                                                                        {detalle.productos?.unidad && (
                                                                            <span className="ml-1 text-xs text-[var(--color-text-secondary)]">
                                                                                {
                                                                                    detalle.productos.unidad
                                                                                }
                                                                            </span>
                                                                        )}

                                                                    </td>

                                                                    <td className="px-4 py-3 text-right">

                                                                        <span className="text-sm text-[var(--color-text)]">
                                                                            {formatearMoneda(
                                                                                Number(
                                                                                    detalle.precio_unitario
                                                                                )
                                                                            )}
                                                                        </span>

                                                                    </td>

                                                                    <td className="px-4 py-3 text-right">

                                                                        <span className="text-sm font-bold text-[var(--color-text)]">
                                                                            {formatearMoneda(
                                                                                Number(
                                                                                    detalle.total
                                                                                )
                                                                            )}
                                                                        </span>

                                                                    </td>

                                                                </tr>

                                                            )
                                                        )

                                                    )}

                                                </tbody>

                                            </table>

                                        </div>

                                    </div>

                                    {/* TOTALES */}

                                    <div className="rounded-xl bg-[var(--color-background)] p-4">

                                        <div className="space-y-2">

                                            <div className="flex items-center justify-between">

                                                <span className="text-sm text-[var(--color-text-secondary)]">
                                                    Subtotal
                                                </span>

                                                <span className="text-sm font-semibold text-[var(--color-text)]">
                                                    {formatearMoneda(
                                                        Number(
                                                            ventaSeleccionada.subtotal
                                                        )
                                                    )}
                                                </span>

                                            </div>

                                            <div className="flex items-center justify-between">

                                                <span className="text-sm text-[var(--color-text-secondary)]">
                                                    Descuento
                                                </span>

                                                <span className="text-sm font-semibold text-[var(--color-text)]">
                                                    {formatearMoneda(
                                                        Number(
                                                            ventaSeleccionada.descuento
                                                        )
                                                    )}
                                                </span>

                                            </div>

                                            <div className="flex items-center justify-between">

                                                <span className="text-sm text-[var(--color-text-secondary)]">
                                                    Impuesto
                                                </span>

                                                <span className="text-sm font-semibold text-[var(--color-text)]">
                                                    {formatearMoneda(
                                                        Number(
                                                            ventaSeleccionada.impuesto
                                                        )
                                                    )}
                                                </span>

                                            </div>

                                            <div className="border-t border-[var(--color-border)] pt-3">

                                                <div className="flex items-center justify-between">

                                                    <span className="text-base font-bold text-[var(--color-text)]">
                                                        Total original
                                                    </span>

                                                    <span className="text-xl font-bold text-[var(--color-text)]">
                                                        {formatearMoneda(
                                                            Number(
                                                                ventaSeleccionada.total
                                                            )
                                                        )}
                                                    </span>

                                                </div>

                                            </div>

                                            {/* DEVOLUCIONES */}

                                            {obtenerTotalDevuelto(
                                                ventaSeleccionada.id
                                            ) > 0 && (

                                                    <>

                                                        <div className="flex items-center justify-between pt-2">

                                                            <span className="text-sm font-semibold text-red-600">
                                                                Devoluciones
                                                            </span>

                                                            <span className="text-sm font-bold text-red-600">
                                                                -
                                                                {formatearMoneda(
                                                                    obtenerTotalDevuelto(
                                                                        ventaSeleccionada.id
                                                                    )
                                                                )}
                                                            </span>

                                                        </div>

                                                        <div className="border-t border-[var(--color-border)] pt-3">

                                                            <div className="flex items-center justify-between">

                                                                <span className="text-base font-bold text-[var(--color-text)]">
                                                                    Total neto
                                                                </span>

                                                                <span className="text-xl font-bold text-[var(--color-text)]">
                                                                    {formatearMoneda(
                                                                        obtenerTotalNeto(
                                                                            ventaSeleccionada
                                                                        )
                                                                    )}
                                                                </span>

                                                            </div>

                                                        </div>

                                                    </>

                                                )}

                                        </div>

                                    </div>

                                    {/* DEVOLUCIONES REALIZADAS */}

                                    {obtenerDevolucionesVenta(
                                        ventaSeleccionada.id
                                    ).length > 0 && (

                                            <div className="overflow-hidden rounded-xl border border-red-200">

                                                <div className="border-b border-red-200 bg-red-50 px-4 py-3">

                                                    <p className="text-sm font-bold text-red-800">
                                                        Devoluciones realizadas
                                                    </p>

                                                </div>

                                                <div className="divide-y divide-red-100">

                                                    {obtenerDevolucionesVenta(
                                                        ventaSeleccionada.id
                                                    ).map(
                                                        (
                                                            devolucion
                                                        ) => (

                                                            <div
                                                                key={
                                                                    devolucion.id
                                                                }
                                                                className="flex items-center justify-between gap-4 px-4 py-3"
                                                            >

                                                                <div>

                                                                    <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                        Reembolso por devolución
                                                                    </p>

                                                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                        {formatearFecha(
                                                                            devolucion.created_at
                                                                        )}
                                                                    </p>

                                                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                        Método de reembolso:{" "}
                                                                        {obtenerNombreMetodo(
                                                                            devolucion.metodo_reembolso
                                                                        )}
                                                                    </p>

                                                                </div>

                                                                <p className="text-sm font-bold text-red-600">
                                                                    -
                                                                    {formatearMoneda(
                                                                        Number(
                                                                            devolucion.monto_total
                                                                        )
                                                                    )}
                                                                </p>

                                                            </div>

                                                        )
                                                    )}

                                                </div>

                                            </div>

                                        )}

                                    {/* PAGOS */}

                                    <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">

                                        <div className="border-b border-[var(--color-border)] px-4 py-3">

                                            <p className="text-sm font-bold text-[var(--color-text)]">
                                                Pagos
                                            </p>

                                        </div>

                                        <div className="divide-y divide-[var(--color-border)]">

                                            {pagosVenta.length === 0 ? (

                                                <div className="p-4 text-sm text-[var(--color-text-secondary)]">
                                                    No hay pagos registrados.
                                                </div>

                                            ) : (

                                                pagosVenta.map(
                                                    (
                                                        pago
                                                    ) => (

                                                        <div
                                                            key={
                                                                pago.id
                                                            }
                                                            className="flex items-center justify-between gap-4 px-4 py-3"
                                                        >

                                                            <div>

                                                                <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                    {obtenerNombreMetodo(
                                                                        pago.metodo_pago
                                                                    )}
                                                                </p>

                                                                {pago.referencia && (
                                                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                        Ref:{" "}
                                                                        {
                                                                            pago.referencia
                                                                        }
                                                                    </p>
                                                                )}

                                                                {pago.monto_recibido !==
                                                                    null &&
                                                                    pago.monto_recibido !==
                                                                    undefined && (

                                                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">

                                                                            Recibido:{" "}
                                                                            {formatearMoneda(
                                                                                Number(
                                                                                    pago.monto_recibido
                                                                                )
                                                                            )}

                                                                            {" · "}

                                                                            Cambio:{" "}
                                                                            {formatearMoneda(
                                                                                Number(
                                                                                    pago.cambio
                                                                                )
                                                                            )}

                                                                        </p>

                                                                    )}

                                                            </div>

                                                            <p className="text-sm font-bold text-[var(--color-text)]">
                                                                {formatearMoneda(
                                                                    Number(
                                                                        pago.monto
                                                                    )
                                                                )}
                                                            </p>

                                                        </div>

                                                    )
                                                )

                                            )}

                                        </div>

                                    </div>

                                    {/* NOTAS */}

                                    {ventaSeleccionada.notas && (

                                        <div
                                            className="rounded-xl border p-4"
                                            style={{
                                                borderColor:
                                                    "color-mix(in srgb, var(--color-primary) 30%, transparent)",
                                                backgroundColor:
                                                    "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                                            }}
                                        >

                                            <p
                                                className="text-xs font-bold uppercase tracking-wide"
                                                style={{
                                                    color:
                                                        "var(--color-primary)",
                                                }}
                                            >
                                                Notas
                                            </p>

                                            <p
                                                className="mt-2 text-sm"
                                                style={{
                                                    color:
                                                        "var(--color-primary)",
                                                }}
                                            >
                                                {
                                                    ventaSeleccionada.notas
                                                }
                                            </p>

                                        </div>

                                    )}

                                </div>

                            )}

                        </div>

                        {/* FOOTER */}

                        <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-background)] px-6 py-4">

                            <button
                                type="button"
                                onClick={
                                    cerrarDetalle
                                }
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-background)] sm:w-auto"
                            >
                                Cerrar
                            </button>

                        </div>

                    </div>

                </div>

            )}

        </div>
    );
}