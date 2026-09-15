"use client";

import { useEffect, useMemo, useState } from "react";

import Card from "../../components/Card";
import Button from "../../components/Button";
import ModalMensaje from "../../components/ModalMensaje";

import { supabase } from "../../../lib/supabase";
import { obtenerUsuarioActual } from "../../../lib/auth/roleGuard";

/*
 * ==========================================
 * TIPOS
 * ==========================================
 */

interface Devolucion {
    id: string;
    negocio_id: string;
    sucursal_id: string;
    caja_id: string;
    sesion_caja_id: string;
    venta_id: string;
    usuario_id: string;

    monto_total: number;
    motivo: string | null;
    estado: string;
    metodo_reembolso: string | null;

    created_at: string;

    sucursales: {
        nombre: string;
    } | null;

    cajas: {
        nombre: string;
    } | null;

    usuarios: {
        nombre: string;
    } | null;

    ventas: {
        total: number;
        metodo_pago: string;
        referencia: string | null;
    } | null;
}

interface DetalleDevolucion {
    id: string;
    devolucion_id: string;
    detalle_venta_id: string;
    producto_id: string;

    cantidad: number;
    precio_unitario: number;
    descuento: number;
    impuesto: number;
    subtotal: number;
    total: number;

    created_at: string;

    productos: {
        nombre: string;
        codigo_barras: string | null;
        sku: string | null;
        unidad: string;
    } | null;
}

interface UsuarioActual {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

interface Sucursal {
    id: string;
    nombre: string;
}

/*
 * ==========================================
 * COMPONENTE
 * ==========================================
 */

export default function DevolucionesPage() {
    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

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

    const [metodoFiltro, setMetodoFiltro] =
        useState("todos");

    const [estadoFiltro, setEstadoFiltro] =
        useState("todos");

    const [devolucionSeleccionada, setDevolucionSeleccionada] =
        useState<Devolucion | null>(null);

    const [detalleDevolucion, setDetalleDevolucion] =
        useState<DetalleDevolucion[]>([]);

    const [cargandoDetalle, setCargandoDetalle] =
        useState(false);

    const [sucursales, setSucursales] =
        useState<Sucursal[]>([]);

    const [sucursalFiltro, setSucursalFiltro] =
        useState("todas");

    /*
     * ==========================================
     * MODAL DE MENSAJES
     * ==========================================
     */

    const [modalMensajeAbierto, setModalMensajeAbierto] =
        useState(false);

    const [tipoMensaje, setTipoMensaje] =
        useState<
            "exito" | "error" | "confirmacion" | "info"
        >("info");

    const [tituloMensaje, setTituloMensaje] =
        useState("");

    const [textoMensaje, setTextoMensaje] =
        useState("");

    function mostrarMensaje(
        tipo: "exito" | "error" | "confirmacion" | "info",
        titulo: string,
        mensaje: string
    ) {
        if (!mensaje) {
            return;
        }

        setTipoMensaje(tipo);
        setTituloMensaje(titulo);
        setTextoMensaje(mensaje);
        setModalMensajeAbierto(true);
    }

    function cerrarModalMensaje() {
        setModalMensajeAbierto(false);
    }

    function mostrarError(mensaje: string) {
        if (!mensaje) {
            return;
        }

        setError(mensaje);

        mostrarMensaje(
            "error",
            "Error",
            mensaje
        );
    }

    /*
     * ==========================================
     * FECHA LOCAL
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

        return `${year}-${month}-${day}`;
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
     * NOMBRE MÉTODO
     * ==========================================
     */

    function obtenerNombreMetodo(
        metodo: string | null
    ) {
        switch (metodo) {
            case "efectivo":
                return "Efectivo";

            case "tarjeta":
                return "Tarjeta";

            case "transferencia":
                return "Transferencia";

            case "mixto":
                return "Mixto";

            default:
                return metodo || "Otro";
        }
    }

    /*
     * ==========================================
     * ESTADO DEVOLUCIÓN
     * ==========================================
     */

    function obtenerEstadoDevolucion(
        estado: string
    ) {
        switch (estado) {
            case "completada":
                return {
                    texto: "Completada",
                    clase:
                        "bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success)]",
                };

            case "pendiente":
                return {
                    texto: "Pendiente",
                    clase:
                        "bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]",
                };

            case "cancelada":
                return {
                    texto: "Cancelada",
                    clase:
                        "bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]",
                };

            default:
                return {
                    texto: estado,
                    clase:
                        "bg-[color-mix(in_srgb,var(--color-text-secondary)_10%,transparent)] text-[var(--color-text-secondary)]",
                };
        }
    }

    /*
     * ==========================================
     * CARGAR DEVOLUCIONES
     * ==========================================
     */

    async function cargarDevoluciones() {
        setCargando(true);
        setError("");

        try {
            const usuarioActual =
                (await obtenerUsuarioActual()) as UsuarioActual | null;

            if (
                !usuarioActual?.id ||
                !usuarioActual.negocio_id
            ) {
                mostrarError(
                    "No se encontró la información del usuario."
                );

                return;
            }

            /*
             * ======================================
             * SUCURSALES
             * ======================================
             */

            const {
                data: sucursalesData,
                error: errorSucursales,
            } = await supabase
                .from("sucursales")
                .select(`
                    id,
                    nombre
                `)
                .eq(
                    "negocio_id",
                    usuarioActual.negocio_id
                )
                .order(
                    "nombre",
                    {
                        ascending: true,
                    }
                );

            if (errorSucursales) {
                console.error(
                    "Error cargando sucursales:",
                    errorSucursales
                );

                mostrarError(
                    "No se pudieron cargar las sucursales."
                );

                return;
            }

            setSucursales(
                (sucursalesData as Sucursal[]) ?? []
            );

            /*
             * ======================================
             * SOLO ADMINISTRADORES
             * ======================================
             */

            if (
                usuarioActual.rol !==
                "admin"
            ) {
                mostrarError(
                    "No tienes permisos para consultar las devoluciones administrativas."
                );

                return;
            }

            setUsuario(
                usuarioActual
            );

            /*
             * ======================================
             * DEVOLUCIONES
             * ======================================
             */

            const {
                data,
                error: errorDevoluciones,
            } = await supabase
                .from("devoluciones")
                .select(`
                    id,
                    negocio_id,
                    sucursal_id,
                    caja_id,
                    sesion_caja_id,
                    venta_id,
                    usuario_id,
                    monto_total,
                    motivo,
                    estado,
                    metodo_reembolso,
                    created_at,

                    sucursales: sucursales(
                        nombre
                    ),

                    cajas: cajas(
                        nombre
                    ),

                    usuarios: usuarios(
                        nombre
                    ),

                    ventas: ventas(
                        total,
                        metodo_pago,
                        referencia
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

            if (errorDevoluciones) {
                console.error(
                    "Error cargando devoluciones:",
                    errorDevoluciones
                );

                mostrarError(
                    errorDevoluciones.message ||
                    "No se pudieron cargar las devoluciones."
                );

                return;
            }

            setDevoluciones(
                (data as unknown as Devolucion[]) ?? []
            );

        } catch (error) {
            console.error(
                "Error inesperado cargando devoluciones:",
                error
            );

            mostrarError(
                "Ocurrió un error al cargar las devoluciones."
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

        cargarDevoluciones();
    }, []);

    /*
     * ==========================================
     * DEVOLUCIONES FILTRADAS
     * ==========================================
     */

    const devolucionesFiltradas =
        useMemo(() => {
            return devoluciones.filter(
                (devolucion) => {

                    /*
                     * ==================================
                     * FECHA
                     * ==================================
                     */

                    const fecha =
                        new Date(
                            devolucion.created_at
                        );

                    const fechaLocal =
                        `${fecha.getFullYear()}-${String(
                            fecha.getMonth() + 1
                        ).padStart(
                            2,
                            "0"
                        )}-${String(
                            fecha.getDate()
                        ).padStart(
                            2,
                            "0"
                        )}`;

                    if (
                        fechaDesde &&
                        fechaLocal <
                        fechaDesde
                    ) {
                        return false;
                    }

                    if (
                        fechaHasta &&
                        fechaLocal >
                        fechaHasta
                    ) {
                        return false;
                    }

                    /*
                     * ==================================
                     * MÉTODO
                     * ==================================
                     */

                    if (
                        metodoFiltro !==
                        "todos" &&
                        devolucion.metodo_reembolso !==
                        metodoFiltro
                    ) {
                        return false;
                    }

                    /*
                     * ==================================
                     * ESTADO
                     * ==================================
                     */

                    if (
                        estadoFiltro !==
                        "todos" &&
                        devolucion.estado !==
                        estadoFiltro
                    ) {
                        return false;
                    }

                    /*
                     * ==================================
                     * SUCURSAL
                     * ==================================
                     */

                    if (
                        sucursalFiltro !==
                        "todas" &&
                        devolucion.sucursal_id !==
                        sucursalFiltro
                    ) {
                        return false;
                    }

                    /*
                     * ==================================
                     * BÚSQUEDA
                     * ==================================
                     */

                    const texto =
                        busqueda
                            .trim()
                            .toLowerCase();

                    if (!texto) {
                        return true;
                    }

                    const coincide =
                        devolucion.id
                            .toLowerCase()
                            .includes(texto) ||

                        devolucion.venta_id
                            .toLowerCase()
                            .includes(texto) ||

                        devolucion.usuarios?.nombre
                            ?.toLowerCase()
                            .includes(texto) ||

                        devolucion.cajas?.nombre
                            ?.toLowerCase()
                            .includes(texto) ||

                        devolucion.sucursales?.nombre
                            ?.toLowerCase()
                            .includes(texto) ||

                        devolucion.metodo_reembolso
                            ?.toLowerCase()
                            .includes(texto) ||

                        devolucion.motivo
                            ?.toLowerCase()
                            .includes(texto);

                    return !!coincide;
                }
            );
        }, [
            devoluciones,
            busqueda,
            fechaDesde,
            fechaHasta,
            metodoFiltro,
            estadoFiltro,
            sucursalFiltro,
        ]);

    /*
     * ==========================================
     * RESUMEN
     * ==========================================
     */

    const resumen =
        useMemo(() => {
            let total = 0;
            let efectivo = 0;
            let tarjeta = 0;
            let transferencia = 0;
            let completadas = 0;

            devolucionesFiltradas.forEach(
                (devolucion) => {
                    if (
                        devolucion.estado !==
                        "completada"
                    ) {
                        return;
                    }

                    const monto =
                        Number(
                            devolucion.monto_total
                        ) || 0;

                    total += monto;
                    completadas++;

                    if (
                        devolucion.metodo_reembolso ===
                        "efectivo"
                    ) {
                        efectivo += monto;
                    }

                    if (
                        devolucion.metodo_reembolso ===
                        "tarjeta"
                    ) {
                        tarjeta += monto;
                    }

                    if (
                        devolucion.metodo_reembolso ===
                        "transferencia"
                    ) {
                        transferencia += monto;
                    }
                }
            );

            return {
                total,
                efectivo,
                tarjeta,
                transferencia,
                completadas,
            };
        }, [
            devolucionesFiltradas,
        ]);

    /*
     * ==========================================
     * VER DETALLE
     * ==========================================
     */

    async function abrirDetalle(
        devolucion: Devolucion
    ) {
        setDevolucionSeleccionada(
            devolucion
        );

        setDetalleDevolucion([]);

        setCargandoDetalle(true);

        setError("");

        try {
            const {
                data,
                error: errorDetalle,
            } = await supabase
                .from("detalle_devoluciones")
                .select(`
                    id,
                    devolucion_id,
                    detalle_venta_id,
                    producto_id,
                    cantidad,
                    precio_unitario,
                    descuento,
                    impuesto,
                    subtotal,
                    total,
                    created_at,

                    productos: productos(
                        nombre,
                        codigo_barras,
                        sku,
                        unidad
                    )
                `)
                .eq(
                    "devolucion_id",
                    devolucion.id
                )
                .order(
                    "created_at",
                    {
                        ascending: true,
                    }
                );

            if (errorDetalle) {
                console.error(
                    "Error obteniendo detalle de devolución:",
                    errorDetalle
                );

                mostrarError(
                    "No se pudo obtener el detalle de la devolución."
                );

                return;
            }

            setDetalleDevolucion(
                (data as unknown as DetalleDevolucion[]) ?? []
            );

        } catch (error) {
            console.error(
                "Error inesperado obteniendo detalle:",
                error
            );

            mostrarError(
                "Ocurrió un error al obtener el detalle de la devolución."
            );
        } finally {
            setCargandoDetalle(
                false
            );
        }
    }

    /*
     * ==========================================
     * CERRAR DETALLE
     * ==========================================
     */

    function cerrarDetalle() {
        setDevolucionSeleccionada(
            null
        );

        setDetalleDevolucion([]);
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

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
                        Devoluciones
                    </h1>

                    <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
                        Consulta y administra las devoluciones realizadas en tu negocio.
                    </p>
                </div>

                {usuario && (
                    <div className="flex items-center gap-3">

                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold text-[var(--color-text)]">
                                {usuario.nombre}
                            </p>

                            <p className="text-xs capitalize text-[var(--color-text-secondary)]">
                                {usuario.rol}
                            </p>
                        </div>

                        <Button
                            type="button"
                            variant="secondary"
                            size="small"
                            onClick={cargarDevoluciones}
                            disabled={cargando}
                        >
                            {cargando
                                ? "Actualizando..."
                                : "↻ Actualizar"}
                        </Button>

                    </div>
                )}

            </div>


            {/* =====================================
                INFORMACIÓN DEL USUARIO EN MÓVIL
            ===================================== */}

            {usuario && (
                <Card className="p-4 sm:hidden">

                    <div className="flex items-center justify-between gap-4">

                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                                {usuario.nombre}
                            </p>

                            <p className="text-xs capitalize text-[var(--color-text-secondary)]">
                                {usuario.rol}
                            </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                            Administrador
                        </span>

                    </div>

                </Card>
            )}


            {/* =====================================
                RESUMEN
            ===================================== */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

                {/* DEVOLUCIONES */}

                <Card className="p-5">

                    <div className="flex items-start justify-between gap-4">

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Devoluciones
                            </p>

                            <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                                {resumen.completadas}
                            </p>
                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] text-xl">
                            ↩️
                        </div>

                    </div>

                </Card>


                {/* TOTAL */}

                <Card className="p-5">

                    <div className="flex items-start justify-between gap-4">

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Total devuelto
                            </p>

                            <p className="mt-2 text-2xl font-bold text-[var(--color-danger)]">
                                -{formatearMoneda(
                                    resumen.total
                                )}
                            </p>
                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] text-xl">
                            💸
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

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-xl">
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

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-xl">
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

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] text-xl">
                            🏦
                        </div>

                    </div>

                </Card>

            </div>


            {/* =====================================
                FILTROS
            ===================================== */}

            <Card className="p-5">

                <div className="mb-5">

                    <h2 className="text-base font-bold text-[var(--color-text)]">
                        Buscar devoluciones
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                        Filtra por fecha, folio, cajero, sucursal, caja, método o motivo.
                    </p>

                </div>


                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">

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
                            placeholder="Folio, venta, cajero, sucursal, caja o motivo..."
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]"
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
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]"
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
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]"
                        />

                    </div>


                    {/* MÉTODO */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                            Método
                        </label>

                        <select
                            value={metodoFiltro}
                            onChange={(e) =>
                                setMetodoFiltro(
                                    e.target.value
                                )
                            }
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]"
                        >
                            <option value="todos">
                                Todos
                            </option>

                            <option value="efectivo">
                                Efectivo
                            </option>

                            <option value="tarjeta">
                                Tarjeta
                            </option>

                            <option value="transferencia">
                                Transferencia
                            </option>

                            <option value="mixto">
                                Mixto
                            </option>

                        </select>

                    </div>


                    {/* SUCURSAL */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                            Sucursal
                        </label>

                        <select
                            value={sucursalFiltro}
                            onChange={(e) =>
                                setSucursalFiltro(
                                    e.target.value
                                )
                            }
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]"
                        >
                            <option value="todas">
                                Todas
                            </option>

                            {sucursales.map(
                                (sucursal) => (
                                    <option
                                        key={sucursal.id}
                                        value={sucursal.id}
                                    >
                                        {sucursal.nombre}
                                    </option>
                                )
                            )}

                        </select>

                    </div>


                    {/* ESTADO */}

                    <div>

                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                            Estado
                        </label>

                        <select
                            value={estadoFiltro}
                            onChange={(e) =>
                                setEstadoFiltro(
                                    e.target.value
                                )
                            }
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]"
                        >
                            <option value="todos">
                                Todos
                            </option>

                            <option value="completada">
                                Completada
                            </option>

                            <option value="pendiente">
                                Pendiente
                            </option>

                            <option value="cancelada">
                                Cancelada
                            </option>

                        </select>

                    </div>

                </div>

            </Card>


            {/* =====================================
                TABLA
            ===================================== */}

            <Card className="overflow-hidden">

                <div className="border-b border-[var(--color-border)] px-5 py-4">

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                            <h2 className="text-base font-bold text-[var(--color-text)]">
                                Historial de devoluciones
                            </h2>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                {resumen.completadas} devoluciones completadas
                            </p>

                        </div>

                        <span className="self-start rounded-full bg-[color-mix(in_srgb,var(--color-text-secondary)_8%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                            {devolucionesFiltradas.length} resultado
                            {devolucionesFiltradas.length === 1
                                ? ""
                                : "s"}
                        </span>

                    </div>

                </div>


                {cargando ? (

                    <div className="flex min-h-64 items-center justify-center p-8">

                        <div className="text-center">

                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-xl">
                                ⏳
                            </div>

                            <p className="text-sm font-semibold text-[var(--color-text)]">
                                Cargando devoluciones...
                            </p>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Consultando información del negocio.
                            </p>

                        </div>

                    </div>

                ) : devolucionesFiltradas.length === 0 ? (

                    <div className="p-10 text-center">

                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--color-text-secondary)_8%,transparent)] text-2xl">
                            ↩️
                        </div>

                        <p className="mt-4 text-base font-semibold text-[var(--color-text)]">
                            No se encontraron devoluciones
                        </p>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Prueba cambiando los filtros de búsqueda.
                        </p>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[1100px]">

                            <thead>

                                <tr className="border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)]">

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Devolución
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Venta
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Fecha
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Usuario
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Sucursal
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

                                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Estado
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Acción
                                    </th>

                                </tr>

                            </thead>


                            <tbody className="divide-y divide-[var(--color-border)]">

                                {devolucionesFiltradas.map(
                                    (devolucion) => {

                                        const estado =
                                            obtenerEstadoDevolucion(
                                                devolucion.estado
                                            );

                                        return (
                                            <tr
                                                key={
                                                    devolucion.id
                                                }
                                                className="transition hover:bg-[color-mix(in_srgb,var(--color-primary)_3%,transparent)]"
                                            >

                                                {/* DEVOLUCIÓN */}

                                                <td className="px-5 py-4">

                                                    <p className="font-semibold text-[var(--color-text)]">
                                                        #
                                                        {devolucion.id
                                                            .slice(
                                                                0,
                                                                8
                                                            )
                                                            .toUpperCase()}
                                                    </p>

                                                    {devolucion.motivo && (
                                                        <p className="mt-1 max-w-[180px] truncate text-xs text-[var(--color-text-secondary)]">
                                                            {devolucion.motivo}
                                                        </p>
                                                    )}

                                                </td>


                                                {/* VENTA */}

                                                <td className="px-5 py-4">

                                                    <p className="font-semibold text-[var(--color-text)]">
                                                        #
                                                        {devolucion.venta_id
                                                            .slice(
                                                                0,
                                                                8
                                                            )
                                                            .toUpperCase()}
                                                    </p>

                                                    {devolucion.ventas?.referencia && (
                                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                            Ref:{" "}
                                                            {
                                                                devolucion
                                                                    .ventas
                                                                    .referencia
                                                            }
                                                        </p>
                                                    )}

                                                </td>


                                                {/* FECHA */}

                                                <td className="px-5 py-4">

                                                    <p className="text-sm text-[var(--color-text)]">
                                                        {formatearFecha(
                                                            devolucion.created_at
                                                        )}
                                                    </p>

                                                </td>


                                                {/* USUARIO */}

                                                <td className="px-5 py-4">

                                                    <p className="text-sm font-medium text-[var(--color-text)]">
                                                        {devolucion.usuarios?.nombre ??
                                                            "Sin usuario"}
                                                    </p>

                                                </td>


                                                {/* SUCURSAL */}

                                                <td className="px-5 py-4">

                                                    <p className="text-sm font-medium text-[var(--color-text)]">
                                                        {devolucion.sucursales?.nombre ??
                                                            "Sin sucursal"}
                                                    </p>

                                                </td>


                                                {/* CAJA */}

                                                <td className="px-5 py-4">

                                                    <p className="text-sm font-medium text-[var(--color-text)]">
                                                        {devolucion.cajas?.nombre ??
                                                            "Sin caja"}
                                                    </p>

                                                </td>


                                                {/* MÉTODO */}

                                                <td className="px-5 py-4">

                                                    <span className="inline-flex rounded-full bg-[color-mix(in_srgb,var(--color-text-secondary)_8%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                                                        {obtenerNombreMetodo(
                                                            devolucion.metodo_reembolso
                                                        )}
                                                    </span>

                                                </td>


                                                {/* TOTAL */}

                                                <td className="px-5 py-4 text-right">

                                                    <p className="text-sm font-bold text-[var(--color-danger)]">
                                                        -
                                                        {formatearMoneda(
                                                            Number(
                                                                devolucion.monto_total
                                                            )
                                                        )}
                                                    </p>

                                                </td>


                                                {/* ESTADO */}

                                                <td className="px-5 py-4 text-center">

                                                    <span
                                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${estado.clase}`}
                                                    >
                                                        {
                                                            estado.texto
                                                        }
                                                    </span>

                                                </td>


                                                {/* ACCIÓN */}

                                                <td className="px-5 py-4 text-right">

                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="small"
                                                        onClick={() =>
                                                            abrirDetalle(
                                                                devolucion
                                                            )
                                                        }
                                                    >
                                                        👁️ Ver detalle
                                                    </Button>

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

            {devolucionSeleccionada && (

                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6"
                    onMouseDown={(e) => {
                        if (
                            e.target === e.currentTarget &&
                            !cargandoDetalle
                        ) {
                            cerrarDetalle();
                        }
                    }}
                >

                    <div
                        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:max-h-[90vh]"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titulo-detalle-devolucion"
                    >

                        {/* =================================
                            ENCABEZADO
                        ================================= */}

                        <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-4 sm:px-6 sm:py-5">

                            <div className="flex items-start justify-between gap-4">

                                <div className="min-w-0">

                                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Detalle de devolución
                                    </p>

                                    <h2
                                        id="titulo-detalle-devolucion"
                                        className="mt-1 text-lg font-bold text-[var(--color-text)] sm:text-xl"
                                    >
                                        #
                                        {devolucionSeleccionada.id
                                            .slice(
                                                0,
                                                8
                                            )
                                            .toUpperCase()}
                                    </h2>

                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)] sm:text-sm">
                                        {formatearFecha(
                                            devolucionSeleccionada.created_at
                                        )}
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarDetalle
                                    }
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl text-[var(--color-text-secondary)] transition hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] hover:text-[var(--color-text)]"
                                    aria-label="Cerrar"
                                >
                                    ✕
                                </button>

                            </div>

                        </div>


                        {/* =================================
                            CONTENIDO
                        ================================= */}

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">

                            {cargandoDetalle ? (

                                <div className="flex min-h-64 items-center justify-center">

                                    <div className="text-center">

                                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-xl">
                                            ⏳
                                        </div>

                                        <p className="text-sm font-semibold text-[var(--color-text)]">
                                            Cargando detalle...
                                        </p>

                                    </div>

                                </div>

                            ) : (

                                <div className="space-y-5">

                                    {/* ==========================
                                        INFORMACIÓN
                                    ========================== */}

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Venta
                                            </p>

                                            <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text)]">
                                                #
                                                {devolucionSeleccionada.venta_id
                                                    .slice(
                                                        0,
                                                        8
                                                    )
                                                    .toUpperCase()}
                                            </p>

                                        </div>


                                        <div className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Usuario
                                            </p>

                                            <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text)]">
                                                {devolucionSeleccionada.usuarios?.nombre ??
                                                    "Sin usuario"}
                                            </p>

                                        </div>


                                        <div className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Caja
                                            </p>

                                            <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text)]">
                                                {devolucionSeleccionada.cajas?.nombre ??
                                                    "Sin caja"}
                                            </p>

                                        </div>


                                        <div className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Método
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                {obtenerNombreMetodo(
                                                    devolucionSeleccionada.metodo_reembolso
                                                )}
                                            </p>

                                        </div>

                                    </div>


                                    {/* ==========================
                                        SUCURSAL / ESTADO
                                    ========================== */}

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Sucursal
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                {devolucionSeleccionada.sucursales?.nombre ??
                                                    "Sin sucursal"}
                                            </p>

                                        </div>


                                        <div className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Estado
                                            </p>

                                            <div className="mt-1">

                                                {(() => {
                                                    const estado =
                                                        obtenerEstadoDevolucion(
                                                            devolucionSeleccionada.estado
                                                        );

                                                    return (
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${estado.clase}`}
                                                        >
                                                            {
                                                                estado.texto
                                                            }
                                                        </span>
                                                    );
                                                })()}

                                            </div>

                                        </div>

                                    </div>


                                    {/* ==========================
                                        PRODUCTOS
                                    ========================== */}

                                    <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">

                                        <div className="border-b border-[var(--color-border)] px-4 py-3">

                                            <p className="text-sm font-bold text-[var(--color-text)]">
                                                Productos devueltos
                                            </p>

                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                Detalle registrado en la devolución.
                                            </p>

                                        </div>


                                        <div className="overflow-x-auto">

                                            <table className="w-full min-w-[650px]">

                                                <thead>

                                                    <tr className="border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)]">

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
                                                            Descuento
                                                        </th>

                                                        <th className="px-4 py-3 text-right text-xs font-bold text-[var(--color-text-secondary)]">
                                                            Impuesto
                                                        </th>

                                                        <th className="px-4 py-3 text-right text-xs font-bold text-[var(--color-text-secondary)]">
                                                            Total
                                                        </th>

                                                    </tr>

                                                </thead>


                                                <tbody className="divide-y divide-[var(--color-border)]">

                                                    {detalleDevolucion.length === 0 ? (

                                                        <tr>

                                                            <td
                                                                colSpan={6}
                                                                className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]"
                                                            >
                                                                No hay productos registrados en esta devolución.
                                                            </td>

                                                        </tr>

                                                    ) : (

                                                        detalleDevolucion.map(
                                                            (
                                                                detalle
                                                            ) => (

                                                                <tr
                                                                    key={
                                                                        detalle.id
                                                                    }
                                                                    className="transition hover:bg-[color-mix(in_srgb,var(--color-primary)_3%,transparent)]"
                                                                >

                                                                    {/* PRODUCTO */}

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

                                                                        {detalle.productos?.codigo_barras && (
                                                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                                Código:{" "}
                                                                                {
                                                                                    detalle.productos.codigo_barras
                                                                                }
                                                                            </p>
                                                                        )}

                                                                    </td>


                                                                    {/* CANTIDAD */}

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


                                                                    {/* PRECIO */}

                                                                    <td className="px-4 py-3 text-right">

                                                                        <span className="text-sm text-[var(--color-text)]">
                                                                            {formatearMoneda(
                                                                                Number(
                                                                                    detalle.precio_unitario
                                                                                )
                                                                            )}
                                                                        </span>

                                                                    </td>


                                                                    {/* DESCUENTO */}

                                                                    <td className="px-4 py-3 text-right">

                                                                        <span className="text-sm text-[var(--color-text)]">
                                                                            {formatearMoneda(
                                                                                Number(
                                                                                    detalle.descuento
                                                                                )
                                                                            )}
                                                                        </span>

                                                                    </td>


                                                                    {/* IMPUESTO */}

                                                                    <td className="px-4 py-3 text-right">

                                                                        <span className="text-sm text-[var(--color-text)]">
                                                                            {formatearMoneda(
                                                                                Number(
                                                                                    detalle.impuesto
                                                                                )
                                                                            )}
                                                                        </span>

                                                                    </td>


                                                                    {/* TOTAL */}

                                                                    <td className="px-4 py-3 text-right">

                                                                        <span className="text-sm font-bold text-[var(--color-danger)]">
                                                                            -
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


                                    {/* ==========================
                                        RESUMEN DEVOLUCIÓN
                                    ========================== */}

                                    <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-danger)_25%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-4">

                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                                            <span className="text-sm font-bold text-[var(--color-danger)] sm:text-base">
                                                Total reembolsado
                                            </span>

                                            <span className="text-xl font-bold text-[var(--color-danger)]">
                                                -
                                                {formatearMoneda(
                                                    Number(
                                                        devolucionSeleccionada.monto_total
                                                    )
                                                )}
                                            </span>

                                        </div>

                                    </div>


                                    {/* ==========================
                                        MOTIVO
                                    ========================== */}

                                    {devolucionSeleccionada.motivo && (

                                        <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-warning)_25%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)] p-4">

                                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-warning)]">
                                                Motivo de devolución
                                            </p>

                                            <p className="mt-2 text-sm leading-6 text-[var(--color-text)]">
                                                {
                                                    devolucionSeleccionada.motivo
                                                }
                                            </p>

                                        </div>

                                    )}


                                    {/* ==========================
                                        REFERENCIA DE VENTA
                                    ========================== */}

                                    {devolucionSeleccionada.ventas?.referencia && (

                                        <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-primary)_25%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-primary)_7%,transparent)] p-4">

                                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-primary)]">
                                                Referencia de venta
                                            </p>

                                            <p className="mt-2 break-all text-sm leading-6 text-[var(--color-text)]">
                                                {
                                                    devolucionSeleccionada
                                                        .ventas
                                                        .referencia
                                                }
                                            </p>

                                        </div>

                                    )}

                                </div>

                            )}

                        </div>


                        {/* =================================
                            FOOTER
                        ================================= */}

                        <div className="flex shrink-0 justify-end border-t border-[var(--color-border)] px-4 py-4 sm:px-6">

                            <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={
                                    cerrarDetalle
                                }
                                disabled={cargandoDetalle}
                            >
                                Cerrar
                            </Button>

                        </div>

                    </div>

                </div>

            )}


            {/* =====================================
                MODAL MENSAJE
            ===================================== */}

            <ModalMensaje
                abierto={
                    modalMensajeAbierto
                }
                tipo={
                    tipoMensaje
                }
                titulo={
                    tituloMensaje
                }
                mensaje={
                    textoMensaje
                }
                textoBoton="Aceptar"
                onCerrar={
                    cerrarModalMensaje
                }
            />

        </div>
    );
}