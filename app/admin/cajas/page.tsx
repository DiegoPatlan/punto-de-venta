"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { verificarRol } from "../../../lib/auth/roleGuard";
import { obtenerUsuarioActual } from "../../../lib/auth/roleGuard";
import Card from "../../components/Card";
import { supabase } from "../../../lib/supabase";
import ModalMensaje from "../../components/ModalMensaje";

/*
 * =====================================================
 * TIPOS
 * =====================================================
 */

interface Sucursal {
    id: string;
    nombre: string;
}

interface Caja {
    id: string;
    sucursal_id: string;
    nombre: string;
    activo: boolean;
    created_at: string;
    sucursal: {
        nombre: string;
    } | null;
}

interface UsuarioActual {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

interface Usuario {
    id: string;
    nombre: string;
}

interface SesionCaja {
    id: string;
    caja_id: string;
    usuario_apertura_id: string;
    usuario_cierre_id: string | null;
    monto_inicial: number;
    monto_esperado: number | null;
    monto_real: number | null;
    diferencia: number | null;
    estado: string;
    fecha_apertura: string;
    fecha_cierre: string | null;

    usuario_apertura?: {
        nombre: string;
    } | null;

    usuario_cierre?: {
        nombre: string;
    } | null;
}

interface MovimientoCaja {
    id: string;
    sesion_caja_id: string;
    usuario_id: string;
    tipo: string;
    concepto: string;
    monto: number;
    referencia_id: string | null;
    created_at: string;

    usuario?: {
        nombre: string;
    } | null;

    usuario_autorizacion_id?: string | null;
    usuario_autorizador_id?: string | null;
}

interface Devolucion {
    id: string;
    sesion_caja_id: string | null;
    venta_id: string;
    usuario_id: string;
    monto_total: number;
    motivo: string | null;
    estado: string;
    created_at: string;
    metodo_reembolso: string;
}

interface Venta {
    id: string;
    sesion_caja_id: string;
    usuario_id: string;
    folio: number | string | null;
    estado: string;
    created_at: string;
}

interface Pago {
    id: string;
    venta_id: string;
    metodo_pago: string;
    monto: number;
    created_at: string;
    referencia: string | null;
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
}

interface Producto {
    id: string;
    nombre: string;
}

interface PagoProveedor {
    id: string;
    proveedor_id: string;
    monto: number;
}

interface Proveedor {
    id: string;
    nombre: string;
}

interface AbonoCliente {
    id: string;
    cliente_id: string;
    monto: number;
}

interface Cliente {
    id: string;
    nombre: string;
}

/*
 * =====================================================
 * COMPONENTE
 * =====================================================
 */

export default function CajasPage() {
    const router = useRouter();

    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [cajas, setCajas] =
        useState<Caja[]>([]);

    const [sucursales, setSucursales] =
        useState<Sucursal[]>([]);

    const [cargando, setCargando] =
        useState(true);

    const [guardando, setGuardando] =
        useState(false);

    const [error, setError] =
        useState("");

    const [mensajeExito, setMensajeExito] =
        useState("");

    const [modalAbierto, setModalAbierto] =
        useState(false);

    const [editando, setEditando] =
        useState<Caja | null>(null);

    const [sucursalId, setSucursalId] =
        useState("");

    const [nombre, setNombre] =
        useState("");

    const [activo, setActivo] =
        useState(true);

    const [historialAbierto, setHistorialAbierto] =
        useState(false);

    const [cajaHistorial, setCajaHistorial] =
        useState<Caja | null>(null);

    const [sesiones, setSesiones] =
        useState<SesionCaja[]>([]);

    const [movimientos, setMovimientos] =
        useState<MovimientoCaja[]>([]);

    const [cargandoHistorial, setCargandoHistorial] =
        useState(false);

    const [errorHistorial, setErrorHistorial] =
        useState("");

    const [fechaDesde, setFechaDesde] =
        useState("");

    const [fechaHasta, setFechaHasta] =
        useState("");

    const [fechaDesdeAplicada, setFechaDesdeAplicada] =
        useState("");

    const [fechaHastaAplicada, setFechaHastaAplicada] =
        useState("");

    const [confirmacionEstadoAbierta, setConfirmacionEstadoAbierta] =
        useState(false);

    const [cajaCambioEstado, setCajaCambioEstado] =
        useState<Caja | null>(null);

    const [modalMensaje, setModalMensaje] = useState<{
        abierto: boolean;
        tipo:
        | "info"
        | "error"
        | "exito"
        | "confirmacion";
        titulo: string;
        mensaje: string;
    }>({
        abierto: false,
        tipo: "info",
        titulo: "",
        mensaje: "",
    });

    /*
     * =====================================================
     * MENSAJES
     * =====================================================
     */

    function mostrarMensaje(
        tipo:
            | "info"
            | "error"
            | "exito"
            | "confirmacion",
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

    function cerrarModalMensaje() {
        setModalMensaje((actual) => ({
            ...actual,
            abierto: false,
        }));
    }

    /*
     * =====================================================
     * RANGO DE FECHAS
     * =====================================================
     */

    function obtenerRangoFechas(
        desde: string,
        hasta: string
    ) {
        const inicio = desde
            ? new Date(`${desde}T00:00:00`)
            : null;

        const fin = hasta
            ? new Date(`${hasta}T00:00:00`)
            : null;

        if (
            inicio &&
            Number.isNaN(inicio.getTime())
        ) {
            throw new Error(
                "La fecha inicial no es válida."
            );
        }

        if (
            fin &&
            Number.isNaN(fin.getTime())
        ) {
            throw new Error(
                "La fecha final no es válida."
            );
        }

        if (
            inicio &&
            fin &&
            inicio > fin
        ) {
            throw new Error(
                "La fecha inicial no puede ser posterior a la fecha final."
            );
        }

        if (fin) {
            fin.setDate(
                fin.getDate() + 1
            );
        }

        return {
            inicio,
            fin,
        };
    }

    /*
     * =====================================================
     * CARGAR CAJAS
     * =====================================================
     */

    async function cargarDatos() {
        setCargando(true);
        setError("");
        setMensajeExito("");

        try {
            const usuarioActual =
                (await obtenerUsuarioActual()) as
                | UsuarioActual
                | null;

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

            setUsuario(usuarioActual);

            /*
             * -------------------------------------------------
             * SUCURSALES
             * -------------------------------------------------
             */

            const {
                data: sucursalesData,
                error: errorSucursales,
            } = await supabase
                .from("sucursales")
                .select("id,nombre")
                .eq(
                    "negocio_id",
                    usuarioActual.negocio_id
                )
                .order("nombre");

            if (errorSucursales) {
                console.error(
                    "Error cargando sucursales:",
                    errorSucursales
                );

                throw new Error(
                    errorSucursales.message ||
                    "No se pudieron cargar las sucursales."
                );
            }

            setSucursales(
                (sucursalesData as Sucursal[]) ??
                []
            );

            /*
             * -------------------------------------------------
             * CAJAS
             *
             * IMPORTANTE:
             * cajas NO tiene negocio_id.
             * La relación es cajas -> sucursales -> negocio.
             * RLS controla el acceso.
             * -------------------------------------------------
             */

            const {
                data: cajasData,
                error: errorCajas,
            } = await supabase
                .from("cajas")
                .select(`
                    id,
                    sucursal_id,
                    nombre,
                    activo,
                    created_at,
                    sucursal:sucursales(
                        nombre
                    )
                `)
                .order(
                    "created_at",
                    {
                        ascending: true,
                    }
                );

            if (errorCajas) {
                console.error(
                    "Error cargando cajas:",
                    errorCajas
                );

                throw new Error(
                    errorCajas.message ||
                    "No se pudieron cargar las cajas."
                );
            }

            const cajasNormalizadas: Caja[] =
                (cajasData ?? []).map(
                    (caja) => ({
                        id: caja.id,
                        sucursal_id:
                            caja.sucursal_id,
                        nombre:
                            caja.nombre,
                        activo:
                            caja.activo,
                        created_at:
                            caja.created_at,
                        sucursal:
                            Array.isArray(
                                caja.sucursal
                            )
                                ? caja.sucursal[0] ??
                                null
                                : caja.sucursal ??
                                null,
                    })
                );

            setCajas(
                cajasNormalizadas
            );
        } catch (error) {
            console.error(
                "Error cargando cajas:",
                error
            );

            const mensaje =
                error instanceof Error
                    ? error.message
                    : "Ocurrió un error al cargar la información de cajas.";

            setError(mensaje);

            mostrarMensaje(
                "error",
                "Error al cargar cajas",
                mensaje
            );
        } finally {
            setCargando(false);
        }
    }

    /*
     * =====================================================
     * INICIO
     * =====================================================
     */

    useEffect(() => {
        async function iniciar() {
            const permitido =
                await verificarRol([
                    "admin",
                    "encargado",
                    "cajero",
                ]);

            if (!permitido) {
                router.push("/admin");
                return;
            }

            await cargarDatos();
        }

        iniciar();
    }, [router]);

    /*
     * =====================================================
     * CREAR / EDITAR CAJA
     * =====================================================
     */

    function abrirNuevaCaja() {
        setEditando(null);

        setSucursalId(
            sucursales.length === 1
                ? sucursales[0].id
                : ""
        );

        setNombre("");
        setActivo(true);
        setError("");
        setModalAbierto(true);
    }

    function abrirEditarCaja(
        caja: Caja
    ) {
        setEditando(caja);
        setSucursalId(
            caja.sucursal_id
        );
        setNombre(caja.nombre);
        setActivo(caja.activo);
        setError("");
        setModalAbierto(true);
    }

    function cerrarModal() {
        if (guardando) {
            return;
        }

        setModalAbierto(false);
        setEditando(null);
        setSucursalId("");
        setNombre("");
        setActivo(true);
    }

    async function guardarCaja() {
        const nombreLimpio =
            nombre.trim();

        if (!sucursalId) {
            mostrarMensaje(
                "error",
                "Sucursal requerida",
                "Selecciona la sucursal a la que pertenece la caja."
            );

            return;
        }

        if (!nombreLimpio) {
            mostrarMensaje(
                "error",
                "Nombre requerido",
                "Escribe el nombre de la caja."
            );

            return;
        }

        if (!usuario?.id) {
            mostrarMensaje(
                "error",
                "Usuario no disponible",
                "No se pudo identificar al usuario actual."
            );

            return;
        }

        setGuardando(true);

        try {
            if (editando) {
                const {
                    error: errorActualizar,
                } = await supabase
                    .from("cajas")
                    .update({
                        sucursal_id:
                            sucursalId,
                        nombre:
                            nombreLimpio,
                        activo,
                    })
                    .eq(
                        "id",
                        editando.id
                    );

                if (errorActualizar) {
                    throw new Error(
                        errorActualizar.message ||
                        "No se pudo actualizar la caja."
                    );
                }

                setMensajeExito(
                    "Caja actualizada correctamente."
                );

                mostrarMensaje(
                    "exito",
                    "Caja actualizada",
                    "La información de la caja se actualizó correctamente."
                );
            } else {
                const {
                    error: errorInsertar,
                } = await supabase
                    .from("cajas")
                    .insert({
                        sucursal_id:
                            sucursalId,
                        nombre:
                            nombreLimpio,
                        activo,
                    });

                if (errorInsertar) {
                    throw new Error(
                        errorInsertar.message ||
                        "No se pudo crear la caja."
                    );
                }

                setMensajeExito(
                    "Caja creada correctamente."
                );

                mostrarMensaje(
                    "exito",
                    "Caja creada",
                    "La nueva caja se registró correctamente."
                );
            }

            cerrarModal();

            await cargarDatos();
        } catch (error) {
            console.error(
                "Error guardando caja:",
                error
            );

            const mensaje =
                error instanceof Error
                    ? error.message
                    : "Ocurrió un error al guardar la caja.";

            setError(mensaje);

            mostrarMensaje(
                "error",
                "No se pudo guardar",
                mensaje
            );
        } finally {
            setGuardando(false);
        }
    }

    /*
     * =====================================================
     * ACTIVAR / DESACTIVAR
     * =====================================================
     */

    function cambiarEstado(
        caja: Caja
    ) {
        setCajaCambioEstado(caja);
        setConfirmacionEstadoAbierta(
            true
        );
    }

    async function confirmarCambioEstado() {
        if (!cajaCambioEstado) {
            return;
        }

        const caja =
            cajaCambioEstado;

        const nuevoEstado =
            !caja.activo;

        setGuardando(true);

        try {
            const {
                error: errorActualizar,
            } = await supabase
                .from("cajas")
                .update({
                    activo:
                        nuevoEstado,
                })
                .eq(
                    "id",
                    caja.id
                );

            if (errorActualizar) {
                throw new Error(
                    errorActualizar.message ||
                    "No se pudo cambiar el estado de la caja."
                );
            }

            setConfirmacionEstadoAbierta(
                false
            );

            setCajaCambioEstado(
                null
            );

            await cargarDatos();

            mostrarMensaje(
                "exito",
                nuevoEstado
                    ? "Caja activada"
                    : "Caja desactivada",
                nuevoEstado
                    ? "La caja está activa nuevamente."
                    : "La caja fue desactivada correctamente."
            );
        } catch (error) {
            console.error(
                "Error cambiando estado:",
                error
            );

            const mensaje =
                error instanceof Error
                    ? error.message
                    : "Ocurrió un error al cambiar el estado de la caja.";

            setError(mensaje);

            mostrarMensaje(
                "error",
                "No se pudo cambiar el estado",
                mensaje
            );
        } finally {
            setGuardando(false);
        }
    }

    /*
     * =====================================================
     * HISTORIAL
     * =====================================================
     */

    async function cargarHistorial(
        caja: Caja,
        desde: string = fechaDesdeAplicada,
        hasta: string = fechaHastaAplicada
    ) {
        setCargandoHistorial(
            true
        );

        setErrorHistorial("");

        try {
            const {
                inicio,
                fin,
            } =
                obtenerRangoFechas(
                    desde,
                    hasta
                );

            /*
             * -------------------------------------------------
             * SESIONES
             *
             * Buscamos sesiones que se crucen con el periodo.
             * Esto permite que una sesión abierta un día y
             * cerrada otro siga apareciendo correctamente.
             * -------------------------------------------------
             */

            let query = supabase
                .from("sesiones_caja")
                .select(`
                    id,
                    caja_id,
                    usuario_apertura_id,
                    usuario_cierre_id,
                    monto_inicial,
                    monto_esperado,
                    monto_real,
                    diferencia,
                    estado,
                    fecha_apertura,
                    fecha_cierre
                `)
                .eq(
                    "caja_id",
                    caja.id
                )
                .order(
                    "fecha_apertura",
                    {
                        ascending: false,
                    }
                );

            if (inicio && fin) {
                query = query
                    .lt(
                        "fecha_apertura",
                        fin.toISOString()
                    )
                    .or(
                        `fecha_cierre.is.null,fecha_cierre.gte.${inicio.toISOString()}`
                    );
            } else if (inicio) {
                query = query.or(
                    `fecha_cierre.is.null,fecha_cierre.gte.${inicio.toISOString()}`
                );
            } else if (fin) {
                query = query.lt(
                    "fecha_apertura",
                    fin.toISOString()
                );
            }

            const {
                data: sesionesData,
                error: sesionesError,
            } = await query;

            if (sesionesError) {
                console.error(
                    "Error cargando sesiones:",
                    sesionesError
                );

                throw new Error(
                    sesionesError.message ||
                    "No se pudieron cargar las sesiones de caja."
                );
            }

            const sesionesBase =
                (sesionesData as SesionCaja[]) ??
                [];

            /*
             * -------------------------------------------------
             * USUARIOS DE SESIONES
             * -------------------------------------------------
             */

            const idsUsuarios =
                Array.from(
                    new Set(
                        sesionesBase
                            .flatMap(
                                (
                                    sesion
                                ) => [
                                        sesion.usuario_apertura_id,
                                        sesion.usuario_cierre_id,
                                    ]
                            )
                            .filter(
                                (
                                    id
                                ): id is string =>
                                    Boolean(id)
                            )
                    )
                );

            let usuariosMap =
                new Map<
                    string,
                    Usuario
                >();

            if (
                idsUsuarios.length >
                0
            ) {
                const {
                    data: usuariosData,
                    error: usuariosError,
                } = await supabase
                    .from("usuarios")
                    .select(
                        "id,nombre"
                    )
                    .in(
                        "id",
                        idsUsuarios
                    );

                if (usuariosError) {
                    console.error(
                        "Error cargando usuarios:",
                        usuariosError
                    );
                } else {
                    usuariosMap =
                        new Map(
                            (
                                (usuariosData as Usuario[]) ??
                                []
                            ).map(
                                (
                                    usuario
                                ) => [
                                        usuario.id,
                                        usuario,
                                    ]
                            )
                        );
                }
            }

            const sesionesNormalizadas: SesionCaja[] =
                sesionesBase.map(
                    (
                        sesion
                    ) => ({
                        ...sesion,
                        usuario_apertura:
                            usuariosMap.get(
                                sesion.usuario_apertura_id
                            ) ??
                            null,
                        usuario_cierre:
                            sesion.usuario_cierre_id
                                ? usuariosMap.get(
                                    sesion.usuario_cierre_id
                                ) ??
                                null
                                : null,
                    })
                );

            setSesiones(
                sesionesNormalizadas
            );

            if (
                sesionesNormalizadas.length ===
                0
            ) {
                setMovimientos(
                    []
                );

                return;
            }

            const idsSesiones =
                sesionesNormalizadas.map(
                    (
                        sesion
                    ) =>
                        sesion.id
                );

            /*
             * =================================================
             * MOVIMIENTOS REALES DE CAJA
             * =================================================
             */

            const {
                data: movimientosData,
                error: movimientosError,
            } = await supabase
                .from(
                    "movimientos_caja"
                )
                .select(`
                    id,
                    sesion_caja_id,
                    usuario_id,
                    tipo,
                    concepto,
                    monto,
                    referencia_id,
                    created_at,
                    usuario_autorizacion_id,
                    usuario_autorizador_id
                `)
                .in(
                    "sesion_caja_id",
                    idsSesiones
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (movimientosError) {
                console.error(
                    "Error cargando movimientos:",
                    movimientosError
                );

                throw new Error(
                    movimientosError.message ||
                    "No se pudieron cargar los movimientos de caja."
                );
            }

            const movimientosBase: MovimientoCaja[] =
                (movimientosData as MovimientoCaja[]) ??
                [];

            /*
             * =================================================
             * VENTAS
             * =================================================
             */

            const {
                data: ventasData,
                error: ventasError,
            } = await supabase
                .from("ventas")
                .select(`
                    id,
                    sesion_caja_id,
                    usuario_id,
                    folio,
                    estado,
                    created_at
                `)
                .in(
                    "sesion_caja_id",
                    idsSesiones
                );

            if (ventasError) {
                console.error(
                    "Error cargando ventas:",
                    ventasError
                );
            }

            const ventas =
                (ventasData as Venta[]) ??
                [];

            /*
             * =================================================
             * PAGOS DE LAS VENTAS
             *
             * Aquí reconstruimos TODAS las ventas desde pagos.
             *
             * Esto permite mostrar:
             * - efectivo
             * - tarjeta
             * - transferencia
             * - crédito
             * - mixto
             *
             * Si una venta ya tenía movimiento en
             * movimientos_caja, eliminamos ese movimiento
             * de la representación de venta y utilizamos
             * pagos como fuente de presentación.
             * =================================================
             */

            let movimientosVentas: MovimientoCaja[] =
                [];

            const idsVentas =
                ventas.map(
                    (
                        venta
                    ) => venta.id
                );

            if (
                idsVentas.length >
                0
            ) {
                const {
                    data: pagosData,
                    error: pagosError,
                } = await supabase
                    .from("pagos")
                    .select(`
                        id,
                        venta_id,
                        metodo_pago,
                        monto,
                        created_at,
                        referencia
                    `)
                    .in(
                        "venta_id",
                        idsVentas
                    );

                if (pagosError) {
                    console.error(
                        "Error cargando pagos:",
                        pagosError
                    );
                } else {
                    const pagos =
                        (pagosData as Pago[]) ??
                        [];

                    movimientosVentas =
                        [];

                    for (
                        const pago of pagos
                    ) {
                        const venta =
                            ventas.find(
                                (
                                    venta
                                ) =>
                                    venta.id ===
                                    pago.venta_id
                            );

                        if (
                            !venta
                        ) {
                            continue;
                        }

                        const metodo =
                            pago.metodo_pago
                                ?.trim()
                                .toLowerCase();

                        let textoMetodo =
                            "Pago";

                        if (
                            metodo ===
                            "efectivo" ||
                            metodo ===
                            "cash"
                        ) {
                            textoMetodo =
                                "Efectivo";
                        } else if (
                            metodo ===
                            "tarjeta" ||
                            metodo ===
                            "card" ||
                            metodo ===
                            "debito" ||
                            metodo ===
                            "débito" ||
                            metodo ===
                            "credito" ||
                            metodo ===
                            "crédito"
                        ) {
                            textoMetodo =
                                "Tarjeta";
                        } else if (
                            metodo ===
                            "transferencia" ||
                            metodo ===
                            "transfer"
                        ) {
                            textoMetodo =
                                "Transferencia";
                        } else if (
                            metodo ===
                            "mixto"
                        ) {
                            textoMetodo =
                                "Mixto";
                        }

                        movimientosVentas.push(
                            {
                                id: `venta-pago-${pago.id}`,
                                sesion_caja_id:
                                    venta.sesion_caja_id,
                                usuario_id:
                                    venta.usuario_id,
                                tipo:
                                    "venta",
                                concepto:
                                    `Venta #${venta.folio ?? "—"} — ${textoMetodo}`,
                                monto:
                                    Number(
                                        pago.monto
                                    ) || 0,
                                referencia_id:
                                    venta.id,
                                created_at:
                                    pago.created_at ??
                                    venta.created_at,
                                usuario:
                                    usuariosMap.get(
                                        venta.usuario_id
                                    ) ??
                                    null,
                            }
                        );
                    }
                }
            }

            /*
             * -------------------------------------------------
             * Eliminar de movimientosBase las ventas que ya
             * están representadas por pagos.
             *
             * Esto evita:
             *
             * movimiento real Venta $120
             * +
             * pago Venta $120
             *
             * = $240 mostrado.
             *
             * La fuente detallada para ventas será pagos.
             * -------------------------------------------------
             */

            const idsVentasSet =
                new Set(
                    ventas.map(
                        (
                            venta
                        ) =>
                            venta.id
                    )
                );

            const movimientosNoVenta =
                movimientosBase.filter(
                    (
                        movimiento
                    ) => {
                        const esReferenciaVenta =
                            Boolean(
                                movimiento.referencia_id &&
                                idsVentasSet.has(
                                    movimiento.referencia_id
                                )
                            );

                        const concepto =
                            movimiento.concepto
                                ?.trim()
                                .toLowerCase() ??
                            "";

                        const esMovimientoVenta =
                            concepto.includes(
                                "venta"
                            );

                        return !(
                            esReferenciaVenta &&
                            esMovimientoVenta
                        );
                    }
                );

            /*
             * =================================================
             * DEVOLUCIONES
             * =================================================
             */

            let movimientosDevoluciones: MovimientoCaja[] =
                [];

            const {
                data: devolucionesData,
                error: devolucionesError,
            } = await supabase
                .from(
                    "devoluciones"
                )
                .select(`
                    id,
                    sesion_caja_id,
                    venta_id,
                    usuario_id,
                    monto_total,
                    motivo,
                    estado,
                    created_at,
                    metodo_reembolso
                `)
                .in(
                    "sesion_caja_id",
                    idsSesiones
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (devolucionesError) {
                console.error(
                    "Error cargando devoluciones:",
                    devolucionesError
                );
            } else {
                const devoluciones =
                    (devolucionesData as Devolucion[]) ??
                    [];

                const devolucionesValidas =
                    devoluciones.filter(
                        (
                            devolucion
                        ) =>
                            devolucion.estado !==
                            "cancelada"
                    );

                if (
                    devolucionesValidas.length >
                    0
                ) {
                    const idsDevoluciones =
                        devolucionesValidas.map(
                            (
                                devolucion
                            ) =>
                                devolucion.id
                        );

                    const {
                        data: detallesData,
                        error: detallesError,
                    } = await supabase
                        .from(
                            "detalle_devoluciones"
                        )
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
                            total
                        `)
                        .in(
                            "devolucion_id",
                            idsDevoluciones
                        );

                    if (detallesError) {
                        console.error(
                            "Error cargando detalles de devolución:",
                            detallesError
                        );
                    } else {
                        const detalles =
                            (detallesData as DetalleDevolucion[]) ??
                            [];

                        const idsProductos =
                            Array.from(
                                new Set(
                                    detalles.map(
                                        (
                                            detalle
                                        ) =>
                                            detalle.producto_id
                                    )
                                )
                            );

                        const productosMap =
                            new Map<
                                string,
                                Producto
                            >();

                        if (
                            idsProductos.length >
                            0
                        ) {
                            const {
                                data: productosData,
                                error: productosError,
                            } = await supabase
                                .from(
                                    "productos"
                                )
                                .select(
                                    "id,nombre"
                                )
                                .in(
                                    "id",
                                    idsProductos
                                );

                            if (
                                productosError
                            ) {
                                console.error(
                                    "Error cargando productos:",
                                    productosError
                                );
                            } else {
                                for (
                                    const producto of
                                    (productosData as Producto[]) ??
                                    []
                                ) {
                                    productosMap.set(
                                        producto.id,
                                        producto
                                    );
                                }
                            }
                        }

                        movimientosDevoluciones =
                            devolucionesValidas.flatMap(
                                (
                                    devolucion
                                ) => {
                                    const detallesDevolucion =
                                        detalles.filter(
                                            (
                                                detalle
                                            ) =>
                                                detalle.devolucion_id ===
                                                devolucion.id
                                        );

                                    const metodo =
                                        devolucion.metodo_reembolso
                                            ?.trim()
                                            .toLowerCase();

                                    let textoMetodo =
                                        "Reembolso";

                                    if (
                                        metodo ===
                                        "efectivo" ||
                                        metodo ===
                                        "cash"
                                    ) {
                                        textoMetodo =
                                            "Efectivo";
                                    } else if (
                                        metodo ===
                                        "tarjeta" ||
                                        metodo ===
                                        "card" ||
                                        metodo ===
                                        "debito" ||
                                        metodo ===
                                        "débito" ||
                                        metodo ===
                                        "credito" ||
                                        metodo ===
                                        "crédito"
                                    ) {
                                        textoMetodo =
                                            "Tarjeta";
                                    } else if (
                                        metodo ===
                                        "transferencia" ||
                                        metodo ===
                                        "transfer"
                                    ) {
                                        textoMetodo =
                                            "Transferencia";
                                    }

                                    if (
                                        detallesDevolucion.length ===
                                        0
                                    ) {
                                        return [
                                            {
                                                id: `devolucion-${devolucion.id}`,
                                                sesion_caja_id:
                                                    devolucion.sesion_caja_id ??
                                                    "",
                                                usuario_id:
                                                    devolucion.usuario_id,
                                                tipo:
                                                    "devolucion",
                                                concepto:
                                                    `Devolución — ${textoMetodo}`,
                                                monto:
                                                    -Math.abs(
                                                        Number(
                                                            devolucion.monto_total
                                                        )
                                                    ),
                                                referencia_id:
                                                    devolucion.id,
                                                created_at:
                                                    devolucion.created_at,
                                                usuario:
                                                    usuariosMap.get(
                                                        devolucion.usuario_id
                                                    ) ??
                                                    null,
                                            },
                                        ];
                                    }

                                    return detallesDevolucion.map(
                                        (
                                            detalle
                                        ) => {
                                            const producto =
                                                productosMap.get(
                                                    detalle.producto_id
                                                );

                                            return {
                                                id: `devolucion-${devolucion.id}-${detalle.id}`,
                                                sesion_caja_id:
                                                    devolucion.sesion_caja_id ??
                                                    "",
                                                usuario_id:
                                                    devolucion.usuario_id,
                                                tipo:
                                                    "devolucion",
                                                concepto:
                                                    `Devolución — ${detalle.cantidad} x ${producto?.nombre ??
                                                    "Producto"
                                                    } — ${textoMetodo}`,
                                                monto:
                                                    -Math.abs(
                                                        Number(
                                                            detalle.total
                                                        )
                                                    ),
                                                referencia_id:
                                                    devolucion.id,
                                                created_at:
                                                    devolucion.created_at,
                                                usuario:
                                                    usuariosMap.get(
                                                        devolucion.usuario_id
                                                    ) ??
                                                    null,
                                            };
                                        }
                                    );
                                }
                            );
                    }
                }
            }

            /*
             * =================================================
             * PAGOS A PROVEEDORES
             *
             * pagos_proveedores NO tiene sesion_caja_id.
             *
             * La relación con caja es:
             *
             * movimientos_caja.referencia_id
             *             ↓
             * pagos_proveedores.id
             * =================================================
             */

            const movimientosPagoProveedor =
                movimientosNoVenta.filter(
                    (
                        movimiento
                    ) => {
                        const concepto =
                            movimiento.concepto
                                ?.trim()
                                .toLowerCase() ??
                            "";

                        return (
                            concepto.includes(
                                "pago a proveedor"
                            ) &&
                            Boolean(
                                movimiento.referencia_id
                            )
                        );
                    }
                );

            const idsPagosProveedor =
                Array.from(
                    new Set(
                        movimientosPagoProveedor
                            .map(
                                (
                                    movimiento
                                ) =>
                                    movimiento.referencia_id
                            )
                            .filter(
                                (
                                    id
                                ): id is string =>
                                    Boolean(id)
                            )
                    )
                );

            const pagosProveedorMap =
                new Map<
                    string,
                    PagoProveedor
                >();

            const proveedoresMap =
                new Map<
                    string,
                    Proveedor
                >();

            if (
                idsPagosProveedor.length >
                0
            ) {
                const {
                    data: pagosProveedorData,
                    error: pagosProveedorError,
                } = await supabase
                    .from(
                        "pagos_proveedores"
                    )
                    .select(
                        "id,proveedor_id,monto"
                    )
                    .in(
                        "id",
                        idsPagosProveedor
                    );

                if (
                    pagosProveedorError
                ) {
                    console.error(
                        "Error cargando pagos a proveedores:",
                        pagosProveedorError
                    );
                } else {
                    for (
                        const pago of
                        (pagosProveedorData as PagoProveedor[]) ??
                        []
                    ) {
                        pagosProveedorMap.set(
                            pago.id,
                            pago
                        );
                    }

                    const idsProveedores =
                        Array.from(
                            new Set(
                                (
                                    (pagosProveedorData as PagoProveedor[]) ??
                                    []
                                ).map(
                                    (
                                        pago
                                    ) =>
                                        pago.proveedor_id
                                )
                            )
                        );

                    if (
                        idsProveedores.length >
                        0
                    ) {
                        const {
                            data: proveedoresData,
                            error: proveedoresError,
                        } = await supabase
                            .from(
                                "proveedores"
                            )
                            .select(
                                "id,nombre"
                            )
                            .in(
                                "id",
                                idsProveedores
                            );

                        if (
                            proveedoresError
                        ) {
                            console.error(
                                "Error cargando proveedores:",
                                proveedoresError
                            );
                        } else {
                            for (
                                const proveedor of
                                (proveedoresData as Proveedor[]) ??
                                []
                            ) {
                                proveedoresMap.set(
                                    proveedor.id,
                                    proveedor
                                );
                            }
                        }
                    }
                }
            }

            /*
             * =================================================
             * ABONOS DE CLIENTES
             *
             * La relación con caja es:
             *
             * movimientos_caja.referencia_id
             *             ↓
             * abonos_clientes.id
             * =================================================
             */

            const movimientosAbonoCliente =
                movimientosNoVenta.filter(
                    (
                        movimiento
                    ) => {
                        const concepto =
                            movimiento.concepto
                                ?.trim()
                                .toLowerCase() ??
                            "";

                        return (
                            concepto.includes(
                                "abono de cliente"
                            ) &&
                            Boolean(
                                movimiento.referencia_id
                            )
                        );
                    }
                );

            const idsAbonosCliente =
                Array.from(
                    new Set(
                        movimientosAbonoCliente
                            .map(
                                (
                                    movimiento
                                ) =>
                                    movimiento.referencia_id
                            )
                            .filter(
                                (
                                    id
                                ): id is string =>
                                    Boolean(id)
                            )
                    )
                );

            const abonosClienteMap =
                new Map<
                    string,
                    AbonoCliente
                >();

            const clientesMap =
                new Map<
                    string,
                    Cliente
                >();

            if (
                idsAbonosCliente.length >
                0
            ) {
                const {
                    data: abonosData,
                    error: abonosError,
                } = await supabase
                    .from(
                        "abonos_clientes"
                    )
                    .select(
                        "id,cliente_id,monto"
                    )
                    .in(
                        "id",
                        idsAbonosCliente
                    );

                if (
                    abonosError
                ) {
                    console.error(
                        "Error cargando abonos de clientes:",
                        abonosError
                    );
                } else {
                    for (
                        const abono of
                        (abonosData as AbonoCliente[]) ??
                        []
                    ) {
                        abonosClienteMap.set(
                            abono.id,
                            abono
                        );
                    }

                    const idsClientes =
                        Array.from(
                            new Set(
                                (
                                    (abonosData as AbonoCliente[]) ??
                                    []
                                ).map(
                                    (
                                        abono
                                    ) =>
                                        abono.cliente_id
                                )
                            )
                        );

                    if (
                        idsClientes.length >
                        0
                    ) {
                        const {
                            data: clientesData,
                            error: clientesError,
                        } = await supabase
                            .from(
                                "clientes"
                            )
                            .select(
                                "id,nombre"
                            )
                            .in(
                                "id",
                                idsClientes
                            );

                        if (
                            clientesError
                        ) {
                            console.error(
                                "Error cargando clientes:",
                                clientesError
                            );
                        } else {
                            for (
                                const cliente of
                                (clientesData as Cliente[]) ??
                                []
                            ) {
                                clientesMap.set(
                                    cliente.id,
                                    cliente
                                );
                            }
                        }
                    }
                }
            }

            /*
             * =================================================
             * ENRIQUECER MOVIMIENTOS
             * =================================================
             */

            const movimientosEnriquecidos =
                movimientosNoVenta.map(
                    (
                        movimiento
                    ) => {
                        const referencia =
                            movimiento.referencia_id;

                        /*
                         * Pago a proveedor
                         */

                        if (
                            referencia &&
                            pagosProveedorMap.has(
                                referencia
                            )
                        ) {
                            const pagoProveedor =
                                pagosProveedorMap.get(
                                    referencia
                                );

                            const proveedor =
                                pagoProveedor
                                    ? proveedoresMap.get(
                                        pagoProveedor.proveedor_id
                                    )
                                    : null;

                            if (
                                proveedor
                            ) {
                                return {
                                    ...movimiento,
                                    concepto:
                                        `Pago a proveedor — ${proveedor.nombre}`,
                                };
                            }
                        }

                        /*
                         * Abono de cliente
                         */

                        if (
                            referencia &&
                            abonosClienteMap.has(
                                referencia
                            )
                        ) {
                            const abono =
                                abonosClienteMap.get(
                                    referencia
                                );

                            const cliente =
                                abono
                                    ? clientesMap.get(
                                        abono.cliente_id
                                    )
                                    : null;

                            if (
                                cliente
                            ) {
                                return {
                                    ...movimiento,
                                    concepto:
                                        `Abono de cliente — ${cliente.nombre}`,
                                };
                            }
                        }

                        return movimiento;
                    }
                );

            /*
             * =================================================
             * FILTRO FINAL DE FECHAS
             *
             * Las sesiones se filtran por solapamiento.
             * Los movimientos se filtran por su fecha real.
             * =================================================
             */

            const estaDentroDelRango =
                (
                    fecha: string
                ) => {
                    const fechaMovimiento =
                        new Date(
                            fecha
                        );

                    if (
                        Number.isNaN(
                            fechaMovimiento.getTime()
                        )
                    ) {
                        return false;
                    }

                    if (
                        inicio &&
                        fechaMovimiento <
                        inicio
                    ) {
                        return false;
                    }

                    if (
                        fin &&
                        fechaMovimiento >=
                        fin
                    ) {
                        return false;
                    }

                    return true;
                };

            const movimientosFiltrados =
                movimientosEnriquecidos.filter(
                    (
                        movimiento
                    ) =>
                        estaDentroDelRango(
                            movimiento.created_at
                        )
                );

            const ventasFiltradas =
                movimientosVentas.filter(
                    (
                        movimiento
                    ) =>
                        estaDentroDelRango(
                            movimiento.created_at
                        )
                );

            const devolucionesFiltradas =
                movimientosDevoluciones.filter(
                    (
                        movimiento
                    ) =>
                        estaDentroDelRango(
                            movimiento.created_at
                        )
                );

            /*
             * =================================================
             * COMBINAR TODO
             * =================================================
             */

            const movimientosCombinados =
                [
                    ...movimientosFiltrados,
                    ...ventasFiltradas,
                    ...devolucionesFiltradas,
                ].map(
                    (
                        movimiento
                    ) => ({
                        ...movimiento,
                        usuario:
                            movimiento.usuario ??
                            usuariosMap.get(
                                movimiento.usuario_id
                            ) ??
                            null,
                    })
                );

            /*
             * Orden cronológico descendente.
             */

            movimientosCombinados.sort(
                (
                    a,
                    b
                ) =>
                    new Date(
                        b.created_at
                    ).getTime() -
                    new Date(
                        a.created_at
                    ).getTime()
            );

            setMovimientos(
                movimientosCombinados
            );
        } catch (error) {
            console.error(
                "Error cargando historial:",
                error
            );

            const mensaje =
                error instanceof Error
                    ? error.message
                    : "Ocurrió un error al cargar el historial.";

            setErrorHistorial(
                mensaje
            );

            mostrarMensaje(
                "error",
                "No se pudo cargar el historial",
                mensaje
            );
        } finally {
            setCargandoHistorial(
                false
            );
        }
    }

    /*
     * =====================================================
     * ABRIR HISTORIAL
     * =====================================================
     */

    function abrirHistorial(
        caja: Caja
    ) {
        setCajaHistorial(caja);
        setHistorialAbierto(
            true
        );

        setFechaDesde("");
        setFechaHasta("");

        setFechaDesdeAplicada("");
        setFechaHastaAplicada("");

        setSesiones([]);
        setMovimientos([]);
        setErrorHistorial("");

        cargarHistorial(
            caja,
            "",
            ""
        );
    }

    /*
     * =====================================================
     * FILTRO DE FECHAS
     * =====================================================
     */

    async function aplicarFiltroFecha() {
        if (!cajaHistorial) {
            return;
        }

        if (
            fechaDesde &&
            fechaHasta &&
            fechaDesde >
            fechaHasta
        ) {
            mostrarMensaje(
                "error",
                "Rango de fechas inválido",
                "La fecha inicial no puede ser posterior a la fecha final."
            );

            return;
        }

        setFechaDesdeAplicada(
            fechaDesde
        );

        setFechaHastaAplicada(
            fechaHasta
        );

        await cargarHistorial(
            cajaHistorial,
            fechaDesde,
            fechaHasta
        );
    }

    async function limpiarFiltroFecha() {
        if (!cajaHistorial) {
            return;
        }

        setFechaDesde("");
        setFechaHasta("");

        setFechaDesdeAplicada("");
        setFechaHastaAplicada("");

        await cargarHistorial(
            cajaHistorial,
            "",
            ""
        );
    }

    /*
     * =====================================================
     * CERRAR HISTORIAL
     * =====================================================
     */

    function cerrarHistorial() {
        if (
            cargandoHistorial
        ) {
            return;
        }

        setHistorialAbierto(
            false
        );

        setCajaHistorial(
            null
        );

        setSesiones([]);
        setMovimientos([]);
        setErrorHistorial("");

        setFechaDesde("");
        setFechaHasta("");

        setFechaDesdeAplicada("");
        setFechaHastaAplicada("");
    }

    /*
     * =====================================================
     * FORMATEADORES
     * =====================================================
     */

    function formatearFecha(
        fecha: string
    ) {
        return new Date(
            fecha
        ).toLocaleDateString(
            "es-MX",
            {
                dateStyle:
                    "medium",
            }
        );
    }

    function formatearFechaHora(
        fecha: string
    ) {
        return new Date(
            fecha
        ).toLocaleString(
            "es-MX",
            {
                dateStyle:
                    "short",
                timeStyle:
                    "short",
            }
        );
    }

    function formatearMoneda(
        monto:
            | number
            | null
    ) {
        return new Intl.NumberFormat(
            "es-MX",
            {
                style:
                    "currency",
                currency:
                    "MXN",
            }
        ).format(
            Number(
                monto ?? 0
            )
        );
    }

    /*
     * =====================================================
     * ESTADOS
     * =====================================================
     */

    function textoEstadoSesion(
        estado: string
    ) {
        switch (
        estado?.toLowerCase()
        ) {
            case "abierta":
                return "Abierta";

            case "cerrada":
                return "Cerrada";

            default:
                return (
                    estado ||
                    "Sin estado"
                );
        }
    }

    function claseEstadoSesion(
        estado: string
    ) {
        switch (
        estado?.toLowerCase()
        ) {
            case "abierta":
                return "border-emerald-200 bg-emerald-50 text-emerald-700";

            case "cerrada":
                return "border-slate-200 bg-slate-100 text-slate-700";

            default:
                return "border-slate-200 bg-slate-50 text-slate-600";
        }
    }

    function claseTipoMovimiento(
        tipo: string
    ) {
        const tipoNormalizado =
            tipo
                ?.trim()
                .toLowerCase();

        if (
            tipoNormalizado.includes(
                "devol"
            )
        ) {
            return "border-rose-200 bg-rose-50 text-rose-700";
        }

        if (
            tipoNormalizado.includes(
                "transfer"
            )
        ) {
            return "border-violet-200 bg-violet-50 text-violet-700";
        }

        if (
            tipoNormalizado.includes(
                "retiro"
            ) ||
            tipoNormalizado.includes(
                "salida"
            )
        ) {
            return "border-amber-200 bg-amber-50 text-amber-700";
        }

        if (
            tipoNormalizado.includes(
                "entrada"
            )
        ) {
            return "border-sky-200 bg-sky-50 text-sky-700";
        }

        if (
            tipoNormalizado.includes(
                "venta"
            )
        ) {
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        }

        if (
            tipoNormalizado.includes(
                "abono"
            )
        ) {
            return "border-cyan-200 bg-cyan-50 text-cyan-700";
        }

        return "border-slate-200 bg-slate-50 text-slate-700";
    }

    /*
     * =====================================================
     * TOTALES
     * =====================================================
     */

    const totalCajas =
        cajas.length;

    const cajasActivas =
        cajas.filter(
            (
                caja
            ) =>
                caja.activo
        ).length;

    const cajasInactivas =
        cajas.filter(
            (
                caja
            ) =>
                !caja.activo
        ).length;

    /*
     * =====================================================
     * LOADING
     * =====================================================
     */

    if (cargando) {
        return (
            <main className="min-h-screen bg-[var(--color-background)] p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl space-y-6">
                    <div className="space-y-3">
                        <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                        <div className="h-9 w-52 animate-pulse rounded bg-slate-200" />
                        <div className="h-5 w-full max-w-xl animate-pulse rounded bg-slate-200" />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        {[1, 2, 3].map(
                            (
                                item
                            ) => (
                                <Card
                                    key={
                                        item
                                    }
                                    className="p-5"
                                >
                                    <div className="space-y-3">
                                        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                                        <div className="h-8 w-16 animate-pulse rounded bg-slate-200" />
                                    </div>
                                </Card>
                            )
                        )}
                    </div>

                    <Card className="overflow-hidden">
                        <div className="space-y-4 p-5">
                            {[
                                1,
                                2,
                                3,
                                4,
                                5,
                            ].map(
                                (
                                    item
                                ) => (
                                    <div
                                        key={
                                            item
                                        }
                                        className="h-12 animate-pulse rounded bg-slate-100"
                                    />
                                )
                            )}
                        </div>
                    </Card>
                </div>
            </main>
        );
    }

    /*
     * =====================================================
     * RENDER
     * =====================================================
     */

    return (
        <main className="min-h-screen bg-[var(--color-background)] p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">

                {/* =================================================
                    HEADER
                ================================================= */}

                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                            Administración
                        </p>

                        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-text)]">
                            Cajas
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
                            Administra las cajas de tus sucursales y consulta su historial de sesiones y movimientos.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={
                            abrirNuevaCaja
                        }
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
                    >
                        <span className="mr-2 text-lg">
                            +
                        </span>

                        Nueva caja
                    </button>
                </header>

                {/* =================================================
                    RESUMEN
                ================================================= */}

                <section className="grid gap-4 sm:grid-cols-3">

                    <Card className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-[var(--color-muted)]">
                                    Cajas registradas
                                </p>

                                <p className="mt-2 text-3xl font-bold text-[var(--color-text)]">
                                    {
                                        totalCajas
                                    }
                                </p>
                            </div>

                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-xl text-[var(--color-primary)]">
                                $
                            </div>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-[var(--color-muted)]">
                                    Cajas activas
                                </p>

                                <p className="mt-2 text-3xl font-bold text-emerald-600">
                                    {
                                        cajasActivas
                                    }
                                </p>
                            </div>

                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600">
                                ✓
                            </div>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-[var(--color-muted)]">
                                    Cajas inactivas
                                </p>

                                <p className="mt-2 text-3xl font-bold text-slate-600">
                                    {
                                        cajasInactivas
                                    }
                                </p>
                            </div>

                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-600">
                                —
                            </div>
                        </div>
                    </Card>

                </section>

                {/* =================================================
                    LISTADO
                ================================================= */}

                <Card className="overflow-hidden">

                    <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-[var(--color-text)]">
                                Cajas registradas
                            </h2>

                            <p className="mt-1 text-sm text-[var(--color-muted)]">
                                Consulta, edita y administra las cajas del negocio.
                            </p>
                        </div>

                        <span className="inline-flex w-fit items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
                            {
                                totalCajas
                            }{" "}
                            {
                                totalCajas ===
                                    1
                                    ? "caja"
                                    : "cajas"
                            }
                        </span>
                    </div>

                    {cajas.length ===
                        0 ? (
                        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">

                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500">
                                $
                            </div>

                            <h3 className="mt-4 text-base font-bold text-[var(--color-text)]">
                                No hay cajas registradas
                            </h3>

                            <p className="mt-2 max-w-md text-sm text-[var(--color-muted)]">
                                Registra la primera caja para comenzar a administrar las operaciones de efectivo.
                            </p>

                            <button
                                type="button"
                                onClick={
                                    abrirNuevaCaja
                                }
                                className="mt-5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                                Crear primera caja
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px]">
                                <thead>
                                    <tr className="border-b border-[var(--color-border)] bg-slate-50/80 text-left">
                                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                            Caja
                                        </th>

                                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                            Sucursal
                                        </th>

                                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                            Estado
                                        </th>

                                        <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-[var(--color-border)]">
                                    {cajas.map(
                                        (
                                            caja
                                        ) => (
                                            <tr
                                                key={
                                                    caja.id
                                                }
                                                className="transition hover:bg-slate-50/70"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 font-bold text-[var(--color-primary)]">
                                                            $
                                                        </div>

                                                        <div>
                                                            <p className="font-semibold text-[var(--color-text)]">
                                                                {
                                                                    caja.nombre
                                                                }
                                                            </p>

                                                            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                                                                Caja
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                                                        <span className="text-slate-400">
                                                            ◫
                                                        </span>

                                                        <span>
                                                            {
                                                                caja
                                                                    .sucursal
                                                                    ?.nombre ??
                                                                "Sin sucursal"
                                                            }
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span
                                                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${caja.activo
                                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                            : "border-slate-200 bg-slate-100 text-slate-600"
                                                            }`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${caja.activo
                                                                ? "bg-emerald-500"
                                                                : "bg-slate-400"
                                                                }`}
                                                        />

                                                        {
                                                            caja.activo
                                                                ? "Activa"
                                                                : "Inactiva"
                                                        }
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="flex flex-wrap justify-end gap-2">

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                abrirHistorial(
                                                                    caja
                                                                )
                                                            }
                                                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-slate-50"
                                                        >
                                                            Historial
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                abrirEditarCaja(
                                                                    caja
                                                                )
                                                            }
                                                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-slate-50"
                                                        >
                                                            Editar
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                cambiarEstado(
                                                                    caja
                                                                )
                                                            }
                                                            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${caja.activo
                                                                ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                                }`}
                                                        >
                                                            {
                                                                caja.activo
                                                                    ? "Desactivar"
                                                                    : "Activar"
                                                            }
                                                        </button>

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
            </div>

            {/* =====================================================
                MODAL NUEVA / EDITAR CAJA
            ===================================================== */}

            {modalAbierto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
                    onMouseDown={(
                        evento
                    ) => {
                        if (
                            evento.target ===
                            evento.currentTarget
                        ) {
                            cerrarModal();
                        }
                    }}
                >
                    <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">

                        <div className="border-b border-[var(--color-border)] p-5">
                            <div className="flex items-start gap-3">

                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-lg font-bold text-[var(--color-primary)]">
                                    $
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                                        {
                                            editando
                                                ? "Editar caja"
                                                : "Nueva caja"
                                        }
                                    </h2>

                                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                                        {
                                            editando
                                                ? "Actualiza la información de esta caja."
                                                : "Registra una nueva caja para una sucursal."
                                        }
                                    </p>
                                </div>

                            </div>
                        </div>

                        <div className="space-y-5 p-5">

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                    Sucursal
                                </label>

                                <select
                                    value={
                                        sucursalId
                                    }
                                    onChange={(
                                        evento
                                    ) =>
                                        setSucursalId(
                                            evento
                                                .target
                                                .value
                                        )
                                    }
                                    className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                                >
                                    <option value="">
                                        Selecciona una sucursal
                                    </option>

                                    {sucursales.map(
                                        (
                                            sucursal
                                        ) => (
                                            <option
                                                key={
                                                    sucursal.id
                                                }
                                                value={
                                                    sucursal.id
                                                }
                                            >
                                                {
                                                    sucursal.nombre
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                                    Nombre de la caja
                                </label>

                                <input
                                    type="text"
                                    value={
                                        nombre
                                    }
                                    onChange={(
                                        evento
                                    ) =>
                                        setNombre(
                                            evento
                                                .target
                                                .value
                                        )
                                    }
                                    placeholder="Ej. Caja principal"
                                    className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                                />
                            </div>

                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] p-4 transition hover:bg-slate-50">

                                <input
                                    type="checkbox"
                                    checked={
                                        activo
                                    }
                                    onChange={(
                                        evento
                                    ) =>
                                        setActivo(
                                            evento
                                                .target
                                                .checked
                                        )
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                />

                                <span>
                                    <span className="block text-sm font-semibold text-[var(--color-text)]">
                                        Caja activa
                                    </span>

                                    <span className="mt-1 block text-xs text-[var(--color-muted)]">
                                        La caja podrá utilizarse para operaciones cuando esté activa.
                                    </span>
                                </span>

                            </label>
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] p-5 sm:flex-row sm:justify-end">

                            <button
                                type="button"
                                onClick={
                                    cerrarModal
                                }
                                disabled={
                                    guardando
                                }
                                className="min-h-11 rounded-xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={
                                    guardarCaja
                                }
                                disabled={
                                    guardando
                                }
                                className="min-h-11 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {
                                    guardando
                                        ? "Guardando..."
                                        : editando
                                            ? "Guardar cambios"
                                            : "Guardar caja"
                                }
                            </button>

                        </div>
                    </div>
                </div>
            )}

            {/* =====================================================
                CONFIRMACIÓN ESTADO
            ===================================================== */}

            {confirmacionEstadoAbierta &&
                cajaCambioEstado && (
                    <div
                        className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
                        onMouseDown={(
                            evento
                        ) => {
                            if (
                                evento.target ===
                                evento.currentTarget
                            ) {
                                setConfirmacionEstadoAbierta(
                                    false
                                );

                                setCajaCambioEstado(
                                    null
                                );
                            }
                        }}
                    >
                        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">

                            <div className="p-6">
                                <div className="flex items-start gap-4">

                                    <div
                                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cajaCambioEstado.activo
                                            ? "bg-rose-50 text-rose-600"
                                            : "bg-emerald-50 text-emerald-600"
                                            }`}
                                    >
                                        {
                                            cajaCambioEstado.activo
                                                ? "!"
                                                : "✓"
                                        }
                                    </div>

                                    <div>
                                        <h2 className="text-lg font-bold text-[var(--color-text)]">
                                            {
                                                cajaCambioEstado.activo
                                                    ? "Desactivar caja"
                                                    : "Activar caja"
                                            }
                                        </h2>

                                        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                                            ¿Deseas{" "}
                                            {
                                                cajaCambioEstado.activo
                                                    ? "desactivar"
                                                    : "activar"
                                            }{" "}
                                            la caja{" "}
                                            <strong className="text-[var(--color-text)]">
                                                {
                                                    cajaCambioEstado.nombre
                                                }
                                            </strong>
                                            ?
                                        </p>
                                    </div>

                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] p-5 sm:flex-row sm:justify-end">

                                <button
                                    type="button"
                                    disabled={
                                        guardando
                                    }
                                    onClick={() => {
                                        setConfirmacionEstadoAbierta(
                                            false
                                        );

                                        setCajaCambioEstado(
                                            null
                                        );
                                    }}
                                    className="min-h-11 rounded-xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="button"
                                    disabled={
                                        guardando
                                    }
                                    onClick={
                                        confirmarCambioEstado
                                    }
                                    className={`min-h-11 rounded-xl px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${cajaCambioEstado.activo
                                        ? "bg-rose-600 hover:bg-rose-700"
                                        : "bg-emerald-600 hover:bg-emerald-700"
                                        }`}
                                >
                                    {
                                        guardando
                                            ? "Procesando..."
                                            : cajaCambioEstado.activo
                                                ? "Desactivar caja"
                                                : "Activar caja"
                                    }
                                </button>

                            </div>
                        </div>
                    </div>
                )}

            {/* =====================================================
                HISTORIAL
            ===================================================== */}

            {historialAbierto &&
                cajaHistorial && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">

                        <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">

                            {/* HEADER */}

                            <div className="shrink-0 border-b border-[var(--color-border)] p-4 sm:p-5">

                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                                    <div className="flex items-start gap-3">

                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-xl text-[var(--color-primary)]">
                                            ↺
                                        </div>

                                        <div>
                                            <h2 className="text-lg font-bold text-[var(--color-text)] sm:text-xl">
                                                Historial de{" "}
                                                {
                                                    cajaHistorial.nombre
                                                }
                                            </h2>

                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">

                                                <span>
                                                    {
                                                        cajaHistorial
                                                            .sucursal
                                                            ?.nombre ??
                                                        "Sin sucursal"
                                                    }
                                                </span>

                                                <span>
                                                    •
                                                </span>

                                                <span
                                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${cajaHistorial.activo
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                        : "border-slate-200 bg-slate-100 text-slate-600"
                                                        }`}
                                                >
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${cajaHistorial.activo
                                                            ? "bg-emerald-500"
                                                            : "bg-slate-400"
                                                            }`}
                                                    />

                                                    {
                                                        cajaHistorial.activo
                                                            ? "Activa"
                                                            : "Inactiva"
                                                    }
                                                </span>

                                            </div>
                                        </div>

                                    </div>

                                    <button
                                        type="button"
                                        onClick={
                                            cerrarHistorial
                                        }
                                        disabled={
                                            cargandoHistorial
                                        }
                                        className="self-end rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
                                    >
                                        Cerrar
                                    </button>

                                </div>
                            </div>

                            {/* CONTENIDO */}

                            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">

                                <div className="space-y-5">

                                    {/* FILTRO */}

                                    <Card className="p-4">

                                        <div className="flex flex-col gap-4">

                                            <div className="flex items-center gap-2">

                                                <span className="text-lg">
                                                    🔎
                                                </span>

                                                <div>
                                                    <h3 className="font-bold text-[var(--color-text)]">
                                                        Filtrar historial
                                                    </h3>

                                                    <p className="text-xs text-[var(--color-muted)]">
                                                        Las fechas filtran las sesiones y movimientos realizados dentro del periodo seleccionado.
                                                    </p>
                                                </div>

                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">

                                                <div>
                                                    <label className="mb-2 block text-xs font-semibold text-[var(--color-muted)]">
                                                        Desde
                                                    </label>

                                                    <input
                                                        type="date"
                                                        value={
                                                            fechaDesde
                                                        }
                                                        onChange={(
                                                            evento
                                                        ) =>
                                                            setFechaDesde(
                                                                evento
                                                                    .target
                                                                    .value
                                                            )
                                                        }
                                                        className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="mb-2 block text-xs font-semibold text-[var(--color-muted)]">
                                                        Hasta
                                                    </label>

                                                    <input
                                                        type="date"
                                                        value={
                                                            fechaHasta
                                                        }
                                                        onChange={(
                                                            evento
                                                        ) =>
                                                            setFechaHasta(
                                                                evento
                                                                    .target
                                                                    .value
                                                            )
                                                        }
                                                        className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                                                    />
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={
                                                        aplicarFiltroFecha
                                                    }
                                                    disabled={
                                                        cargandoHistorial
                                                    }
                                                    className="min-h-11 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {
                                                        cargandoHistorial
                                                            ? "Buscando..."
                                                            : "Buscar"
                                                    }
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={
                                                        limpiarFiltroFecha
                                                    }
                                                    disabled={
                                                        cargandoHistorial
                                                    }
                                                    className="min-h-11 rounded-xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    Limpiar
                                                </button>

                                            </div>

                                            {(fechaDesdeAplicada ||
                                                fechaHastaAplicada) && (
                                                    <div className="rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-4 py-3 text-xs text-[var(--color-text)]">
                                                        <span className="font-semibold">
                                                            Filtro aplicado:
                                                        </span>{" "}

                                                        {fechaDesdeAplicada
                                                            ? formatearFecha(
                                                                `${fechaDesdeAplicada}T00:00:00`
                                                            )
                                                            : "Inicio"}

                                                        {" → "}

                                                        {fechaHastaAplicada
                                                            ? formatearFecha(
                                                                `${fechaHastaAplicada}T00:00:00`
                                                            )
                                                            : "Actualidad"}
                                                    </div>
                                                )}

                                        </div>
                                    </Card>

                                    {/* RESUMEN HISTORIAL */}

                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                                        <Card className="p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                                                Sesiones
                                            </p>

                                            <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                                                {
                                                    sesiones.length
                                                }
                                            </p>
                                        </Card>

                                        <Card className="p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                                                Movimientos
                                            </p>

                                            <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                                                {
                                                    movimientos.length
                                                }
                                            </p>
                                        </Card>

                                        <Card className="p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                                                Estado actual
                                            </p>

                                            <div className="mt-2">
                                                <span
                                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${cajaHistorial.activo
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                        : "border-slate-200 bg-slate-100 text-slate-600"
                                                        }`}
                                                >
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${cajaHistorial.activo
                                                            ? "bg-emerald-500"
                                                            : "bg-slate-400"
                                                            }`}
                                                    />

                                                    {
                                                        cajaHistorial.activo
                                                            ? "Activa"
                                                            : "Inactiva"
                                                    }
                                                </span>
                                            </div>
                                        </Card>

                                        <Card className="p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                                                Última sesión
                                            </p>

                                            <p className="mt-2 text-sm font-bold text-[var(--color-text)]">
                                                {sesiones.length >
                                                    0
                                                    ? formatearFechaHora(
                                                        sesiones[0]
                                                            .fecha_apertura
                                                    )
                                                    : "Sin sesiones"}
                                            </p>
                                        </Card>

                                    </div>

                                    {/* SESIONES */}

                                    <Card className="overflow-hidden">

                                        <div className="border-b border-[var(--color-border)] p-4">

                                            <div className="flex items-center gap-2">

                                                <span className="text-lg">
                                                    ◷
                                                </span>

                                                <div>
                                                    <h3 className="font-bold text-[var(--color-text)]">
                                                        Sesiones de caja
                                                    </h3>

                                                    <p className="text-xs text-[var(--color-muted)]">
                                                        Aperturas y cierres registrados.
                                                    </p>
                                                </div>

                                            </div>
                                        </div>

                                        {sesiones.length ===
                                            0 ? (
                                            <div className="p-10 text-center">

                                                <p className="text-sm font-semibold text-[var(--color-text)]">
                                                    No hay sesiones en el periodo seleccionado
                                                </p>

                                                <p className="mt-1 text-xs text-[var(--color-muted)]">
                                                    Prueba con otro rango de fechas.
                                                </p>

                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">

                                                <table className="w-full min-w-[1050px]">

                                                    <thead>
                                                        <tr className="border-b border-[var(--color-border)] bg-slate-50/80 text-left">

                                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Apertura
                                                            </th>

                                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Cierre
                                                            </th>

                                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Usuario apertura
                                                            </th>

                                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Usuario cierre
                                                            </th>

                                                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Inicial
                                                            </th>

                                                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Esperado
                                                            </th>

                                                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Real
                                                            </th>

                                                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Diferencia
                                                            </th>

                                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Estado
                                                            </th>

                                                        </tr>
                                                    </thead>

                                                    <tbody className="divide-y divide-[var(--color-border)]">

                                                        {sesiones.map(
                                                            (
                                                                sesion
                                                            ) => (
                                                                <tr
                                                                    key={
                                                                        sesion.id
                                                                    }
                                                                    className="hover:bg-slate-50/70"
                                                                >

                                                                    <td className="px-4 py-4 text-sm text-[var(--color-text)]">
                                                                        {
                                                                            formatearFechaHora(
                                                                                sesion.fecha_apertura
                                                                            )
                                                                        }
                                                                    </td>

                                                                    <td className="px-4 py-4 text-sm text-[var(--color-text)]">
                                                                        {
                                                                            sesion.fecha_cierre
                                                                                ? formatearFechaHora(
                                                                                    sesion.fecha_cierre
                                                                                )
                                                                                : "—"
                                                                        }
                                                                    </td>

                                                                    <td className="px-4 py-4 text-sm text-[var(--color-text)]">
                                                                        {
                                                                            sesion
                                                                                .usuario_apertura
                                                                                ?.nombre ??
                                                                            "—"
                                                                        }
                                                                    </td>

                                                                    <td className="px-4 py-4 text-sm text-[var(--color-text)]">
                                                                        {
                                                                            sesion
                                                                                .usuario_cierre
                                                                                ?.nombre ??
                                                                            "—"
                                                                        }
                                                                    </td>

                                                                    <td className="px-4 py-4 text-right text-sm font-medium text-[var(--color-text)]">
                                                                        {
                                                                            formatearMoneda(
                                                                                sesion.monto_inicial
                                                                            )
                                                                        }
                                                                    </td>

                                                                    <td className="px-4 py-4 text-right text-sm font-medium text-[var(--color-text)]">
                                                                        {
                                                                            formatearMoneda(
                                                                                sesion.monto_esperado
                                                                            )
                                                                        }
                                                                    </td>

                                                                    <td className="px-4 py-4 text-right text-sm font-medium text-[var(--color-text)]">
                                                                        {
                                                                            formatearMoneda(
                                                                                sesion.monto_real
                                                                            )
                                                                        }
                                                                    </td>

                                                                    <td className="px-4 py-4 text-right">

                                                                        <span
                                                                            className={`text-sm font-bold ${Number(
                                                                                sesion.diferencia ??
                                                                                0
                                                                            ) ===
                                                                                0
                                                                                ? "text-emerald-600"
                                                                                : Number(
                                                                                    sesion.diferencia ??
                                                                                    0
                                                                                ) >
                                                                                    0
                                                                                    ? "text-sky-600"
                                                                                    : "text-rose-600"
                                                                                }`}
                                                                        >
                                                                            {
                                                                                formatearMoneda(
                                                                                    sesion.diferencia
                                                                                )
                                                                            }
                                                                        </span>

                                                                    </td>

                                                                    <td className="px-4 py-4">

                                                                        <span
                                                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${claseEstadoSesion(
                                                                                sesion.estado
                                                                            )}`}
                                                                        >
                                                                            {
                                                                                textoEstadoSesion(
                                                                                    sesion.estado
                                                                                )
                                                                            }
                                                                        </span>

                                                                    </td>

                                                                </tr>
                                                            )
                                                        )}

                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </Card>

                                    {/* MOVIMIENTOS */}

                                    <Card className="overflow-hidden">

                                        <div className="border-b border-[var(--color-border)] p-4">

                                            <div className="flex items-center gap-2">

                                                <span className="text-lg">
                                                    ↕
                                                </span>

                                                <div>
                                                    <h3 className="font-bold text-[var(--color-text)]">
                                                        Movimientos
                                                    </h3>

                                                    <p className="text-xs text-[var(--color-muted)]">
                                                        Ventas, pagos, devoluciones y operaciones registradas dentro del periodo seleccionado.
                                                    </p>
                                                </div>

                                            </div>
                                        </div>

                                        {movimientos.length ===
                                            0 ? (
                                            <div className="p-10 text-center">

                                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                                                    ↕
                                                </div>

                                                <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">
                                                    No hay movimientos en el periodo seleccionado
                                                </p>

                                                <p className="mt-1 text-xs text-[var(--color-muted)]">
                                                    Las ventas, transferencias, retiros, entradas y devoluciones aparecerán aquí cuando correspondan al rango.
                                                </p>

                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">

                                                <table className="w-full min-w-[900px]">

                                                    <thead>
                                                        <tr className="border-b border-[var(--color-border)] bg-slate-50/80 text-left">

                                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Fecha
                                                            </th>

                                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Tipo
                                                            </th>

                                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Concepto
                                                            </th>

                                                            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Usuario
                                                            </th>

                                                            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                                                                Monto
                                                            </th>

                                                        </tr>
                                                    </thead>

                                                    <tbody className="divide-y divide-[var(--color-border)]">

                                                        {movimientos.map(
                                                            (
                                                                movimiento
                                                            ) => (
                                                                <tr
                                                                    key={
                                                                        movimiento.id
                                                                    }
                                                                    className="hover:bg-slate-50/70"
                                                                >

                                                                    <td className="px-4 py-4 text-sm text-[var(--color-text)]">
                                                                        {
                                                                            formatearFechaHora(
                                                                                movimiento.created_at
                                                                            )
                                                                        }
                                                                    </td>

                                                                    <td className="px-4 py-4">

                                                                        <span
                                                                            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${claseTipoMovimiento(
                                                                                movimiento.tipo
                                                                            )}`}
                                                                        >
                                                                            {
                                                                                movimiento.tipo
                                                                            }
                                                                        </span>

                                                                    </td>

                                                                    <td className="px-4 py-4">

                                                                        <p className="max-w-md text-sm font-medium text-[var(--color-text)]">
                                                                            {
                                                                                movimiento.concepto
                                                                            }
                                                                        </p>

                                                                        {movimiento.referencia_id && (
                                                                            <p className="mt-1 max-w-md truncate text-xs text-[var(--color-muted)]">
                                                                                Ref:{" "}
                                                                                {
                                                                                    movimiento.referencia_id
                                                                                }
                                                                            </p>
                                                                        )}

                                                                    </td>

                                                                    <td className="px-4 py-4 text-sm text-[var(--color-text)]">
                                                                        {
                                                                            movimiento
                                                                                .usuario
                                                                                ?.nombre ??
                                                                            "—"
                                                                        }
                                                                    </td>

                                                                    <td className="px-4 py-4 text-right">

                                                                        <span
                                                                            className={`text-sm font-bold ${Number(
                                                                                movimiento.monto
                                                                            ) <
                                                                                0
                                                                                ? "text-rose-600"
                                                                                : "text-emerald-600"
                                                                                }`}
                                                                        >
                                                                            {
                                                                                formatearMoneda(
                                                                                    movimiento.monto
                                                                                )
                                                                            }
                                                                        </span>

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
                            </div>

                            {/* FOOTER */}

                            <div className="shrink-0 border-t border-[var(--color-border)] bg-slate-50/70 p-4 sm:p-5">

                                <div className="flex justify-end">

                                    <button
                                        type="button"
                                        onClick={
                                            cerrarHistorial
                                        }
                                        disabled={
                                            cargandoHistorial
                                        }
                                        className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Cerrar historial
                                    </button>

                                </div>
                            </div>

                        </div>
                    </div>
                )}

            {/* =====================================================
                MODAL DE MENSAJES
            ===================================================== */}

            <ModalMensaje
                abierto={
                    modalMensaje.abierto
                }
                tipo={
                    modalMensaje.tipo
                }
                titulo={
                    modalMensaje.titulo
                }
                mensaje={
                    modalMensaje.mensaje
                }
                onCerrar={
                    cerrarModalMensaje
                }
            />

        </main>
    );
}