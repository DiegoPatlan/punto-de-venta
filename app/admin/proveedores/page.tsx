"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ModalMensaje from "../../components/ModalMensaje";
import { supabase } from "../../../lib/supabase";
import { obtenerUsuarioActual } from "../../../lib/auth/roleGuard";

/*
 * =========================================================
 * TIPOS
 * =========================================================
 */

interface Proveedor {
    id: string;
    negocio_id: string;
    nombre: string;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    rfc: string | null;
    contacto: string | null;
    activo: boolean;
    created_at: string;
}

interface UsuarioActual {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

interface FormularioProveedor {
    nombre: string;
    telefono: string;
    email: string;
    direccion: string;
    rfc: string;
    contacto: string;
}

interface Compra {
    id: string;
    negocio_id: string;
    sucursal_id: string;
    proveedor_id: string;
    usuario_id: string;
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
    estado: string;
    referencia: string | null;
    notas: string | null;
    created_at: string;
    sucursales?: {
        nombre: string;
    } | null;
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
    notas: string | null;
    created_at: string;
    updated_at: string;
}

interface PagoProveedor {
    id: string;
    negocio_id: string;
    cuenta_por_pagar_id: string;
    proveedor_id: string;
    usuario_id: string;
    monto: number;
    metodo_pago: string;
    referencia: string | null;
    notas: string | null;
    created_at: string;
}

type TipoMensaje =
    | "exito"
    | "error"
    | "confirmacion"
    | "info";

/*
 * =========================================================
 * COMPONENTE
 * =========================================================
 */

export default function ProveedoresPage() {
    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [proveedores, setProveedores] =
        useState<Proveedor[]>([]);

    const [cargando, setCargando] =
        useState(true);

    const [guardando, setGuardando] =
        useState(false);

    const [busqueda, setBusqueda] =
        useState("");

    const [filtroEstado, setFiltroEstado] =
        useState<
            "todos" | "activos" | "inactivos"
        >("todos");

    const [modalAbierto, setModalAbierto] =
        useState(false);

    const [modoFormulario, setModoFormulario] =
        useState<"crear" | "editar">("crear");

    const [proveedorSeleccionado, setProveedorSeleccionado] =
        useState<Proveedor | null>(null);

    const [formulario, setFormulario] =
        useState<FormularioProveedor>({
            nombre: "",
            telefono: "",
            email: "",
            direccion: "",
            rfc: "",
            contacto: "",
        });

    const [detalleAbierto, setDetalleAbierto] =
        useState(false);

    const [proveedorDetalle, setProveedorDetalle] =
        useState<Proveedor | null>(null);

    const [cargandoDetalle, setCargandoDetalle] =
        useState(false);

    const [comprasProveedor, setComprasProveedor] =
        useState<Compra[]>([]);

    const [cuentasProveedor, setCuentasProveedor] =
        useState<CuentaPorPagar[]>([]);

    const [pagosProveedor, setPagosProveedor] =
        useState<PagoProveedor[]>([]);

    const [modalPagoAbierto, setModalPagoAbierto] =
        useState(false);

    const [cuentaPagoSeleccionada, setCuentaPagoSeleccionada] =
        useState<CuentaPorPagar | null>(null);

    const [pagando, setPagando] =
        useState(false);

    const [formularioPago, setFormularioPago] =
        useState({
            monto: "",
            metodo_pago: "efectivo",
            referencia: "",
            notas: "",
        });

    const [modalMensajeAbierto, setModalMensajeAbierto] =
        useState(false);

    const [tipoMensaje, setTipoMensaje] =
        useState<TipoMensaje>("info");

    const [tituloMensaje, setTituloMensaje] =
        useState("");

    const [textoMensaje, setTextoMensaje] =
        useState("");

    const [proveedorEstadoPendiente, setProveedorEstadoPendiente] =
        useState<Proveedor | null>(null);

    /*
     * =========================================================
     * FORMATEADORES
     * =========================================================
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

    function formatearFechaSoloFecha(
        fecha: string | null
    ) {
        if (!fecha) {
            return "Sin vencimiento";
        }

        return new Date(
            `${fecha}T00:00:00`
        ).toLocaleDateString(
            "es-MX",
            {
                dateStyle: "medium",
            }
        );
    }

    function formatearMoneda(
        valor: number | string | null | undefined
    ) {
        return new Intl.NumberFormat(
            "es-MX",
            {
                style: "currency",
                currency: "MXN",
            }
        ).format(
            Number(valor) || 0
        );
    }

    /*
     * =========================================================
     * MENSAJES
     * =========================================================
     */

    function mostrarMensaje(
        tipo: TipoMensaje,
        mensaje: string,
        titulo?: string
    ) {
        setTipoMensaje(tipo);

        setTituloMensaje(
            titulo ??
            (
                tipo === "exito"
                    ? "Operación exitosa"
                    : tipo === "error"
                        ? "Ocurrió un error"
                        : tipo === "confirmacion"
                            ? "Confirmar acción"
                            : "Información"
            )
        );

        setTextoMensaje(mensaje);
        setModalMensajeAbierto(true);
    }

    function cerrarModalMensaje() {
        setModalMensajeAbierto(false);
        setProveedorEstadoPendiente(null);
    }

    /*
     * =========================================================
     * CARGAR PROVEEDORES
     * =========================================================
     */

    async function cargarProveedores() {
        setCargando(true);

        try {
            const usuarioActual =
                (await obtenerUsuarioActual()) as
                | UsuarioActual
                | null;

            if (
                !usuarioActual?.id ||
                !usuarioActual.negocio_id
            ) {
                mostrarMensaje(
                    "error",
                    "No se encontró la información del usuario o del negocio.",
                    "Usuario no disponible"
                );
                return;
            }

            if (
                usuarioActual.rol !== "admin"
            ) {
                mostrarMensaje(
                    "error",
                    "No tienes permisos para administrar proveedores.",
                    "Acceso denegado"
                );
                return;
            }

            setUsuario(usuarioActual);

            const {
                data,
                error: errorProveedores,
            } = await supabase
                .from("proveedores")
                .select(`
                    id,
                    negocio_id,
                    nombre,
                    telefono,
                    email,
                    direccion,
                    rfc,
                    contacto,
                    activo,
                    created_at
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

            if (errorProveedores) {
                console.error(
                    "Error cargando proveedores:",
                    errorProveedores
                );

                mostrarMensaje(
                    "error",
                    errorProveedores.message ||
                    "No se pudieron cargar los proveedores.",
                    "Error al cargar proveedores"
                );

                return;
            }

            setProveedores(
                (data as Proveedor[]) ?? []
            );
        } catch (error) {
            console.error(
                "Error inesperado cargando proveedores:",
                error
            );

            mostrarMensaje(
                "error",
                "Ocurrió un error al cargar los proveedores.",
                "Error"
            );
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        cargarProveedores();
    }, []);

    /*
     * =========================================================
     * RESÚMENES / FILTROS
     * =========================================================
     */

    const resumen = useMemo(() => {
        const total =
            proveedores.length;

        const activos =
            proveedores.filter(
                (proveedor) =>
                    proveedor.activo
            ).length;

        const inactivos =
            proveedores.filter(
                (proveedor) =>
                    !proveedor.activo
            ).length;

        return {
            total,
            activos,
            inactivos,
        };
    }, [proveedores]);

    const proveedoresFiltrados =
        useMemo(() => {
            const texto =
                busqueda
                    .trim()
                    .toLowerCase();

            return proveedores.filter(
                (proveedor) => {
                    if (
                        filtroEstado === "activos" &&
                        !proveedor.activo
                    ) {
                        return false;
                    }

                    if (
                        filtroEstado === "inactivos" &&
                        proveedor.activo
                    ) {
                        return false;
                    }

                    if (!texto) {
                        return true;
                    }

                    return Boolean(
                        proveedor.nombre
                            ?.toLowerCase()
                            .includes(texto) ||
                        proveedor.rfc
                            ?.toLowerCase()
                            .includes(texto) ||
                        proveedor.contacto
                            ?.toLowerCase()
                            .includes(texto) ||
                        proveedor.telefono
                            ?.toLowerCase()
                            .includes(texto) ||
                        proveedor.email
                            ?.toLowerCase()
                            .includes(texto) ||
                        proveedor.direccion
                            ?.toLowerCase()
                            .includes(texto)
                    );
                }
            );
        }, [
            proveedores,
            busqueda,
            filtroEstado,
        ]);

    function limpiarFiltros() {
        setBusqueda("");
        setFiltroEstado("todos");
    }

    /*
     * =========================================================
     * FORMULARIO PROVEEDOR
     * =========================================================
     */

    function abrirModalCrear() {
        setModoFormulario("crear");
        setProveedorSeleccionado(null);

        setFormulario({
            nombre: "",
            telefono: "",
            email: "",
            direccion: "",
            rfc: "",
            contacto: "",
        });

        setModalAbierto(true);
    }

    function abrirModalEditar(
        proveedor: Proveedor
    ) {
        setModoFormulario("editar");

        setProveedorSeleccionado(
            proveedor
        );

        setFormulario({
            nombre:
                proveedor.nombre ?? "",
            telefono:
                proveedor.telefono ?? "",
            email:
                proveedor.email ?? "",
            direccion:
                proveedor.direccion ?? "",
            rfc:
                proveedor.rfc ?? "",
            contacto:
                proveedor.contacto ?? "",
        });

        setModalAbierto(true);
    }

    function cerrarModalFormulario() {
        if (guardando) {
            return;
        }

        setModalAbierto(false);
        setProveedorSeleccionado(null);
    }

    function actualizarCampo(
        campo: keyof FormularioProveedor,
        valor: string
    ) {
        setFormulario(
            (actual) => ({
                ...actual,
                [campo]: valor,
            })
        );
    }

    async function guardarProveedor(
        e: React.FormEvent<HTMLFormElement>
    ) {
        e.preventDefault();

        if (
            !formulario.nombre.trim()
        ) {
            mostrarMensaje(
                "error",
                "El nombre del proveedor es obligatorio.",
                "Datos incompletos"
            );
            return;
        }

        if (!usuario?.negocio_id) {
            mostrarMensaje(
                "error",
                "No se encontró el negocio del usuario.",
                "Negocio no disponible"
            );
            return;
        }

        setGuardando(true);

        try {
            if (
                modoFormulario === "crear"
            ) {
                const {
                    data,
                    error: errorInsertar,
                } = await supabase
                    .from("proveedores")
                    .insert({
                        negocio_id:
                            usuario.negocio_id,
                        nombre:
                            formulario.nombre.trim(),
                        telefono:
                            formulario.telefono.trim() ||
                            null,
                        email:
                            formulario.email.trim() ||
                            null,
                        direccion:
                            formulario.direccion.trim() ||
                            null,
                        rfc:
                            formulario.rfc.trim() ||
                            null,
                        contacto:
                            formulario.contacto.trim() ||
                            null,
                        activo: true,
                    })
                    .select(`
                        id,
                        negocio_id,
                        nombre,
                        telefono,
                        email,
                        direccion,
                        rfc,
                        contacto,
                        activo,
                        created_at
                    `)
                    .single();

                if (errorInsertar) {
                    console.error(
                        "Error creando proveedor:",
                        errorInsertar
                    );

                    mostrarMensaje(
                        "error",
                        errorInsertar.message ||
                        "No se pudo crear el proveedor.",
                        "Error al crear proveedor"
                    );

                    return;
                }

                if (data) {
                    setProveedores(
                        (actuales) => [
                            data as Proveedor,
                            ...actuales,
                        ]
                    );
                }

                setModalAbierto(false);
                setProveedorSeleccionado(null);

                mostrarMensaje(
                    "exito",
                    "El proveedor fue creado correctamente.",
                    "Proveedor creado"
                );

                return;
            }

            if (
                !proveedorSeleccionado
            ) {
                mostrarMensaje(
                    "error",
                    "No se encontró el proveedor seleccionado.",
                    "Proveedor no disponible"
                );
                return;
            }

            const {
                data,
                error: errorActualizar,
            } = await supabase
                .from("proveedores")
                .update({
                    nombre:
                        formulario.nombre.trim(),
                    telefono:
                        formulario.telefono.trim() ||
                        null,
                    email:
                        formulario.email.trim() ||
                        null,
                    direccion:
                        formulario.direccion.trim() ||
                        null,
                    rfc:
                        formulario.rfc.trim() ||
                        null,
                    contacto:
                        formulario.contacto.trim() ||
                        null,
                })
                .eq(
                    "id",
                    proveedorSeleccionado.id
                )
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .select(`
                    id,
                    negocio_id,
                    nombre,
                    telefono,
                    email,
                    direccion,
                    rfc,
                    contacto,
                    activo,
                    created_at
                `)
                .single();

            if (errorActualizar) {
                console.error(
                    "Error actualizando proveedor:",
                    errorActualizar
                );

                mostrarMensaje(
                    "error",
                    errorActualizar.message ||
                    "No se pudo actualizar el proveedor.",
                    "Error al actualizar proveedor"
                );

                return;
            }

            if (data) {
                setProveedores(
                    (actuales) =>
                        actuales.map(
                            (item) =>
                                item.id === data.id
                                    ? (data as Proveedor)
                                    : item
                        )
                );
            }

            setModalAbierto(false);
            setProveedorSeleccionado(null);

            mostrarMensaje(
                "exito",
                "El proveedor fue actualizado correctamente.",
                "Proveedor actualizado"
            );
        } catch (error) {
            console.error(
                "Error inesperado guardando proveedor:",
                error
            );

            mostrarMensaje(
                "error",
                "Ocurrió un error al guardar el proveedor.",
                "Error"
            );
        } finally {
            setGuardando(false);
        }
    }

    /*
     * =========================================================
     * CAMBIO DE ESTADO
     * =========================================================
     */

    function solicitarCambioEstadoProveedor(
        proveedor: Proveedor
    ) {
        if (!usuario?.negocio_id) {
            mostrarMensaje(
                "error",
                "No se encontró el negocio del usuario.",
                "Negocio no disponible"
            );
            return;
        }

        setProveedorEstadoPendiente(
            proveedor
        );

        const nuevoEstado =
            !proveedor.activo;

        setTipoMensaje(
            "confirmacion"
        );

        setTituloMensaje(
            nuevoEstado
                ? "Activar proveedor"
                : "Desactivar proveedor"
        );

        setTextoMensaje(
            `¿Deseas ${nuevoEstado
                ? "activar"
                : "desactivar"
            } el proveedor "${proveedor.nombre}"?`
        );

        setModalMensajeAbierto(
            true
        );
    }

    async function confirmarCambioEstadoProveedor() {
        if (
            !proveedorEstadoPendiente ||
            !usuario?.negocio_id
        ) {
            return;
        }

        const proveedor =
            proveedorEstadoPendiente;

        const nuevoEstado =
            !proveedor.activo;

        setModalMensajeAbierto(false);

        try {
            const {
                data,
                error: errorActualizar,
            } = await supabase
                .from("proveedores")
                .update({
                    activo:
                        nuevoEstado,
                })
                .eq(
                    "id",
                    proveedor.id
                )
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .select(`
                    id,
                    negocio_id,
                    nombre,
                    telefono,
                    email,
                    direccion,
                    rfc,
                    contacto,
                    activo,
                    created_at
                `)
                .single();

            if (errorActualizar) {
                console.error(
                    "Error cambiando estado:",
                    errorActualizar
                );

                setProveedorEstadoPendiente(
                    null
                );

                mostrarMensaje(
                    "error",
                    errorActualizar.message ||
                    "No se pudo cambiar el estado del proveedor.",
                    "Error"
                );

                return;
            }

            if (data) {
                setProveedores(
                    (actuales) =>
                        actuales.map(
                            (item) =>
                                item.id === data.id
                                    ? (data as Proveedor)
                                    : item
                        )
                );
            }

            setProveedorEstadoPendiente(
                null
            );

            mostrarMensaje(
                "exito",
                nuevoEstado
                    ? "El proveedor fue activado correctamente."
                    : "El proveedor fue desactivado correctamente.",
                nuevoEstado
                    ? "Proveedor activado"
                    : "Proveedor desactivado"
            );
        } catch (error) {
            console.error(
                "Error inesperado cambiando estado:",
                error
            );

            setProveedorEstadoPendiente(
                null
            );

            mostrarMensaje(
                "error",
                "Ocurrió un error al cambiar el estado del proveedor.",
                "Error"
            );
        }
    }

    /*
     * =========================================================
     * DETALLE DEL PROVEEDOR
     * =========================================================
     */

    async function abrirDetalleProveedor(
        proveedor: Proveedor
    ) {
        if (!usuario?.negocio_id) {
            mostrarMensaje(
                "error",
                "No se encontró el negocio del usuario.",
                "Negocio no disponible"
            );
            return;
        }

        setProveedorDetalle(
            proveedor
        );

        setDetalleAbierto(true);
        setCargandoDetalle(true);

        try {
            const {
                data: comprasData,
                error: errorCompras,
            } = await supabase
                .from("compras")
                .select(`
                    id,
                    negocio_id,
                    sucursal_id,
                    proveedor_id,
                    usuario_id,
                    subtotal,
                    descuento,
                    impuesto,
                    total,
                    estado,
                    referencia,
                    notas,
                    created_at,
                    sucursales (
                        nombre
                    )
                `)
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .eq(
                    "proveedor_id",
                    proveedor.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (errorCompras) {
                console.error(
                    "Error obteniendo compras:",
                    errorCompras
                );

                throw new Error(
                    "No se pudieron obtener las compras del proveedor."
                );
            }

            const {
                data: cuentasData,
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
                    notas,
                    created_at,
                    updated_at
                `)
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .eq(
                    "proveedor_id",
                    proveedor.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (errorCuentas) {
                console.error(
                    "Error obteniendo cuentas:",
                    errorCuentas
                );

                throw new Error(
                    "No se pudieron obtener las cuentas por pagar."
                );
            }

            const {
                data: pagosData,
                error: errorPagos,
            } = await supabase
                .from("pagos_proveedores")
                .select(`
                    id,
                    negocio_id,
                    cuenta_por_pagar_id,
                    proveedor_id,
                    usuario_id,
                    monto,
                    metodo_pago,
                    referencia,
                    notas,
                    created_at
                `)
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .eq(
                    "proveedor_id",
                    proveedor.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (errorPagos) {
                console.error(
                    "Error obteniendo pagos:",
                    errorPagos
                );

                throw new Error(
                    "No se pudieron obtener los pagos del proveedor."
                );
            }

            setComprasProveedor(
                (comprasData as unknown as Compra[]) ??
                []
            );

            setCuentasProveedor(
                (cuentasData as CuentaPorPagar[]) ??
                []
            );

            setPagosProveedor(
                (pagosData as PagoProveedor[]) ??
                []
            );
        } catch (error) {
            console.error(
                "Error cargando detalle:",
                error
            );

            mostrarMensaje(
                "error",
                error instanceof Error
                    ? error.message
                    : "No se pudo cargar el detalle del proveedor.",
                "Error al cargar detalle"
            );
        } finally {
            setCargandoDetalle(false);
        }
    }

    function cerrarDetalleProveedor() {
        setDetalleAbierto(false);
        setProveedorDetalle(null);
        setComprasProveedor([]);
        setCuentasProveedor([]);
        setPagosProveedor([]);
    }

    const resumenProveedor =
        useMemo(() => {
            const comprasRecibidas =
                comprasProveedor.filter(
                    (compra) =>
                        compra.estado === "recibida"
                );

            const totalComprado =
                comprasRecibidas.reduce(
                    (total, compra) =>
                        total +
                        Number(compra.total),
                    0
                );

            const totalPagado =
                cuentasProveedor.reduce(
                    (total, cuenta) =>
                        total +
                        Number(cuenta.monto_pagado),
                    0
                );

            const totalPendiente =
                cuentasProveedor
                    .filter(
                        (cuenta) =>
                            cuenta.estado !== "cancelada"
                    )
                    .reduce(
                        (total, cuenta) =>
                            total +
                            Number(cuenta.monto_pendiente),
                        0
                    );

            const cuentasPendientes =
                cuentasProveedor.filter(
                    (cuenta) =>
                        cuenta.estado === "pendiente" ||
                        cuenta.estado === "parcial"
                ).length;

            return {
                comprasRecibidas:
                    comprasRecibidas.length,
                totalComprado,
                totalPagado,
                totalPendiente,
                cuentasPendientes,
            };
        }, [
            comprasProveedor,
            cuentasProveedor,
        ]);

    function obtenerCuentaCompra(
        compraId: string
    ) {
        return cuentasProveedor.find(
            (cuenta) =>
                cuenta.compra_id === compraId
        );
    }

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
                return metodo;
        }
    }

    function obtenerEstadoCuenta(
        estado: string
    ) {
        switch (estado) {
            case "pagada":
                return {
                    texto: "Pagada",
                    estilo: {
                        backgroundColor:
                            "color-mix(in srgb, var(--color-success) 12%, var(--color-surface))",
                        color:
                            "var(--color-success)",
                    },
                };

            case "parcial":
                return {
                    texto: "Pago parcial",
                    estilo: {
                        backgroundColor:
                            "color-mix(in srgb, var(--color-warning) 12%, var(--color-surface))",
                        color:
                            "var(--color-warning)",
                    },
                };

            case "cancelada":
                return {
                    texto: "Cancelada",
                    estilo: {
                        backgroundColor:
                            "color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-surface))",
                        color:
                            "var(--color-text-secondary)",
                    },
                };

            default:
                return {
                    texto: "Pendiente",
                    estilo: {
                        backgroundColor:
                            "color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))",
                        color:
                            "var(--color-danger)",
                    },
                };
        }
    }

    /*
     * =========================================================
     * PAGOS
     * =========================================================
     */

    function abrirModalPago(
        cuenta: CuentaPorPagar
    ) {
        if (
            cuenta.estado === "cancelada"
        ) {
            mostrarMensaje(
                "info",
                "No se puede registrar un pago para una cuenta cancelada.",
                "Cuenta cancelada"
            );
            return;
        }

        if (
            Number(cuenta.monto_pendiente) <= 0
        ) {
            mostrarMensaje(
                "info",
                "Esta cuenta por pagar ya no tiene saldo pendiente.",
                "Cuenta liquidada"
            );
            return;
        }

        setCuentaPagoSeleccionada(
            cuenta
        );

        setFormularioPago({
            monto:
                Number(
                    cuenta.monto_pendiente
                ).toFixed(2),
            metodo_pago:
                "efectivo",
            referencia: "",
            notas: "",
        });

        setModalPagoAbierto(true);
    }

    function cerrarModalPago() {
        if (pagando) {
            return;
        }

        setModalPagoAbierto(false);
        setCuentaPagoSeleccionada(null);

        setFormularioPago({
            monto: "",
            metodo_pago: "efectivo",
            referencia: "",
            notas: "",
        });
    }

    async function registrarPagoProveedor(
        e: React.FormEvent<HTMLFormElement>
    ) {
        e.preventDefault();

        if (!usuario?.negocio_id) {
            mostrarMensaje(
                "error",
                "No se encontró el negocio del usuario.",
                "Negocio no disponible"
            );
            return;
        }

        if (!cuentaPagoSeleccionada) {
            mostrarMensaje(
                "error",
                "No se encontró la cuenta por pagar seleccionada.",
                "Cuenta no disponible"
            );
            return;
        }

        const monto =
            Number(formularioPago.monto);

        if (
            !Number.isFinite(monto) ||
            monto <= 0
        ) {
            mostrarMensaje(
                "error",
                "El monto del pago debe ser mayor a cero.",
                "Monto inválido"
            );
            return;
        }

        const pendiente =
            Number(
                cuentaPagoSeleccionada.monto_pendiente
            );

        if (
            monto >
            pendiente + 0.01
        ) {
            mostrarMensaje(
                "error",
                `El pago no puede ser mayor al saldo pendiente de ${formatearMoneda(
                    pendiente
                )}.`,
                "Monto excedido"
            );
            return;
        }

        const metodosPermitidos = [
            "efectivo",
            "tarjeta",
            "transferencia",
            "cheque",
            "otro",
        ];

        if (
            !metodosPermitidos.includes(
                formularioPago.metodo_pago
            )
        ) {
            mostrarMensaje(
                "error",
                "Selecciona un método de pago válido.",
                "Método inválido"
            );
            return;
        }

        setPagando(true);

        try {
            const {
                data,
                error: errorRPC,
            } = await supabase.rpc(
                "registrar_pago_proveedor",
                {
                    p_cuenta_por_pagar_id:
                        cuentaPagoSeleccionada.id,
                    p_monto:
                        monto,
                    p_metodo_pago:
                        formularioPago.metodo_pago,
                    p_referencia:
                        formularioPago.referencia.trim() ||
                        null,
                    p_notas:
                        formularioPago.notas.trim() ||
                        null,
                }
            );

            if (errorRPC) {
                console.error(
                    "Error registrando pago:",
                    errorRPC
                );

                throw new Error(
                    errorRPC.message ||
                    "No se pudo registrar el pago."
                );
            }

            if (!data) {
                throw new Error(
                    "No se obtuvo el identificador del pago registrado."
                );
            }

            setModalPagoAbierto(false);
            setCuentaPagoSeleccionada(null);

            setFormularioPago({
                monto: "",
                metodo_pago: "efectivo",
                referencia: "",
                notas: "",
            });

            mostrarMensaje(
                "exito",
                `Se registró correctamente el pago de ${formatearMoneda(
                    monto
                )}.`,
                "Pago registrado"
            );

            if (proveedorDetalle) {
                await abrirDetalleProveedor(
                    proveedorDetalle
                );
            }
        } catch (error) {
            console.error(
                "Error registrando pago:",
                error
            );

            mostrarMensaje(
                "error",
                error instanceof Error
                    ? error.message
                    : "Ocurrió un error al registrar el pago.",
                "Error al registrar pago"
            );
        } finally {
            setPagando(false);
        }
    }

    /*
     * =========================================================
     * ESTILOS REUTILIZABLES
     * =========================================================
     */

    const inputClass =
        "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60";

    const tableHeadClass =
        "border-b border-[var(--color-border)] bg-[var(--color-background)]";

    /*
     * =========================================================
     * RENDER
     * =========================================================
     */

    return (
        <div className="space-y-6 text-[var(--color-text)]">

            {/* =================================================
                ENCABEZADO
            ================================================== */}

            <div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold sm:text-3xl">
                            Proveedores
                        </h1>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Administra los proveedores de tu negocio.
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="primary"
                        size="medium"
                        onClick={abrirModalCrear}
                    >
                        + Nuevo proveedor
                    </Button>
                </div>
            </div>

            {/* =================================================
                RESUMEN
            ================================================== */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Proveedores totales
                            </p>

                            <p className="mt-2 text-3xl font-bold">
                                {resumen.total}
                            </p>
                        </div>

                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-xl"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))",
                                color:
                                    "var(--color-primary)",
                            }}
                        >
                            🚚
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Activos
                            </p>

                            <p
                                className="mt-2 text-3xl font-bold"
                                style={{
                                    color:
                                        "var(--color-success)",
                                }}
                            >
                                {resumen.activos}
                            </p>
                        </div>

                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-xl"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-success) 12%, var(--color-surface))",
                                color:
                                    "var(--color-success)",
                            }}
                        >
                            ✓
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                Inactivos
                            </p>

                            <p
                                className="mt-2 text-3xl font-bold"
                                style={{
                                    color:
                                        "var(--color-text-secondary)",
                                }}
                            >
                                {resumen.inactivos}
                            </p>
                        </div>

                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-xl"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-surface))",
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            ○
                        </div>
                    </div>
                </Card>

            </div>

            {/* =================================================
                FILTROS
            ================================================== */}

            <Card className="p-5">
                <div className="mb-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="text-base font-bold">
                                Buscar proveedores
                            </h2>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Busca por nombre, RFC, contacto,
                                teléfono, correo o dirección.
                            </p>
                        </div>

                        <Button
                            type="button"
                            variant="secondary"
                            size="small"
                            onClick={limpiarFiltros}
                        >
                            Limpiar filtros
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div>
                        <label className="mb-2 block text-sm font-medium">
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
                            placeholder="Nombre, RFC, contacto, teléfono..."
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            Estado
                        </label>

                        <select
                            value={filtroEstado}
                            onChange={(e) =>
                                setFiltroEstado(
                                    e.target.value as
                                    | "todos"
                                    | "activos"
                                    | "inactivos"
                                )
                            }
                            className={inputClass}
                        >
                            <option value="todos">
                                Todos
                            </option>

                            <option value="activos">
                                Activos
                            </option>

                            <option value="inactivos">
                                Inactivos
                            </option>
                        </select>
                    </div>

                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">

                    {busqueda && (
                        <span
                            className="rounded-full px-3 py-1 text-xs font-semibold"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))",
                                color:
                                    "var(--color-primary)",
                            }}
                        >
                            Buscar: {busqueda}
                        </span>
                    )}

                    {filtroEstado !== "todos" && (
                        <span
                            className="rounded-full px-3 py-1 text-xs font-semibold"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-secondary) 10%, var(--color-surface))",
                                color:
                                    "var(--color-secondary)",
                            }}
                        >
                            Estado:{" "}
                            {filtroEstado === "activos"
                                ? "Activos"
                                : "Inactivos"}
                        </span>
                    )}

                    {!busqueda &&
                        filtroEstado === "todos" && (
                            <span className="text-xs text-[var(--color-text-secondary)]">
                                Sin filtros activos
                            </span>
                        )}

                </div>
            </Card>

            {/* =================================================
                LISTADO
            ================================================== */}

            <Card className="overflow-hidden p-0">

                <div className="border-b border-[var(--color-border)] px-5 py-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-base font-bold">
                                Historial de proveedores
                            </h2>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                Proveedores registrados en tu negocio.
                            </p>
                        </div>

                        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                            {proveedoresFiltrados.length} resultado
                            {proveedoresFiltrados.length === 1
                                ? ""
                                : "s"}
                        </span>
                    </div>
                </div>

                {cargando ? (
                    <div className="flex min-h-64 items-center justify-center p-8">
                        <div className="text-center">
                            <div
                                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                                style={{
                                    backgroundColor:
                                        "var(--color-primary)",
                                }}
                            >
                                ⏳
                            </div>

                            <p className="text-sm font-semibold">
                                Cargando proveedores...
                            </p>
                        </div>
                    </div>
                ) : proveedoresFiltrados.length === 0 ? (
                    <div className="p-10 text-center">

                        <div
                            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                            style={{
                                backgroundColor:
                                    "color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))",
                                color:
                                    "var(--color-primary)",
                            }}
                        >
                            🚚
                        </div>

                        <p className="mt-4 text-base font-semibold">
                            No se encontraron proveedores
                        </p>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Prueba cambiando los filtros o registra
                            un nuevo proveedor.
                        </p>

                        <div className="mt-5">
                            <Button
                                type="button"
                                variant="primary"
                                size="small"
                                onClick={abrirModalCrear}
                            >
                                + Nuevo proveedor
                            </Button>
                        </div>

                    </div>
                ) : (
                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[1200px]">

                            <thead>
                                <tr className={tableHeadClass}>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Proveedor
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        RFC
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Contacto
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Teléfono
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Correo
                                    </th>

                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Registro
                                    </th>

                                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Estado
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        Acciones
                                    </th>

                                </tr>
                            </thead>

                            <tbody className="divide-y divide-[var(--color-border)]">

                                {proveedoresFiltrados.map(
                                    (proveedor) => (
                                        <tr
                                            key={proveedor.id}
                                            className="transition hover:bg-[var(--color-background)]"
                                        >

                                            <td className="px-5 py-4">
                                                <div>
                                                    <p className="font-semibold">
                                                        {proveedor.nombre}
                                                    </p>

                                                    {proveedor.direccion && (
                                                        <p className="mt-1 max-w-xs truncate text-xs text-[var(--color-text-secondary)]">
                                                            {proveedor.direccion}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="text-sm font-medium">
                                                    {proveedor.rfc ||
                                                        "Sin RFC"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="text-sm">
                                                    {proveedor.contacto ||
                                                        "Sin contacto"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="text-sm">
                                                    {proveedor.telefono ||
                                                        "Sin teléfono"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="text-sm">
                                                    {proveedor.email ||
                                                        "Sin correo"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <p className="text-sm">
                                                    {formatearFecha(
                                                        proveedor.created_at
                                                    )}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4 text-center">

                                                {proveedor.activo ? (
                                                    <span
                                                        className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                                        style={{
                                                            backgroundColor:
                                                                "color-mix(in srgb, var(--color-success) 12%, var(--color-surface))",
                                                            color:
                                                                "var(--color-success)",
                                                        }}
                                                    >
                                                        Activo
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                                        style={{
                                                            backgroundColor:
                                                                "color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-surface))",
                                                            color:
                                                                "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        Inactivo
                                                    </span>
                                                )}

                                            </td>

                                            <td className="px-5 py-4">

                                                <div className="flex items-center justify-end gap-2">

                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="small"
                                                        onClick={() =>
                                                            abrirDetalleProveedor(
                                                                proveedor
                                                            )
                                                        }
                                                    >
                                                        👁️ Detalle
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="small"
                                                        onClick={() =>
                                                            abrirModalEditar(
                                                                proveedor
                                                            )
                                                        }
                                                    >
                                                        ✏️ Editar
                                                    </Button>

                                                    {proveedor.activo ? (
                                                        <Button
                                                            type="button"
                                                            variant="danger"
                                                            size="small"
                                                            onClick={() =>
                                                                solicitarCambioEstadoProveedor(
                                                                    proveedor
                                                                )
                                                            }
                                                        >
                                                            Desactivar
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            variant="primary"
                                                            size="small"
                                                            onClick={() =>
                                                                solicitarCambioEstadoProveedor(
                                                                    proveedor
                                                                )
                                                            }
                                                        >
                                                            Activar
                                                        </Button>
                                                    )}

                                                </div>

                                            </td>

                                        </tr>
                                    )
                                )}

                            </tbody>

                        </table>

                    </div>
                )}

            </Card>

            {/* =================================================
                MODAL CREAR / EDITAR
            ================================================== */}

            {modalAbierto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
                    onMouseDown={(e) => {
                        if (
                            e.target ===
                            e.currentTarget
                        ) {
                            cerrarModalFormulario();
                        }
                    }}
                >
                    <Card
                        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0"
                    >

                        <div className="shrink-0 border-b border-[var(--color-border)] px-6 py-5">

                            <div className="flex items-start justify-between gap-4">

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                        {modoFormulario === "crear"
                                            ? "Nuevo proveedor"
                                            : "Editar proveedor"}
                                    </p>

                                    <h2 className="mt-1 text-xl font-bold">
                                        {modoFormulario === "crear"
                                            ? "Registrar proveedor"
                                            : proveedorSeleccionado?.nombre}
                                    </h2>

                                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                        Captura la información del proveedor.
                                    </p>
                                </div>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="small"
                                    onClick={
                                        cerrarModalFormulario
                                    }
                                    disabled={guardando}
                                    className="h-10 w-10 !p-0 text-xl"
                                    aria-label="Cerrar"
                                >
                                    ✕
                                </Button>

                            </div>

                        </div>

                        <form
                            onSubmit={guardarProveedor}
                            className="min-h-0 flex-1 overflow-y-auto"
                        >

                            <div className="space-y-5 px-6 py-5">

                                <div>
                                    <h3 className="text-sm font-bold">
                                        Información del proveedor
                                    </h3>

                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                        El nombre es el único campo obligatorio.
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Nombre del proveedor *
                                    </label>

                                    <input
                                        type="text"
                                        value={formulario.nombre}
                                        onChange={(e) =>
                                            actualizarCampo(
                                                "nombre",
                                                e.target.value
                                            )
                                        }
                                        placeholder="Ej. Distribuidora ABC"
                                        required
                                        autoFocus
                                        className={inputClass}
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            RFC
                                        </label>

                                        <input
                                            type="text"
                                            value={formulario.rfc}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "rfc",
                                                    e.target.value.toUpperCase()
                                                )
                                            }
                                            placeholder="RFC del proveedor"
                                            className={`${inputClass} uppercase`}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Persona de contacto
                                        </label>

                                        <input
                                            type="text"
                                            value={formulario.contacto}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "contacto",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Nombre del contacto"
                                            className={inputClass}
                                        />
                                    </div>

                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Teléfono
                                        </label>

                                        <input
                                            type="tel"
                                            value={formulario.telefono}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "telefono",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Teléfono"
                                            className={inputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium">
                                            Correo electrónico
                                        </label>

                                        <input
                                            type="email"
                                            value={formulario.email}
                                            onChange={(e) =>
                                                actualizarCampo(
                                                    "email",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="correo@ejemplo.com"
                                            className={inputClass}
                                        />
                                    </div>

                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Dirección
                                    </label>

                                    <textarea
                                        value={formulario.direccion}
                                        onChange={(e) =>
                                            actualizarCampo(
                                                "direccion",
                                                e.target.value
                                            )
                                        }
                                        placeholder="Dirección del proveedor"
                                        rows={3}
                                        className={`${inputClass} resize-none`}
                                    />
                                </div>

                            </div>

                            <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-background)] px-6 py-4">

                                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="medium"
                                        onClick={
                                            cerrarModalFormulario
                                        }
                                        disabled={guardando}
                                    >
                                        Cancelar
                                    </Button>

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="medium"
                                        disabled={guardando}
                                    >
                                        {guardando
                                            ? "Guardando..."
                                            : modoFormulario ===
                                                "crear"
                                                ? "Crear proveedor"
                                                : "Guardar cambios"}
                                    </Button>

                                </div>

                            </div>

                        </form>

                    </Card>
                </div>
            )}

            {/* =================================================
                MODAL DETALLE
            ================================================== */}

            {detalleAbierto &&
                proveedorDetalle && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
                        onMouseDown={(e) => {
                            if (
                                e.target ===
                                e.currentTarget
                            ) {
                                cerrarDetalleProveedor();
                            }
                        }}
                    >
                        <Card
                            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden p-0"
                        >

                            <div className="shrink-0 border-b border-[var(--color-border)] px-6 py-5">

                                <div className="flex items-start justify-between gap-4">

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Detalle del proveedor
                                        </p>

                                        <h2 className="mt-1 text-xl font-bold">
                                            {proveedorDetalle.nombre}
                                        </h2>

                                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                            Información comercial,
                                            compras y cuentas por pagar.
                                        </p>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="small"
                                        onClick={
                                            cerrarDetalleProveedor
                                        }
                                        className="h-10 w-10 !p-0 text-xl"
                                        aria-label="Cerrar"
                                    >
                                        ✕
                                    </Button>

                                </div>

                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto p-6">

                                {cargandoDetalle ? (
                                    <div className="flex min-h-64 items-center justify-center">

                                        <div className="text-center">

                                            <div
                                                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                                                style={{
                                                    backgroundColor:
                                                        "var(--color-primary)",
                                                }}
                                            >
                                                ⏳
                                            </div>

                                            <p className="text-sm font-semibold">
                                                Cargando detalle...
                                            </p>

                                        </div>

                                    </div>
                                ) : (
                                    <div className="space-y-6">

                                        {/* INFORMACIÓN + RESUMEN */}

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                                            <Card className="p-5">

                                                <h3 className="text-sm font-bold">
                                                    Información de contacto
                                                </h3>

                                                <div className="mt-4 space-y-3">

                                                    <div>
                                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                                            RFC
                                                        </span>

                                                        <p className="mt-1 text-sm font-semibold">
                                                            {proveedorDetalle.rfc ||
                                                                "Sin RFC"}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                                            Contacto
                                                        </span>

                                                        <p className="mt-1 text-sm font-semibold">
                                                            {proveedorDetalle.contacto ||
                                                                "Sin contacto"}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                                            Teléfono
                                                        </span>

                                                        <p className="mt-1 text-sm font-semibold">
                                                            {proveedorDetalle.telefono ||
                                                                "Sin teléfono"}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                                            Correo
                                                        </span>

                                                        <p className="mt-1 break-all text-sm font-semibold">
                                                            {proveedorDetalle.email ||
                                                                "Sin correo"}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                                            Dirección
                                                        </span>

                                                        <p className="mt-1 text-sm font-semibold">
                                                            {proveedorDetalle.direccion ||
                                                                "Sin dirección"}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                                            Estado
                                                        </span>

                                                        <div className="mt-1">
                                                            {proveedorDetalle.activo ? (
                                                                <span
                                                                    className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                                                    style={{
                                                                        backgroundColor:
                                                                            "color-mix(in srgb, var(--color-success) 12%, var(--color-surface))",
                                                                        color:
                                                                            "var(--color-success)",
                                                                    }}
                                                                >
                                                                    Activo
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                                                    style={{
                                                                        backgroundColor:
                                                                            "color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-surface))",
                                                                        color:
                                                                            "var(--color-text-secondary)",
                                                                    }}
                                                                >
                                                                    Inactivo
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                </div>

                                            </Card>

                                            <Card className="p-5">

                                                <h3 className="text-sm font-bold">
                                                    Resumen financiero
                                                </h3>

                                                <div className="mt-4 grid grid-cols-2 gap-3">

                                                    <div
                                                        className="rounded-xl p-4"
                                                        style={{
                                                            backgroundColor:
                                                                "color-mix(in srgb, var(--color-text-secondary) 8%, var(--color-surface))",
                                                        }}
                                                    >
                                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                                            Compras recibidas
                                                        </p>

                                                        <p className="mt-1 text-xl font-bold">
                                                            {
                                                                resumenProveedor.comprasRecibidas
                                                            }
                                                        </p>
                                                    </div>

                                                    <div
                                                        className="rounded-xl p-4"
                                                        style={{
                                                            backgroundColor:
                                                                "color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))",
                                                        }}
                                                    >
                                                        <p
                                                            className="text-xs"
                                                            style={{
                                                                color:
                                                                    "var(--color-primary)",
                                                            }}
                                                        >
                                                            Total comprado
                                                        </p>

                                                        <p
                                                            className="mt-1 text-lg font-bold"
                                                            style={{
                                                                color:
                                                                    "var(--color-primary)",
                                                            }}
                                                        >
                                                            {formatearMoneda(
                                                                resumenProveedor.totalComprado
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div
                                                        className="rounded-xl p-4"
                                                        style={{
                                                            backgroundColor:
                                                                "color-mix(in srgb, var(--color-success) 10%, var(--color-surface))",
                                                        }}
                                                    >
                                                        <p
                                                            className="text-xs"
                                                            style={{
                                                                color:
                                                                    "var(--color-success)",
                                                            }}
                                                        >
                                                            Total pagado
                                                        </p>

                                                        <p
                                                            className="mt-1 text-lg font-bold"
                                                            style={{
                                                                color:
                                                                    "var(--color-success)",
                                                            }}
                                                        >
                                                            {formatearMoneda(
                                                                resumenProveedor.totalPagado
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div
                                                        className="rounded-xl p-4"
                                                        style={{
                                                            backgroundColor:
                                                                "color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))",
                                                        }}
                                                    >
                                                        <p
                                                            className="text-xs"
                                                            style={{
                                                                color:
                                                                    "var(--color-danger)",
                                                            }}
                                                        >
                                                            Saldo pendiente
                                                        </p>

                                                        <p
                                                            className="mt-1 text-lg font-bold"
                                                            style={{
                                                                color:
                                                                    "var(--color-danger)",
                                                            }}
                                                        >
                                                            {formatearMoneda(
                                                                resumenProveedor.totalPendiente
                                                            )}
                                                        </p>
                                                    </div>

                                                </div>

                                                <div className="mt-4 rounded-xl border border-[var(--color-border)] p-4">

                                                    <div className="flex items-center justify-between">

                                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                                            Cuentas pendientes
                                                        </span>

                                                        <span className="font-bold">
                                                            {
                                                                resumenProveedor.cuentasPendientes
                                                            }
                                                        </span>

                                                    </div>

                                                </div>

                                            </Card>

                                        </div>

                                        {/* =================================================
                                            COMPRAS
                                        ================================================== */}

                                        <Card className="overflow-hidden p-0">

                                            <div className="border-b border-[var(--color-border)] px-5 py-4">

                                                <h3 className="text-base font-bold">
                                                    Compras del proveedor
                                                </h3>

                                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                    Historial de compras registradas.
                                                </p>

                                            </div>

                                            {comprasProveedor.length === 0 ? (
                                                <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
                                                    No hay compras registradas
                                                    para este proveedor.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">

                                                    <table className="w-full min-w-[850px]">

                                                        <thead>
                                                            <tr className={tableHeadClass}>

                                                                <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Compra
                                                                </th>

                                                                <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Sucursal
                                                                </th>

                                                                <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Fecha
                                                                </th>

                                                                <th className="px-5 py-3 text-right text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Total
                                                                </th>

                                                                <th className="px-5 py-3 text-center text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Estado
                                                                </th>

                                                                <th className="px-5 py-3 text-right text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Cuenta
                                                                </th>

                                                            </tr>
                                                        </thead>

                                                        <tbody className="divide-y divide-[var(--color-border)]">

                                                            {comprasProveedor.map(
                                                                (compra) => {
                                                                    const cuenta =
                                                                        obtenerCuentaCompra(
                                                                            compra.id
                                                                        );

                                                                    return (
                                                                        <tr
                                                                            key={
                                                                                compra.id
                                                                            }
                                                                            className="transition hover:bg-[var(--color-background)]"
                                                                        >

                                                                            <td className="px-5 py-4">

                                                                                <p className="font-semibold">
                                                                                    #
                                                                                    {compra.id.slice(
                                                                                        0,
                                                                                        8
                                                                                    )}
                                                                                </p>

                                                                                {compra.referencia && (
                                                                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                                        Ref:{" "}
                                                                                        {
                                                                                            compra.referencia
                                                                                        }
                                                                                    </p>
                                                                                )}

                                                                            </td>

                                                                            <td className="px-5 py-4 text-sm">
                                                                                {compra.sucursales?.nombre ||
                                                                                    "Sin sucursal"}
                                                                            </td>

                                                                            <td className="px-5 py-4 text-sm">
                                                                                {formatearFecha(
                                                                                    compra.created_at
                                                                                )}
                                                                            </td>

                                                                            <td className="px-5 py-4 text-right text-sm font-bold">
                                                                                {formatearMoneda(
                                                                                    compra.total
                                                                                )}
                                                                            </td>

                                                                            <td className="px-5 py-4 text-center">

                                                                                <span
                                                                                    className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                                                                    style={
                                                                                        compra.estado ===
                                                                                            "recibida"
                                                                                            ? {
                                                                                                backgroundColor:
                                                                                                    "color-mix(in srgb, var(--color-success) 12%, var(--color-surface))",
                                                                                                color:
                                                                                                    "var(--color-success)",
                                                                                            }
                                                                                            : {
                                                                                                backgroundColor:
                                                                                                    "color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-surface))",
                                                                                                color:
                                                                                                    "var(--color-text-secondary)",
                                                                                            }
                                                                                    }
                                                                                >
                                                                                    {compra.estado ===
                                                                                        "recibida"
                                                                                        ? "Recibida"
                                                                                        : compra.estado ===
                                                                                            "cancelada"
                                                                                            ? "Cancelada"
                                                                                            : compra.estado}
                                                                                </span>

                                                                            </td>

                                                                            <td className="px-5 py-4 text-right">

                                                                                {cuenta ? (
                                                                                    <div className="space-y-2">

                                                                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                                                                            Pendiente:{" "}
                                                                                            <strong>
                                                                                                {formatearMoneda(
                                                                                                    cuenta.monto_pendiente
                                                                                                )}
                                                                                            </strong>
                                                                                        </p>

                                                                                        {cuenta.estado !==
                                                                                            "pagada" &&
                                                                                            cuenta.estado !==
                                                                                            "cancelada" &&
                                                                                            Number(
                                                                                                cuenta.monto_pendiente
                                                                                            ) >
                                                                                            0 && (
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
                                                                                                    💳 Registrar pago
                                                                                                </Button>
                                                                                            )}

                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-xs text-[var(--color-text-secondary)]">
                                                                                        Sin cuenta
                                                                                    </span>
                                                                                )}

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

                                        {/* =================================================
                                            CUENTAS POR PAGAR
                                        ================================================== */}

                                        <Card className="overflow-hidden p-0">

                                            <div className="border-b border-[var(--color-border)] px-5 py-4">

                                                <h3 className="text-base font-bold">
                                                    Cuentas por pagar
                                                </h3>

                                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                    Saldos y estado de las cuentas
                                                    generadas por compras.
                                                </p>

                                            </div>

                                            {cuentasProveedor.length === 0 ? (
                                                <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
                                                    No hay cuentas por pagar.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">

                                                    <table className="w-full min-w-[950px]">

                                                        <thead>
                                                            <tr className={tableHeadClass}>

                                                                <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Compra
                                                                </th>

                                                                <th className="px-5 py-3 text-right text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Total
                                                                </th>

                                                                <th className="px-5 py-3 text-right text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Pagado
                                                                </th>

                                                                <th className="px-5 py-3 text-right text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Pendiente
                                                                </th>

                                                                <th className="px-5 py-3 text-center text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Estado
                                                                </th>

                                                                <th className="px-5 py-3 text-center text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Vencimiento
                                                                </th>

                                                                <th className="px-5 py-3 text-right text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Acción
                                                                </th>

                                                            </tr>
                                                        </thead>

                                                        <tbody className="divide-y divide-[var(--color-border)]">

                                                            {cuentasProveedor.map(
                                                                (cuenta) => {
                                                                    const estado =
                                                                        obtenerEstadoCuenta(
                                                                            cuenta.estado
                                                                        );

                                                                    return (
                                                                        <tr
                                                                            key={
                                                                                cuenta.id
                                                                            }
                                                                            className="transition hover:bg-[var(--color-background)]"
                                                                        >

                                                                            <td className="px-5 py-4">

                                                                                <p className="font-semibold">
                                                                                    #
                                                                                    {cuenta.compra_id.slice(
                                                                                        0,
                                                                                        8
                                                                                    )}
                                                                                </p>

                                                                            </td>

                                                                            <td className="px-5 py-4 text-right text-sm font-semibold">
                                                                                {formatearMoneda(
                                                                                    cuenta.monto_total
                                                                                )}
                                                                            </td>

                                                                            <td
                                                                                className="px-5 py-4 text-right text-sm font-semibold"
                                                                                style={{
                                                                                    color:
                                                                                        "var(--color-success)",
                                                                                }}
                                                                            >
                                                                                {formatearMoneda(
                                                                                    cuenta.monto_pagado
                                                                                )}
                                                                            </td>

                                                                            <td
                                                                                className="px-5 py-4 text-right text-sm font-bold"
                                                                                style={{
                                                                                    color:
                                                                                        "var(--color-danger)",
                                                                                }}
                                                                            >
                                                                                {formatearMoneda(
                                                                                    cuenta.monto_pendiente
                                                                                )}
                                                                            </td>

                                                                            <td className="px-5 py-4 text-center">

                                                                                <span
                                                                                    className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                                                                    style={
                                                                                        estado.estilo
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        estado.texto
                                                                                    }
                                                                                </span>

                                                                            </td>

                                                                            <td className="px-5 py-4 text-center text-sm">
                                                                                {formatearFechaSoloFecha(
                                                                                    cuenta.fecha_vencimiento
                                                                                )}
                                                                            </td>

                                                                            <td className="px-5 py-4 text-right">

                                                                                {cuenta.estado !==
                                                                                    "pagada" &&
                                                                                    cuenta.estado !==
                                                                                    "cancelada" &&
                                                                                    Number(
                                                                                        cuenta.monto_pendiente
                                                                                    ) >
                                                                                    0 && (
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
                                                                                            💳 Pagar
                                                                                        </Button>
                                                                                    )}

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

                                        {/* =================================================
                                            HISTORIAL DE PAGOS
                                        ================================================== */}

                                        <Card className="overflow-hidden p-0">

                                            <div className="border-b border-[var(--color-border)] px-5 py-4">

                                                <h3 className="text-base font-bold">
                                                    Historial de pagos
                                                </h3>

                                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                    Pagos registrados a este proveedor.
                                                </p>

                                            </div>

                                            {pagosProveedor.length === 0 ? (
                                                <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
                                                    No hay pagos registrados.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">

                                                    <table className="w-full min-w-[800px]">

                                                        <thead>
                                                            <tr className={tableHeadClass}>

                                                                <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Fecha
                                                                </th>

                                                                <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Cuenta
                                                                </th>

                                                                <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Método
                                                                </th>

                                                                <th className="px-5 py-3 text-right text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Monto
                                                                </th>

                                                                <th className="px-5 py-3 text-left text-xs font-bold uppercase text-[var(--color-text-secondary)]">
                                                                    Referencia
                                                                </th>

                                                            </tr>
                                                        </thead>

                                                        <tbody className="divide-y divide-[var(--color-border)]">

                                                            {pagosProveedor.map(
                                                                (pago) => (
                                                                    <tr
                                                                        key={
                                                                            pago.id
                                                                        }
                                                                        className="transition hover:bg-[var(--color-background)]"
                                                                    >

                                                                        <td className="px-5 py-4 text-sm">
                                                                            {formatearFecha(
                                                                                pago.created_at
                                                                            )}
                                                                        </td>

                                                                        <td className="px-5 py-4">

                                                                            <p className="text-sm font-semibold">
                                                                                #
                                                                                {pago.cuenta_por_pagar_id.slice(
                                                                                    0,
                                                                                    8
                                                                                )}
                                                                            </p>

                                                                        </td>

                                                                        <td className="px-5 py-4">

                                                                            <span
                                                                                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                                                                                style={{
                                                                                    backgroundColor:
                                                                                        "color-mix(in srgb, var(--color-primary) 10%, var(--color-surface))",
                                                                                    color:
                                                                                        "var(--color-primary)",
                                                                                }}
                                                                            >
                                                                                {obtenerNombreMetodo(
                                                                                    pago.metodo_pago
                                                                                )}
                                                                            </span>

                                                                        </td>

                                                                        <td
                                                                            className="px-5 py-4 text-right text-sm font-bold"
                                                                            style={{
                                                                                color:
                                                                                    "var(--color-success)",
                                                                            }}
                                                                        >
                                                                            {formatearMoneda(
                                                                                pago.monto
                                                                            )}
                                                                        </td>

                                                                        <td className="px-5 py-4 text-sm">
                                                                            {pago.referencia ||
                                                                                "Sin referencia"}
                                                                        </td>

                                                                    </tr>
                                                                )
                                                            )}

                                                        </tbody>

                                                    </table>

                                                </div>
                                            )}

                                        </Card>

                                    </div>
                                )}

                            </div>

                            <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-background)] px-6 py-4">

                                <div className="flex justify-end">

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="medium"
                                        onClick={
                                            cerrarDetalleProveedor
                                        }
                                    >
                                        Cerrar
                                    </Button>

                                </div>

                            </div>

                        </Card>
                    </div>
                )}

            {/* =================================================
                MODAL REGISTRAR PAGO
            ================================================== */}

            {modalPagoAbierto &&
                cuentaPagoSeleccionada && (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
                        onMouseDown={(e) => {
                            if (
                                e.target ===
                                e.currentTarget
                            ) {
                                cerrarModalPago();
                            }
                        }}
                    >

                        <Card className="w-full max-w-lg overflow-hidden p-0">

                            <div className="border-b border-[var(--color-border)] px-6 py-5">

                                <div className="flex items-start justify-between gap-4">

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Cuenta por pagar
                                        </p>

                                        <h2 className="mt-1 text-xl font-bold">
                                            Registrar pago
                                        </h2>

                                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                            Compra #
                                            {cuentaPagoSeleccionada.compra_id.slice(
                                                0,
                                                8
                                            )}
                                        </p>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="small"
                                        onClick={
                                            cerrarModalPago
                                        }
                                        disabled={pagando}
                                        className="h-10 w-10 !p-0 text-xl"
                                        aria-label="Cerrar"
                                    >
                                        ✕
                                    </Button>

                                </div>

                            </div>

                            <form
                                onSubmit={
                                    registrarPagoProveedor
                                }
                            >

                                <div className="space-y-5 px-6 py-5">

                                    <div
                                        className="rounded-xl p-4"
                                        style={{
                                            backgroundColor:
                                                "color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))",
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-4">

                                            <span
                                                className="text-sm"
                                                style={{
                                                    color:
                                                        "var(--color-danger)",
                                                }}
                                            >
                                                Saldo pendiente
                                            </span>

                                            <strong
                                                className="text-lg"
                                                style={{
                                                    color:
                                                        "var(--color-danger)",
                                                }}
                                            >
                                                {formatearMoneda(
                                                    cuentaPagoSeleccionada.monto_pendiente
                                                )}
                                            </strong>

                                        </div>
                                    </div>

                                    <div>

                                        <label className="mb-2 block text-sm font-medium">
                                            Monto a pagar *
                                        </label>

                                        <input
                                            type="number"
                                            min="0.01"
                                            max={Number(
                                                cuentaPagoSeleccionada.monto_pendiente
                                            )}
                                            step="0.01"
                                            value={
                                                formularioPago.monto
                                            }
                                            onChange={(e) =>
                                                setFormularioPago(
                                                    (actual) => ({
                                                        ...actual,
                                                        monto:
                                                            e.target.value,
                                                    })
                                                )
                                            }
                                            required
                                            className={inputClass}
                                        />

                                    </div>

                                    <div>

                                        <label className="mb-2 block text-sm font-medium">
                                            Método de pago *
                                        </label>

                                        <select
                                            value={
                                                formularioPago.metodo_pago
                                            }
                                            onChange={(e) =>
                                                setFormularioPago(
                                                    (actual) => ({
                                                        ...actual,
                                                        metodo_pago:
                                                            e.target.value,
                                                    })
                                                )
                                            }
                                            className={inputClass}
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

                                    <div>

                                        <label className="mb-2 block text-sm font-medium">
                                            Referencia
                                        </label>

                                        <input
                                            type="text"
                                            value={
                                                formularioPago.referencia
                                            }
                                            onChange={(e) =>
                                                setFormularioPago(
                                                    (actual) => ({
                                                        ...actual,
                                                        referencia:
                                                            e.target.value,
                                                    })
                                                )
                                            }
                                            placeholder="Folio, número de transferencia, etc."
                                            className={inputClass}
                                        />

                                    </div>

                                    <div>

                                        <label className="mb-2 block text-sm font-medium">
                                            Notas
                                        </label>

                                        <textarea
                                            rows={3}
                                            value={
                                                formularioPago.notas
                                            }
                                            onChange={(e) =>
                                                setFormularioPago(
                                                    (actual) => ({
                                                        ...actual,
                                                        notas:
                                                            e.target.value,
                                                    })
                                                )
                                            }
                                            placeholder="Notas opcionales..."
                                            className={`${inputClass} resize-none`}
                                        />

                                    </div>

                                </div>

                                <div className="border-t border-[var(--color-border)] bg-[var(--color-background)] px-6 py-4">

                                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="medium"
                                            onClick={
                                                cerrarModalPago
                                            }
                                            disabled={pagando}
                                        >
                                            Cancelar
                                        </Button>

                                        <Button
                                            type="submit"
                                            variant="primary"
                                            size="medium"
                                            disabled={pagando}
                                        >
                                            {pagando
                                                ? "Registrando..."
                                                : "Registrar pago"}
                                        </Button>

                                    </div>

                                </div>

                            </form>

                        </Card>

                    </div>
                )}

            {/* =================================================
                MODAL MENSAJES
            ================================================== */}

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
                textoBoton={
                    tipoMensaje ===
                        "confirmacion"
                        ? "Confirmar"
                        : "Aceptar"
                }
                textoCancelar="Cancelar"
                onCerrar={
                    cerrarModalMensaje
                }
                onConfirmar={
                    tipoMensaje ===
                        "confirmacion"
                        ? confirmarCambioEstadoProveedor
                        : undefined
                }
            />

        </div>
    );
}