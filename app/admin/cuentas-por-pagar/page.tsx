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

interface UsuarioActual {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

interface CuentaPorPagar {
    id: string;
    negocio_id: string;
    compra_id: string;
    proveedor_id: string;

    monto_total: number;
    monto_pagado: number;
    monto_pendiente: number;

    estado: string;

    fecha_vencimiento: string | null;
    created_at: string;
    updated_at: string | null;

    proveedores: {
        id: string;
        nombre: string;
        telefono: string | null;
        email: string | null;
    } | null;

    compras: {
        id: string;
        total: number;
        estado: string;
        created_at: string;
    } | null;
}

interface PagoProveedor {
    id: string;
    cuenta_por_pagar_id: string;
    proveedor_id: string;
    usuario_id: string;

    monto: number;
    metodo_pago: string;

    referencia: string | null;
    notas: string | null;

    created_at: string;

    usuarios: {
        nombre: string;
    } | null;
}

type TipoMensaje =
    | "info"
    | "error"
    | "exito"
    | "confirmacion";

/*
 * ==========================================
 * COMPONENTE
 * ==========================================
 */

export default function CuentasPorPagarPage() {
    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [cuentas, setCuentas] =
        useState<CuentaPorPagar[]>([]);

    const [pagos, setPagos] =
        useState<PagoProveedor[]>([]);

    const [cargando, setCargando] =
        useState(true);

    const [error, setError] =
        useState("");

    /*
     * ==========================================
     * MODAL MENSAJE
     * ==========================================
     */

    const [modalMensaje, setModalMensaje] = useState<{
        abierto: boolean;
        tipo: TipoMensaje;
        titulo: string;
        mensaje: string;
    }>({
        abierto: false,
        tipo: "info",
        titulo: "",
        mensaje: "",
    });

    function mostrarMensaje(
        tipo: TipoMensaje,
        titulo: string,
        mensaje: string
    ) {
        setModalMensaje({
            abierto: true,
            tipo,
            titulo,
            mensaje,
        });
    }

    function cerrarMensaje() {
        setModalMensaje((prev) => ({
            ...prev,
            abierto: false,
        }));
    }

    /*
     * ==========================================
     * FILTROS
     * ==========================================
     */

    const [busqueda, setBusqueda] =
        useState("");

    const [estadoFiltro, setEstadoFiltro] =
        useState("todos");

    const [fechaDesde, setFechaDesde] =
        useState("");

    const [fechaHasta, setFechaHasta] =
        useState("");

    /*
     * ==========================================
     * MODAL DETALLE
     * ==========================================
     */

    const [cuentaSeleccionada, setCuentaSeleccionada] =
        useState<CuentaPorPagar | null>(null);

    /*
     * ==========================================
     * MODAL PAGO
     * ==========================================
     */

    const [mostrarPago, setMostrarPago] =
        useState(false);

    const [montoPago, setMontoPago] =
        useState("");

    const [metodoPago, setMetodoPago] =
        useState("efectivo");

    const [referencia, setReferencia] =
        useState("");

    const [notas, setNotas] =
        useState("");

    const [registrandoPago, setRegistrandoPago] =
        useState(false);

    /*
     * ==========================================
     * FORMATEAR MONEDA
     * ==========================================
     */

    function formatearMoneda(cantidad: number) {
        return Number(cantidad || 0).toLocaleString(
            "es-MX",
            {
                style: "currency",
                currency: "MXN",
            }
        );
    }

    /*
     * ==========================================
     * FORMATEAR FECHA
     * ==========================================
     */

    function formatearFecha(fecha: string) {
        return new Date(fecha).toLocaleString(
            "es-MX",
            {
                dateStyle: "short",
                timeStyle: "short",
            }
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
            ).padStart(
                2,
                "0"
            );

        const day =
            String(
                ahora.getDate()
            ).padStart(
                2,
                "0"
            );

        return `${year}-${month}-${day}`;
    }

    /*
     * ==========================================
     * FECHA LOCAL DE TIMESTAMP
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
            ).padStart(
                2,
                "0"
            );

        const day =
            String(
                fechaObjeto.getDate()
            ).padStart(
                2,
                "0"
            );

        return `${year}-${month}-${day}`;
    }

    /*
     * ==========================================
     * CARGAR CUENTAS
     * ==========================================
     */

    async function cargarCuentas() {
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
                const mensaje =
                    "No se encontró la información del usuario.";

                setError(mensaje);

                mostrarMensaje(
                    "error",
                    "No se pudo cargar",
                    mensaje
                );

                return;
            }

            /*
             * ==================================
             * SOLO ADMIN / ENCARGADO
             * ==================================
             */

            if (
                usuarioActual.rol !== "admin" &&
                usuarioActual.rol !== "encargado"
            ) {
                const mensaje =
                    "No tienes permisos para consultar las cuentas por pagar.";

                setError(mensaje);

                mostrarMensaje(
                    "error",
                    "Acceso denegado",
                    mensaje
                );

                return;
            }

            setUsuario(usuarioActual);

            /*
             * ==================================
             * CUENTAS
             * ==================================
             */

            const {
                data,
                error: errorCuentas,
            } = await supabase
                .from("cuentas_por_pagar")
                .select(`
                    id,
                    negocio_id,
                    compra_id,
                    proveedor_id,
                    monto_total,
                    monto_pagado,
                    monto_pendiente,
                    estado,
                    fecha_vencimiento,
                    created_at,
                    updated_at,

                    proveedores:proveedores(
                        id,
                        nombre,
                        telefono,
                        email
                    ),

                    compras:compras(
                        id,
                        total,
                        estado,
                        created_at
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

            if (errorCuentas) {
                const mensaje =
                    errorCuentas.message ||
                    "No se pudieron cargar las cuentas por pagar.";

                setError(mensaje);

                mostrarMensaje(
                    "error",
                    "Error al cargar cuentas",
                    mensaje
                );

                return;
            }

            /*
             * ==================================
             * PAGOS
             * ==================================
             */

            const {
                data: dataPagos,
                error: errorPagos,
            } = await supabase
                .from("pagos_proveedores")
                .select(`
                    id,
                    cuenta_por_pagar_id,
                    proveedor_id,
                    usuario_id,
                    monto,
                    metodo_pago,
                    referencia,
                    notas,
                    created_at,

                    usuarios:usuarios(
                        nombre
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

            if (errorPagos) {
                const mensaje =
                    errorPagos.message ||
                    "No se pudieron cargar los pagos a proveedores.";

                setError(mensaje);

                mostrarMensaje(
                    "error",
                    "Error al cargar pagos",
                    mensaje
                );

                return;
            }

            setCuentas(
                (data as unknown as CuentaPorPagar[]) ?? []
            );

            setPagos(
                (dataPagos as unknown as PagoProveedor[]) ?? []
            );
        } catch {
            const mensaje =
                "Ocurrió un error al cargar las cuentas por pagar.";

            setError(mensaje);

            mostrarMensaje(
                "error",
                "Error inesperado",
                mensaje
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
        cargarCuentas();
    }, []);

    /*
     * ==========================================
     * CUENTAS FILTRADAS
     * ==========================================
     */

    const cuentasFiltradas =
        useMemo(() => {
            return cuentas.filter(
                (cuenta) => {
                    if (
                        estadoFiltro !== "todos" &&
                        cuenta.estado !== estadoFiltro
                    ) {
                        return false;
                    }

                    const fechaCuenta =
                        obtenerFechaLocalDeFecha(
                            cuenta.created_at
                        );

                    if (
                        fechaDesde &&
                        fechaCuenta < fechaDesde
                    ) {
                        return false;
                    }

                    if (
                        fechaHasta &&
                        fechaCuenta > fechaHasta
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
                        cuenta.id
                            .slice(0, 8)
                            .toLowerCase();

                    const compraCorta =
                        cuenta.compra_id
                            .slice(0, 8)
                            .toLowerCase();

                    const proveedor =
                        cuenta.proveedores?.nombre
                            ?.toLowerCase() ?? "";

                    const telefono =
                        cuenta.proveedores?.telefono
                            ?.toLowerCase() ?? "";

                    const email =
                        cuenta.proveedores?.email
                            ?.toLowerCase() ?? "";

                    return (
                        cuenta.id
                            .toLowerCase()
                            .includes(texto) ||

                        idCorto.includes(texto) ||

                        cuenta.compra_id
                            .toLowerCase()
                            .includes(texto) ||

                        compraCorta.includes(texto) ||

                        proveedor.includes(texto) ||

                        telefono.includes(texto) ||

                        email.includes(texto)
                    );
                }
            );
        }, [
            cuentas,
            busqueda,
            estadoFiltro,
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
            let totalCuentas = 0;
            let totalPorPagar = 0;
            let totalPagado = 0;
            let totalPendiente = 0;

            let cuentasPendientes = 0;
            let cuentasParciales = 0;
            let cuentasPagadas = 0;

            cuentasFiltradas.forEach(
                (cuenta) => {
                    const total =
                        Number(
                            cuenta.monto_total
                        ) || 0;

                    const pagado =
                        Number(
                            cuenta.monto_pagado
                        ) || 0;

                    const pendiente =
                        Number(
                            cuenta.monto_pendiente
                        ) || 0;

                    totalCuentas++;

                    totalPorPagar += total;
                    totalPagado += pagado;
                    totalPendiente += pendiente;

                    if (
                        cuenta.estado === "pendiente"
                    ) {
                        cuentasPendientes++;
                    }

                    if (
                        cuenta.estado === "parcial"
                    ) {
                        cuentasParciales++;
                    }

                    if (
                        cuenta.estado === "pagada"
                    ) {
                        cuentasPagadas++;
                    }
                }
            );

            return {
                totalCuentas,
                totalPorPagar,
                totalPagado,
                totalPendiente,
                cuentasPendientes,
                cuentasParciales,
                cuentasPagadas,
            };
        }, [
            cuentasFiltradas,
        ]);

    /*
     * ==========================================
     * ESTADO DE CUENTA
     * ==========================================
     */

    function obtenerEstadoCuenta(
        estado: string
    ) {
        switch (estado) {
            case "pendiente":
                return {
                    texto: "Pendiente",
                    clase:
                        "border border-[color-mix(in_srgb,var(--color-warning)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_10%,var(--color-surface))] text-[var(--color-warning)]",
                };

            case "parcial":
                return {
                    texto: "Pago parcial",
                    clase:
                        "border border-[color-mix(in_srgb,var(--color-primary)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] text-[var(--color-primary)]",
                };

            case "pagada":
                return {
                    texto: "Pagada",
                    clase:
                        "border border-[color-mix(in_srgb,var(--color-success)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-surface))] text-[var(--color-success)]",
                };

            case "cancelada":
                return {
                    texto: "Cancelada",
                    clase:
                        "border border-[color-mix(in_srgb,var(--color-danger)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] text-[var(--color-danger)]",
                };

            default:
                return {
                    texto: estado,
                    clase:
                        "border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-secondary)]",
                };
        }
    }

    /*
     * ==========================================
     * MÉTODO DE PAGO
     * ==========================================
     */

    function obtenerNombreMetodo(
        metodo: string
    ) {
        switch (metodo) {
            case "efectivo":
                return "Efectivo";

            case "tarjeta":
                return "Tarjeta";

            case "transferencia":
                return "Transferencia";

            case "cheque":
                return "Cheque";

            case "otro":
                return "Otro";

            default:
                return metodo || "Otro";
        }
    }

    /*
     * ==========================================
     * PAGOS DE CUENTA
     * ==========================================
     */

    function obtenerPagosCuenta(
        cuentaId: string
    ) {
        return pagos.filter(
            (pago) =>
                pago.cuenta_por_pagar_id ===
                cuentaId
        );
    }

    /*
     * ==========================================
     * ABRIR DETALLE
     * ==========================================
     */

    function abrirDetalle(
        cuenta: CuentaPorPagar
    ) {
        setCuentaSeleccionada(cuenta);
    }

    /*
     * ==========================================
     * CERRAR DETALLE
     * ==========================================
     */

    function cerrarDetalle() {
        setCuentaSeleccionada(null);
    }

    /*
     * ==========================================
     * ABRIR MODAL PAGO
     * ==========================================
     */

    function abrirModalPago(
        cuenta: CuentaPorPagar
    ) {
        setCuentaSeleccionada(cuenta);

        setMontoPago(
            String(
                Number(
                    cuenta.monto_pendiente
                )
            )
        );

        setMetodoPago("efectivo");

        setReferencia("");
        setNotas("");

        setMostrarPago(true);
    }

    /*
     * ==========================================
     * CERRAR MODAL PAGO
     * ==========================================
     */

    function cerrarModalPago() {
        if (registrandoPago) {
            return;
        }

        setMostrarPago(false);

        setMontoPago("");
        setMetodoPago("efectivo");
        setReferencia("");
        setNotas("");
    }

    /*
     * ==========================================
     * REGISTRAR PAGO
     * ==========================================
     */

    async function registrarPago() {
        if (!cuentaSeleccionada) {
            return;
        }

        const monto =
            Number(montoPago);

        if (
            !Number.isFinite(monto) ||
            monto <= 0
        ) {
            mostrarMensaje(
                "info",
                "Monto inválido",
                "El monto del pago debe ser mayor a cero."
            );

            return;
        }

        const pendiente =
            Number(
                cuentaSeleccionada.monto_pendiente
            ) || 0;

        if (monto > pendiente) {
            mostrarMensaje(
                "info",
                "Monto excedido",
                `El pago no puede ser mayor al saldo pendiente de ${formatearMoneda(pendiente)}.`
            );

            return;
        }

        if (!metodoPago) {
            mostrarMensaje(
                "info",
                "Método de pago",
                "Selecciona un método de pago."
            );

            return;
        }

        setRegistrandoPago(true);

        try {
            const {
                data,
                error: errorRPC,
            } = await supabase.rpc(
                "registrar_pago_proveedor",
                {
                    p_cuenta_por_pagar_id:
                        cuentaSeleccionada.id,

                    p_monto:
                        monto,

                    p_metodo_pago:
                        metodoPago,

                    p_referencia:
                        referencia.trim() ||
                        null,

                    p_notas:
                        notas.trim() ||
                        null,
                }
            );

            if (errorRPC) {
                throw new Error(
                    errorRPC.message ||
                    "No se pudo registrar el pago."
                );
            }

            if (!data) {
                throw new Error(
                    "No se recibió el identificador del pago."
                );
            }

            setMostrarPago(false);

            setMontoPago("");
            setMetodoPago("efectivo");
            setReferencia("");
            setNotas("");

            await cargarCuentas();

            mostrarMensaje(
                "exito",
                "Pago registrado",
                "El pago al proveedor se registró correctamente."
            );

            setCuentaSeleccionada(null);
        } catch (error) {
            mostrarMensaje(
                "error",
                "No se pudo registrar",
                error instanceof Error
                    ? error.message
                    : "No se pudo registrar el pago."
            );
        } finally {
            setRegistrandoPago(false);
        }
    }

    /*
     * ==========================================
     * LIMPIAR FILTROS
     * ==========================================
     */

    function limpiarFiltros() {
        setBusqueda("");
        setEstadoFiltro("todos");
        setFechaDesde("");
        setFechaHasta("");
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

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                    <div>

                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                            Finanzas
                        </p>

                        <h1 className="mt-1 text-2xl font-bold text-[var(--color-text)] sm:text-3xl">
                            Cuentas por pagar
                        </h1>

                        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
                            Consulta las deudas con proveedores y registra sus pagos.
                        </p>

                    </div>

                    {usuario && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={cargarCuentas}
                            disabled={cargando}
                            className="w-full sm:w-auto"
                        >
                            {cargando
                                ? "Actualizando..."
                                : "↻ Actualizar"}
                        </Button>
                    )}

                </div>

                {usuario && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">

                        <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]">
                            {usuario.nombre}
                        </span>

                        <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 text-xs font-semibold capitalize text-[var(--color-text-secondary)]">
                            {usuario.rol}
                        </span>

                    </div>
                )}

            </div>

            {/* =====================================
                ERROR
            ===================================== */}

            {error && (
                <Card className="border-[color-mix(in_srgb,var(--color-danger)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-danger)_6%,var(--color-surface))] p-4">

                    <div className="flex items-start gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-surface))] text-lg">
                            ⚠️
                        </div>

                        <div className="min-w-0 flex-1">

                            <p className="text-sm font-semibold text-[var(--color-danger)]">
                                No fue posible completar la operación
                            </p>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                {error}
                            </p>

                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setError("")
                            }
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-[var(--color-text-secondary)] transition hover:bg-[var(--color-background)] hover:text-[var(--color-text)]"
                            aria-label="Cerrar mensaje"
                        >
                            ×
                        </button>

                    </div>

                </Card>
            )}

            {/* =====================================
                RESUMEN
            ===================================== */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

                <Card className="p-5">

                    <div className="flex items-start justify-between gap-4">

                        <div>

                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Cuentas
                            </p>

                            <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                                {resumen.totalCuentas}
                            </p>

                        </div>

                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] text-xl">
                            📋
                        </div>

                    </div>

                </Card>

                <Card className="p-5">

                    <div className="flex items-start justify-between gap-4">

                        <div className="min-w-0">

                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Total comprado
                            </p>

                            <p className="mt-2 truncate text-2xl font-bold text-[var(--color-text)]">
                                {formatearMoneda(
                                    resumen.totalPorPagar
                                )}
                            </p>

                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-secondary)_10%,var(--color-surface))] text-xl">
                            🧾
                        </div>

                    </div>

                </Card>

                <Card className="p-5">

                    <div className="flex items-start justify-between gap-4">

                        <div className="min-w-0">

                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Pagado
                            </p>

                            <p className="mt-2 truncate text-2xl font-bold text-[var(--color-success)]">
                                {formatearMoneda(
                                    resumen.totalPagado
                                )}
                            </p>

                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-surface))] text-xl">
                            ✅
                        </div>

                    </div>

                </Card>

                <Card className="p-5">

                    <div className="flex items-start justify-between gap-4">

                        <div className="min-w-0">

                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Pendiente
                            </p>

                            <p className="mt-2 truncate text-2xl font-bold text-[var(--color-danger)]">
                                {formatearMoneda(
                                    resumen.totalPendiente
                                )}
                            </p>

                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] text-xl">
                            💳
                        </div>

                    </div>

                </Card>

                <Card className="p-5">

                    <div className="flex items-start justify-between gap-4">

                        <div>

                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Estado
                            </p>

                            <p className="mt-2 text-sm font-bold text-[var(--color-text)]">
                                {resumen.cuentasPendientes} pendientes
                            </p>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                {resumen.cuentasParciales} parciales ·{" "}
                                {resumen.cuentasPagadas} pagadas
                            </p>

                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-warning)_10%,var(--color-surface))] text-xl">
                            📊
                        </div>

                    </div>

                </Card>

            </div>

            {/* =====================================
                FILTROS
            ===================================== */}

            <Card className="p-5">

                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                    <div>

                        <h2 className="text-base font-bold text-[var(--color-text)]">
                            Buscar cuentas
                        </h2>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Filtra por proveedor, folio de cuenta, compra o estado.
                        </p>

                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        onClick={limpiarFiltros}
                        className="w-full sm:w-auto"
                    >
                        Limpiar filtros
                    </Button>

                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

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
                            placeholder="Proveedor, folio de cuenta, compra..."
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
                        />

                    </div>

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
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
                        >

                            <option value="todos">
                                Todos
                            </option>

                            <option value="pendiente">
                                Pendientes
                            </option>

                            <option value="parcial">
                                Pagos parciales
                            </option>

                            <option value="pagada">
                                Pagadas
                            </option>

                            <option value="cancelada">
                                Canceladas
                            </option>

                        </select>

                    </div>

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
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
                        />

                    </div>

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
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
                        />

                    </div>

                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">

                    {estadoFiltro !== "todos" && (
                        <span className="rounded-full border border-[color-mix(in_srgb,var(--color-primary)_20%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-surface))] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                            Estado:{" "}
                            {
                                obtenerEstadoCuenta(
                                    estadoFiltro
                                ).texto
                            }
                        </span>
                    )}

                    {fechaDesde && (
                        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                            Desde: {fechaDesde}
                        </span>
                    )}

                    {fechaHasta && (
                        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                            Hasta: {fechaHasta}
                        </span>
                    )}

                    {busqueda && (
                        <span className="max-w-full truncate rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                            Buscar: {busqueda}
                        </span>
                    )}

                    {!busqueda &&
                        estadoFiltro === "todos" &&
                        !fechaDesde &&
                        !fechaHasta && (
                            <span className="text-xs text-[var(--color-text-secondary)]">
                                Sin filtros activos
                            </span>
                        )}

                </div>

            </Card>

            {/* =====================================
                TABLA
            ===================================== */}

            <Card className="overflow-hidden p-0">

                <div className="border-b border-[var(--color-border)] px-5 py-4">

                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                            <h2 className="text-base font-bold text-[var(--color-text)]">
                                Cuentas por pagar
                            </h2>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Consulta y administra las cuentas pendientes con proveedores.
                            </p>

                        </div>

                        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                            {cuentasFiltradas.length} resultado
                            {cuentasFiltradas.length === 1
                                ? ""
                                : "s"}
                        </span>

                    </div>

                </div>

                {cargando ? (

                    <div className="flex min-h-64 items-center justify-center p-8">

                        <div className="text-center">

                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-surface))] text-xl">
                                ⏳
                            </div>

                            <p className="text-sm font-semibold text-[var(--color-text)]">
                                Cargando cuentas...
                            </p>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Obteniendo saldos y pagos registrados.
                            </p>

                        </div>

                    </div>

                ) : cuentasFiltradas.length === 0 ? (

                    <div className="p-10 text-center">

                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background)] text-2xl">
                            💳
                        </div>

                        <p className="mt-4 text-base font-semibold text-[var(--color-text)]">
                            No se encontraron cuentas
                        </p>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Prueba cambiando los filtros de búsqueda.
                        </p>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[1250px]">

                            <thead>

                                <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Cuenta
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Proveedor
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Compra
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Fecha
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Total
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Pagado
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Pendiente
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

                                {cuentasFiltradas.map(
                                    (cuenta) => {
                                        const estado =
                                            obtenerEstadoCuenta(
                                                cuenta.estado
                                            );

                                        const pendiente =
                                            Number(
                                                cuenta.monto_pendiente
                                            ) || 0;

                                        const pagosCuenta =
                                            obtenerPagosCuenta(
                                                cuenta.id
                                            );

                                        return (
                                            <tr
                                                key={cuenta.id}
                                                className="transition hover:bg-[var(--color-background)]"
                                            >

                                                <td className="px-5 py-4">

                                                    <p className="font-semibold text-[var(--color-text)]">
                                                        #
                                                        {cuenta.id
                                                            .slice(
                                                                0,
                                                                8
                                                            )
                                                            .toUpperCase()}
                                                    </p>

                                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                        {pagosCuenta.length}{" "}
                                                        pago
                                                        {pagosCuenta.length === 1
                                                            ? ""
                                                            : "s"}
                                                    </p>

                                                </td>

                                                <td className="px-5 py-4">

                                                    <div>

                                                        <p className="text-sm font-semibold text-[var(--color-text)]">
                                                            {cuenta.proveedores?.nombre ??
                                                                "Sin proveedor"}
                                                        </p>

                                                        {cuenta.proveedores?.telefono && (
                                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                {
                                                                    cuenta.proveedores.telefono
                                                                }
                                                            </p>
                                                        )}

                                                    </div>

                                                </td>

                                                <td className="px-5 py-4">

                                                    <p className="font-semibold text-[var(--color-text)]">
                                                        #
                                                        {cuenta.compra_id
                                                            .slice(
                                                                0,
                                                                8
                                                            )
                                                            .toUpperCase()}
                                                    </p>

                                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                        Compra{" "}
                                                        {cuenta.compras?.estado ??
                                                            ""}
                                                    </p>

                                                </td>

                                                <td className="px-5 py-4">

                                                    <p className="text-sm text-[var(--color-text)]">
                                                        {formatearFecha(
                                                            cuenta.created_at
                                                        )}
                                                    </p>

                                                    {cuenta.fecha_vencimiento && (
                                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                            Vence:{" "}
                                                            {new Date(
                                                                cuenta.fecha_vencimiento
                                                            ).toLocaleDateString(
                                                                "es-MX"
                                                            )}
                                                        </p>
                                                    )}

                                                </td>

                                                <td className="px-5 py-4 text-right">

                                                    <p className="text-sm font-bold text-[var(--color-text)]">
                                                        {formatearMoneda(
                                                            Number(
                                                                cuenta.monto_total
                                                            )
                                                        )}
                                                    </p>

                                                </td>

                                                <td className="px-5 py-4 text-right">

                                                    <p className="text-sm font-bold text-[var(--color-success)]">
                                                        {formatearMoneda(
                                                            Number(
                                                                cuenta.monto_pagado
                                                            )
                                                        )}
                                                    </p>

                                                </td>

                                                <td className="px-5 py-4 text-right">

                                                    <p
                                                        className={`text-sm font-bold ${pendiente > 0
                                                            ? "text-[var(--color-danger)]"
                                                            : "text-[var(--color-success)]"
                                                            }`}
                                                    >
                                                        {formatearMoneda(
                                                            pendiente
                                                        )}
                                                    </p>

                                                </td>

                                                <td className="px-5 py-4 text-center">

                                                    <span
                                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${estado.clase}`}
                                                    >
                                                        {estado.texto}
                                                    </span>

                                                </td>

                                                <td className="px-5 py-4 text-right">

                                                    <div className="flex justify-end gap-2">

                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            size="small"
                                                            onClick={() =>
                                                                abrirDetalle(
                                                                    cuenta
                                                                )
                                                            }
                                                        >
                                                            👁️ Detalle
                                                        </Button>

                                                        {pendiente > 0 &&
                                                            cuenta.estado !== "cancelada" && (
                                                                <Button
                                                                    type="button"
                                                                    variant="primary"
                                                                    size="small"
                                                                    onClick={() =>
                                                                        abrirModalPago(
                                                                            cuenta
                                                                        )
                                                                    }
                                                                >
                                                                    💵 Pagar
                                                                </Button>
                                                            )}

                                                    </div>

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

            {cuentaSeleccionada &&
                !mostrarPago && (

                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">

                        <div
                            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
                            role="dialog"
                            aria-modal="true"
                        >

                            <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-5 sm:px-6">

                                <div className="flex items-start justify-between gap-4">

                                    <div className="min-w-0">

                                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Detalle de cuenta por pagar
                                        </p>

                                        <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">
                                            #
                                            {cuentaSeleccionada.id
                                                .slice(
                                                    0,
                                                    8
                                                )
                                                .toUpperCase()}
                                        </h2>

                                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                            Creada el{" "}
                                            {formatearFecha(
                                                cuentaSeleccionada.created_at
                                            )}
                                        </p>

                                    </div>

                                    <button
                                        type="button"
                                        onClick={
                                            cerrarDetalle
                                        }
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-background)] hover:text-[var(--color-text)]"
                                        aria-label="Cerrar"
                                    >
                                        ✕
                                    </button>

                                </div>

                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">

                                <div className="space-y-5">

                                    {/* PROVEEDOR */}

                                    <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-primary)_20%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-primary)_6%,var(--color-surface))] p-4">

                                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                                            Proveedor
                                        </p>

                                        <p className="mt-2 text-base font-bold text-[var(--color-text)]">
                                            {cuentaSeleccionada.proveedores?.nombre ??
                                                "Sin proveedor"}
                                        </p>

                                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-text-secondary)]">

                                            {cuentaSeleccionada.proveedores?.telefono && (
                                                <span>
                                                    📱{" "}
                                                    {
                                                        cuentaSeleccionada.proveedores.telefono
                                                    }
                                                </span>
                                            )}

                                            {cuentaSeleccionada.proveedores?.email && (
                                                <span className="break-all">
                                                    ✉️{" "}
                                                    {
                                                        cuentaSeleccionada.proveedores.email
                                                    }
                                                </span>
                                            )}

                                        </div>

                                    </div>

                                    {/* INFORMACIÓN GENERAL */}

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Compra
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                #
                                                {cuentaSeleccionada.compra_id
                                                    .slice(
                                                        0,
                                                        8
                                                    )
                                                    .toUpperCase()}
                                            </p>

                                        </div>

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Estado
                                            </p>

                                            <div className="mt-2">

                                                <span
                                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${obtenerEstadoCuenta(
                                                        cuentaSeleccionada.estado
                                                    ).clase
                                                        }`}
                                                >
                                                    {
                                                        obtenerEstadoCuenta(
                                                            cuentaSeleccionada.estado
                                                        ).texto
                                                    }
                                                </span>

                                            </div>

                                        </div>

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Fecha de creación
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                                {formatearFecha(
                                                    cuentaSeleccionada.created_at
                                                )}
                                            </p>

                                        </div>

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">

                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                Vencimiento
                                            </p>

                                            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">

                                                {cuentaSeleccionada.fecha_vencimiento
                                                    ? new Date(
                                                        cuentaSeleccionada.fecha_vencimiento
                                                    ).toLocaleDateString(
                                                        "es-MX"
                                                    )
                                                    : "Sin fecha"}

                                            </p>

                                        </div>

                                    </div>

                                    {/* RESUMEN FINANCIERO */}

                                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">

                                        <div className="space-y-3">

                                            <div className="flex items-center justify-between gap-4">

                                                <span className="text-sm text-[var(--color-text-secondary)]">
                                                    Monto total
                                                </span>

                                                <span className="text-sm font-bold text-[var(--color-text)]">
                                                    {formatearMoneda(
                                                        Number(
                                                            cuentaSeleccionada.monto_total
                                                        )
                                                    )}
                                                </span>

                                            </div>

                                            <div className="flex items-center justify-between gap-4">

                                                <span className="text-sm text-[var(--color-text-secondary)]">
                                                    Pagado
                                                </span>

                                                <span className="text-sm font-bold text-[var(--color-success)]">
                                                    {formatearMoneda(
                                                        Number(
                                                            cuentaSeleccionada.monto_pagado
                                                        )
                                                    )}
                                                </span>

                                            </div>

                                            <div className="border-t border-[var(--color-border)] pt-3">

                                                <div className="flex items-center justify-between gap-4">

                                                    <span className="text-base font-bold text-[var(--color-text)]">
                                                        Saldo pendiente
                                                    </span>

                                                    <span className="text-xl font-bold text-[var(--color-danger)]">
                                                        {formatearMoneda(
                                                            Number(
                                                                cuentaSeleccionada.monto_pendiente
                                                            )
                                                        )}
                                                    </span>

                                                </div>

                                            </div>

                                        </div>

                                    </div>

                                    {/* HISTORIAL DE PAGOS */}

                                    <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">

                                        <div className="border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3">

                                            <div className="flex items-center justify-between gap-3">

                                                <p className="text-sm font-bold text-[var(--color-text)]">
                                                    Historial de pagos
                                                </p>

                                                <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                                                    {
                                                        obtenerPagosCuenta(
                                                            cuentaSeleccionada.id
                                                        ).length
                                                    }
                                                </span>

                                            </div>

                                        </div>

                                        <div className="divide-y divide-[var(--color-border)]">

                                            {obtenerPagosCuenta(
                                                cuentaSeleccionada.id
                                            ).length === 0 ? (

                                                <div className="p-5 text-center">

                                                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-background)]">
                                                        💳
                                                    </div>

                                                    <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                                                        No hay pagos registrados.
                                                    </p>

                                                </div>

                                            ) : (

                                                obtenerPagosCuenta(
                                                    cuentaSeleccionada.id
                                                ).map(
                                                    (pago) => (
                                                        <div
                                                            key={
                                                                pago.id
                                                            }
                                                            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                                                        >

                                                            <div className="min-w-0">

                                                                <div className="flex flex-wrap items-center gap-2">

                                                                    <p className="text-sm font-semibold text-[var(--color-text)]">
                                                                        {
                                                                            obtenerNombreMetodo(
                                                                                pago.metodo_pago
                                                                            )
                                                                        }
                                                                    </p>

                                                                    <span className="rounded-full bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-surface))] px-2 py-1 text-xs font-semibold text-[var(--color-success)]">
                                                                        Registrado
                                                                    </span>

                                                                </div>

                                                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                    {formatearFecha(
                                                                        pago.created_at
                                                                    )}
                                                                </p>

                                                                {pago.usuarios?.nombre && (
                                                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                        Registrado por:{" "}
                                                                        {
                                                                            pago.usuarios.nombre
                                                                        }
                                                                    </p>
                                                                )}

                                                                {pago.referencia && (
                                                                    <p className="mt-1 break-all text-xs text-[var(--color-text-secondary)]">
                                                                        Ref:{" "}
                                                                        {
                                                                            pago.referencia
                                                                        }
                                                                    </p>
                                                                )}

                                                                {pago.notas && (
                                                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                        {
                                                                            pago.notas
                                                                        }
                                                                    </p>
                                                                )}

                                                            </div>

                                                            <p className="shrink-0 text-base font-bold text-[var(--color-success)]">
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

                                </div>

                            </div>

                            <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-background)] px-5 py-4 sm:px-6">

                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={
                                            cerrarDetalle
                                        }
                                        className="w-full sm:w-auto"
                                    >
                                        Cerrar
                                    </Button>

                                    {Number(
                                        cuentaSeleccionada.monto_pendiente
                                    ) > 0 &&
                                        cuentaSeleccionada.estado !== "cancelada" && (

                                            <Button
                                                type="button"
                                                variant="primary"
                                                onClick={() =>
                                                    abrirModalPago(
                                                        cuentaSeleccionada
                                                    )
                                                }
                                                className="w-full sm:w-auto"
                                            >
                                                💵 Registrar pago
                                            </Button>
                                        )}

                                </div>

                            </div>

                        </div>

                    </div>
                )}

            {/* =====================================
                MODAL REGISTRAR PAGO
            ===================================== */}

            {mostrarPago &&
                cuentaSeleccionada && (

                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">

                        <div
                            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
                            role="dialog"
                            aria-modal="true"
                        >

                            <div className="shrink-0 border-b border-[var(--color-border)] px-5 py-5 sm:px-6">

                                <div className="flex items-start justify-between gap-4">

                                    <div className="min-w-0">

                                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Registrar pago
                                        </p>

                                        <h2 className="mt-1 truncate text-xl font-bold text-[var(--color-text)]">
                                            {cuentaSeleccionada.proveedores?.nombre ??
                                                "Proveedor"}
                                        </h2>

                                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                            Saldo pendiente:{" "}
                                            <span className="font-bold text-[var(--color-danger)]">
                                                {formatearMoneda(
                                                    Number(
                                                        cuentaSeleccionada.monto_pendiente
                                                    )
                                                )}
                                            </span>
                                        </p>

                                    </div>

                                    <button
                                        type="button"
                                        onClick={
                                            cerrarModalPago
                                        }
                                        disabled={
                                            registrandoPago
                                        }
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-background)] hover:text-[var(--color-text)] disabled:opacity-50"
                                        aria-label="Cerrar"
                                    >
                                        ✕
                                    </button>

                                </div>

                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">

                                <div className="space-y-5">

                                    {/* MONTO */}

                                    <div>

                                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                                            Monto del pago
                                        </label>

                                        <div className="relative">

                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-secondary)]">
                                                $
                                            </span>

                                            <input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={montoPago}
                                                onChange={(e) =>
                                                    setMontoPago(
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-8 pr-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
                                                placeholder="0.00"
                                                disabled={
                                                    registrandoPago
                                                }
                                            />

                                        </div>

                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                            Máximo:{" "}
                                            {formatearMoneda(
                                                Number(
                                                    cuentaSeleccionada.monto_pendiente
                                                )
                                            )}
                                        </p>

                                    </div>

                                    {/* MÉTODO */}

                                    <div>

                                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                                            Método de pago
                                        </label>

                                        <select
                                            value={metodoPago}
                                            onChange={(e) =>
                                                setMetodoPago(
                                                    e.target.value
                                                )
                                            }
                                            disabled={
                                                registrandoPago
                                            }
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
                                        >

                                            <option value="efectivo">
                                                Efectivo
                                            </option>

                                            <option value="tarjeta">
                                                Tarjeta
                                            </option>

                                            <option value="transferencia">
                                                Transferencia
                                            </option>

                                            <option value="cheque">
                                                Cheque
                                            </option>

                                            <option value="otro">
                                                Otro
                                            </option>

                                        </select>

                                    </div>

                                    {/* REFERENCIA */}

                                    <div>

                                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                                            Referencia
                                            <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">
                                                opcional
                                            </span>
                                        </label>

                                        <input
                                            type="text"
                                            value={referencia}
                                            onChange={(e) =>
                                                setReferencia(
                                                    e.target.value
                                                )
                                            }
                                            disabled={
                                                registrandoPago
                                            }
                                            placeholder="Folio, número de transferencia..."
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
                                        />

                                    </div>

                                    {/* NOTAS */}

                                    <div>

                                        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                                            Notas
                                            <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">
                                                opcional
                                            </span>
                                        </label>

                                        <textarea
                                            value={notas}
                                            onChange={(e) =>
                                                setNotas(
                                                    e.target.value
                                                )
                                            }
                                            disabled={
                                                registrandoPago
                                            }
                                            rows={3}
                                            placeholder="Observaciones del pago..."
                                            className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
                                        />

                                    </div>

                                </div>

                            </div>

                            <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-background)] px-5 py-4 sm:px-6">

                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={
                                            cerrarModalPago
                                        }
                                        disabled={
                                            registrandoPago
                                        }
                                        className="w-full sm:w-auto"
                                    >
                                        Cancelar
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="primary"
                                        onClick={
                                            registrarPago
                                        }
                                        disabled={
                                            registrandoPago
                                        }
                                        className="w-full sm:w-auto"
                                    >
                                        {registrandoPago
                                            ? "Registrando..."
                                            : "💵 Confirmar pago"}
                                    </Button>

                                </div>

                            </div>

                        </div>

                    </div>
                )}

            {/* =====================================
                MODAL MENSAJE
            ===================================== */}

            <ModalMensaje
                abierto={modalMensaje.abierto}
                tipo={modalMensaje.tipo}
                titulo={modalMensaje.titulo}
                mensaje={modalMensaje.mensaje}
                onCerrar={cerrarMensaje}
            />

        </div>
    );
}