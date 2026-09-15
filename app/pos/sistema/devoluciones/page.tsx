"use client";

import { useEffect, useState } from "react";
import ModalMensaje from "@/app/components/ModalMensaje";
import { supabasePOS } from "../../../../lib/supabase";

interface UsuarioPOS {
    id: string;
    auth_user_id: string;
    negocio_id: string;
    rol: string;
    activo: boolean;
}

interface SesionCaja {
    id: string;
    caja_id: string;
    usuario_apertura_id: string;
    monto_inicial: number;
    monto_esperado: number | null;
    estado: string;
    fecha_apertura: string;
}

interface Venta {
    id: string;
    folio: number;
    negocio_id: string;
    sucursal_id: string;
    caja_id: string;
    sesion_caja_id: string;
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
    metodo_pago: string;
    estado: string;
    referencia: string | null;
    created_at: string;
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
    producto?: {
        nombre: string;
        codigo_barras: string | null;
    } | null;
    cantidad_devuelta?: number;
    cantidad_disponible?: number;
}

interface DetalleDevolucion {
    detalle_venta_id: string;
    cantidad: number;
}

type MetodoReembolso =
    | "efectivo"
    | "tarjeta"
    | "transferencia"
    | "mixto";

export default function DevolucionesPage() {
    // =========================================================
    // USUARIO / SESIÓN
    // =========================================================

    const [usuario, setUsuario] =
        useState<UsuarioPOS | null>(null);

    const [sesionCaja, setSesionCaja] =
        useState<SesionCaja | null>(null);

    // =========================================================
    // ESTADOS GENERALES
    // =========================================================

    const [cargando, setCargando] =
        useState(true);

    const [buscando, setBuscando] =
        useState(false);

    const [procesando, setProcesando] =
        useState(false);

    const [mensaje, setMensaje] =
        useState("");

    const [error, setError] =
        useState("");

    // =========================================================
    // BÚSQUEDA
    // =========================================================

    const [ventaFolioBusqueda, setVentaFolioBusqueda] =
        useState("");

    const [venta, setVenta] =
        useState<Venta | null>(null);

    const [detalles, setDetalles] =
        useState<DetalleVenta[]>([]);

    // =========================================================
    // DEVOLUCIÓN
    // =========================================================

    const [cantidades, setCantidades] =
        useState<Record<string, number>>({});

    const [metodoReembolso, setMetodoReembolso] =
        useState<MetodoReembolso>("efectivo");

    const [motivo, setMotivo] =
        useState("");

    // =========================================================
    // REEMBOLSO MIXTO
    // =========================================================

    const [montoEfectivo, setMontoEfectivo] =
        useState("");

    const [montoTarjeta, setMontoTarjeta] =
        useState("");

    const [montoTransferencia, setMontoTransferencia] =
        useState("");

    // =========================================================
    // MODAL
    // =========================================================

    const [modal, setModal] = useState<{
        abierto: boolean;
        tipo: "info" | "error" | "exito" | "confirmacion";
        titulo: string;
        mensaje: string;
        confirmar?: () => void;
    }>({
        abierto: false,
        tipo: "info",
        titulo: "",
        mensaje: "",
    });

    // =========================================================
    // CARGAR USUARIO Y SESIÓN
    // =========================================================

    useEffect(() => {
        cargarContextoPOS();
    }, []);

    async function cargarContextoPOS() {
        try {
            setCargando(true);
            setError("");

            // -------------------------------------------------------
            // 1. USUARIO AUTENTICADO
            // -------------------------------------------------------

            const {
                data: authData,
                error: authError,
            } = await supabasePOS.auth.getUser();

            if (authError) {
                throw new Error(authError.message);
            }

            if (!authData.user) {
                throw new Error(
                    "No existe una sesión autenticada."
                );
            }

            // -------------------------------------------------------
            // 2. USUARIO DEL POS
            // -------------------------------------------------------

            const {
                data: usuarioData,
                error: usuarioError,
            } = await supabasePOS
                .from("usuarios")
                .select(
                    "id, auth_user_id, negocio_id, rol, activo"
                )
                .eq(
                    "auth_user_id",
                    authData.user.id
                )
                .eq("activo", true)
                .single();

            if (usuarioError) {
                throw new Error(
                    "No se pudo obtener el usuario del POS: " +
                    usuarioError.message
                );
            }

            if (!usuarioData) {
                throw new Error(
                    "El usuario autenticado no está registrado como usuario activo del POS."
                );
            }

            setUsuario(usuarioData);

            // -------------------------------------------------------
            // 3. SESIÓN DE CAJA ABIERTA
            // -------------------------------------------------------

            const {
                data: sesionData,
                error: sesionError,
            } = await supabasePOS
                .from("sesiones_caja")
                .select(
                    `
                    id,
                    caja_id,
                    usuario_apertura_id,
                    monto_inicial,
                    monto_esperado,
                    estado,
                    fecha_apertura
                    `
                )
                .eq(
                    "usuario_apertura_id",
                    usuarioData.id
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

            if (sesionError) {
                throw new Error(
                    "No se pudo obtener la sesión de caja: " +
                    sesionError.message
                );
            }

            if (!sesionData) {
                throw new Error(
                    "No tienes una caja abierta. Debes abrir una caja antes de realizar devoluciones."
                );
            }

            setSesionCaja(sesionData);
        } catch (err: any) {
            setError(
                err?.message ||
                "No se pudo cargar la información del POS."
            );
        } finally {
            setCargando(false);
        }
    }

    // =========================================================
    // MODAL
    // =========================================================

    function mostrarModal(
        tipo:
            | "info"
            | "error"
            | "exito"
            | "confirmacion",
        titulo: string,
        mensaje: string,
        confirmar?: () => void
    ) {
        setModal({
            abierto: true,
            tipo,
            titulo,
            mensaje,
            confirmar,
        });
    }

    function cerrarModal() {
        setModal((prev) => ({
            ...prev,
            abierto: false,
            confirmar: undefined,
        }));
    }

    async function confirmarModal() {
        const accion = modal.confirmar;

        setModal((prev) => ({
            ...prev,
            abierto: false,
            confirmar: undefined,
        }));

        if (accion) {
            await accion();
        }
    }

    // =========================================================
    // LIMPIAR FORMULARIO
    // =========================================================

    function limpiarFormulario() {
        setVenta(null);
        setDetalles([]);
        setCantidades({});
        setVentaFolioBusqueda("");
        setMotivo("");
        setMontoEfectivo("");
        setMontoTarjeta("");
        setMontoTransferencia("");
        setMetodoReembolso("efectivo");
    }

    // =========================================================
    // BUSCAR VENTA
    // =========================================================

    async function buscarVenta() {
        try {
            setBuscando(true);
            setError("");
            setMensaje("");

            setVenta(null);
            setDetalles([]);
            setCantidades({});

            const folioTexto =
                ventaFolioBusqueda.trim();

            if (!folioTexto) {
                mostrarModal(
                    "error",
                    "Número de venta",
                    "Ingresa el número de venta."
                );
                return;
            }

            const folio = Number(folioTexto);

            if (
                !Number.isInteger(folio) ||
                folio <= 0
            ) {
                mostrarModal(
                    "error",
                    "Número de venta",
                    "El número de venta debe ser un número entero válido."
                );
                return;
            }

            // -------------------------------------------------------
            // BUSCAR VENTA
            // -------------------------------------------------------

            const {
                data: ventaData,
                error: ventaError,
            } = await supabasePOS
                .from("ventas")
                .select(
                    `
                    id,
                    folio,
                    negocio_id,
                    sucursal_id,
                    caja_id,
                    sesion_caja_id,
                    subtotal,
                    descuento,
                    impuesto,
                    total,
                    metodo_pago,
                    estado,
                    referencia,
                    created_at
                    `
                )
                .eq("folio", folio)
                .eq("estado", "completada")
                .single();

            if (ventaError) {
                throw new Error(
                    "No se encontró la venta. Verifica el número de venta."
                );
            }

            if (!ventaData) {
                throw new Error(
                    "La venta no existe o no está disponible para devolución."
                );
            }

            // -------------------------------------------------------
            // VALIDAR NEGOCIO
            // -------------------------------------------------------

            if (
                usuario &&
                ventaData.negocio_id !==
                usuario.negocio_id
            ) {
                throw new Error(
                    "La venta no pertenece a tu negocio."
                );
            }

            // -------------------------------------------------------
            // VALIDAR SESIÓN DE CAJA
            // -------------------------------------------------------

            if (
                sesionCaja &&
                ventaData.sesion_caja_id !==
                sesionCaja.id
            ) {
                throw new Error(
                    "Esta venta pertenece a una sesión de caja diferente a la sesión actual."
                );
            }

            // -------------------------------------------------------
            // OBTENER DETALLES
            // -------------------------------------------------------

            const {
                data: detallesData,
                error: detallesError,
            } = await supabasePOS
                .from("detalle_ventas")
                .select(
                    `
                    id,
                    venta_id,
                    producto_id,
                    cantidad,
                    precio_unitario,
                    descuento,
                    impuesto,
                    subtotal,
                    total,
                    productos (
                        nombre,
                        codigo_barras
                    )
                    `
                )
                .eq("venta_id", ventaData.id)
                .order("created_at", {
                    ascending: true,
                });

            if (detallesError) {
                throw new Error(
                    "No se pudieron obtener los productos de la venta: " +
                    detallesError.message
                );
            }

            if (
                !detallesData ||
                detallesData.length === 0
            ) {
                throw new Error(
                    "La venta no tiene productos registrados."
                );
            }

            // =========================================================
            // OBTENER DEVOLUCIONES ANTERIORES
            // =========================================================

            const detalleIds =
                detallesData.map(
                    (detalle: any) =>
                        detalle.id
                );

            let devolucionesData: any[] = [];

            if (detalleIds.length > 0) {
                // -------------------------------------------------------
                // 1. DETALLES DE DEVOLUCIONES
                // -------------------------------------------------------

                const {
                    data: detallesDevoluciones,
                    error:
                    detallesDevolucionesError,
                } = await supabasePOS
                    .from("detalle_devoluciones")
                    .select(
                        `
                        id,
                        devolucion_id,
                        detalle_venta_id,
                        cantidad
                        `
                    )
                    .in(
                        "detalle_venta_id",
                        detalleIds
                    );

                if (
                    detallesDevolucionesError
                ) {
                    throw new Error(
                        "No se pudieron comprobar devoluciones anteriores: " +
                        detallesDevolucionesError.message
                    );
                }

                // -------------------------------------------------------
                // 2. ESTADOS DE LAS DEVOLUCIONES
                // -------------------------------------------------------

                if (
                    detallesDevoluciones &&
                    detallesDevoluciones.length > 0
                ) {
                    const devolucionIds =
                        detallesDevoluciones.map(
                            (detalle: any) =>
                                detalle.devolucion_id
                        );

                    const {
                        data: devoluciones,
                        error: devolucionesError,
                    } = await supabasePOS
                        .from("devoluciones")
                        .select(
                            `
                            id,
                            estado
                            `
                        )
                        .in(
                            "id",
                            devolucionIds
                        );

                    if (devolucionesError) {
                        throw new Error(
                            "No se pudieron comprobar los estados de las devoluciones: " +
                            devolucionesError.message
                        );
                    }

                    // -------------------------------------------------------
                    // 3. UNIR DETALLE + ESTADO
                    // -------------------------------------------------------

                    devolucionesData =
                        detallesDevoluciones.map(
                            (detalle: any) => {
                                const devolucion =
                                    devoluciones?.find(
                                        (d: any) =>
                                            d.id ===
                                            detalle.devolucion_id
                                    );

                                return {
                                    detalle_venta_id:
                                        detalle.detalle_venta_id,

                                    cantidad:
                                        Number(
                                            detalle.cantidad ||
                                            0
                                        ),

                                    estado:
                                        devolucion?.estado ||
                                        null,
                                };
                            }
                        );
                }
            }

            // =========================================================
            // CALCULAR DISPONIBLES
            // =========================================================

            const detallesProcesados:
                DetalleVenta[] =
                detallesData.map(
                    (detalle: any) => {
                        let cantidadDevuelta = 0;

                        for (
                            const devolucion of
                            devolucionesData
                        ) {
                            if (
                                devolucion.detalle_venta_id ===
                                detalle.id &&
                                devolucion.estado ===
                                "completada"
                            ) {
                                cantidadDevuelta +=
                                    Number(
                                        devolucion.cantidad ||
                                        0
                                    );
                            }
                        }

                        const cantidadVendida =
                            Number(
                                detalle.cantidad
                            );

                        const cantidadDisponible =
                            Math.max(
                                0,
                                cantidadVendida -
                                cantidadDevuelta
                            );

                        const productoData =
                            Array.isArray(
                                detalle.productos
                            )
                                ? detalle.productos[0] ??
                                null
                                : detalle.productos ??
                                null;

                        return {
                            id: detalle.id,

                            venta_id:
                                detalle.venta_id,

                            producto_id:
                                detalle.producto_id,

                            cantidad:
                                cantidadVendida,

                            precio_unitario:
                                Number(
                                    detalle.precio_unitario
                                ),

                            descuento:
                                Number(
                                    detalle.descuento ||
                                    0
                                ),

                            impuesto:
                                Number(
                                    detalle.impuesto ||
                                    0
                                ),

                            subtotal:
                                Number(
                                    detalle.subtotal ||
                                    0
                                ),

                            total:
                                Number(
                                    detalle.total ||
                                    0
                                ),

                            producto:
                                productoData
                                    ? {
                                        nombre:
                                            productoData.nombre,

                                        codigo_barras:
                                            productoData.codigo_barras,
                                    }
                                    : null,

                            cantidad_devuelta:
                                cantidadDevuelta,

                            cantidad_disponible:
                                cantidadDisponible,
                        };
                    }
                );

            // =========================================================
            // COMPROBAR SI TODA LA VENTA YA FUE DEVUELTA
            // =========================================================

            const ventaCompletamenteDevuelta =
                detallesProcesados.length > 0 &&
                detallesProcesados.every(
                    (detalle) =>
                        Number(
                            detalle.cantidad_disponible ||
                            0
                        ) <= 0
                );

            if (ventaCompletamenteDevuelta) {
                mostrarModal(
                    "info",
                    "Venta ya devuelta",
                    "Esta venta ya fue devuelta por completo. No hay productos disponibles para devolver."
                );

                return;
            }

            setVenta(ventaData);
            setDetalles(detallesProcesados);

            // -------------------------------------------------------
            // MÉTODO DE PAGO ORIGINAL
            // -------------------------------------------------------

            if (
                ventaData.metodo_pago ===
                "efectivo" ||
                ventaData.metodo_pago ===
                "tarjeta" ||
                ventaData.metodo_pago ===
                "transferencia"
            ) {
                setMetodoReembolso(
                    ventaData.metodo_pago
                );
            } else {
                setMetodoReembolso(
                    "efectivo"
                );
            }

            setMensaje(
                `Venta #${ventaData.folio} encontrada correctamente.`
            );
        } catch (err: any) {
            mostrarModal(
                "error",
                "No se pudo buscar la venta",
                err?.message ||
                "No se pudo buscar la venta."
            );
        } finally {
            setBuscando(false);
        }
    }

    // =========================================================
    // CAMBIAR CANTIDAD
    // =========================================================

    function cambiarCantidad(
        detalleId: string,
        cantidad: number,
        maximo: number
    ) {
        let nuevaCantidad =
            Number(cantidad);

        if (Number.isNaN(nuevaCantidad)) {
            nuevaCantidad = 0;
        }

        if (nuevaCantidad < 0) {
            nuevaCantidad = 0;
        }

        if (nuevaCantidad > maximo) {
            nuevaCantidad = maximo;
        }

        setCantidades((prev) => ({
            ...prev,
            [detalleId]:
                nuevaCantidad,
        }));
    }

    // =========================================================
    // OBTENER DETALLES A DEVOLVER
    // =========================================================

    function obtenerDetallesDevolucion():
        DetalleDevolucion[] {
        return detalles
            .filter((detalle) => {
                const cantidad =
                    cantidades[
                    detalle.id
                    ] || 0;

                return (
                    cantidad > 0 &&
                    Number(
                        detalle.cantidad_disponible ||
                        0
                    ) > 0
                );
            })
            .map((detalle) => ({
                detalle_venta_id:
                    detalle.id,

                cantidad:
                    cantidades[
                    detalle.id
                    ] || 0,
            }));
    }

    // =========================================================
    // CALCULAR TOTAL
    // =========================================================

    function calcularTotalDevolucion():
        number {
        let total = 0;

        for (const detalle of detalles) {
            const cantidad =
                cantidades[
                detalle.id
                ] || 0;

            if (cantidad <= 0) {
                continue;
            }

            const cantidadDisponible =
                detalle.cantidad_disponible ||
                0;

            if (
                cantidad >
                cantidadDisponible
            ) {
                continue;
            }

            if (detalle.cantidad > 0) {
                total +=
                    (detalle.total /
                        detalle.cantidad) *
                    cantidad;
            }
        }

        return Number(
            total.toFixed(2)
        );
    }

    // =========================================================
    // EJECUTAR DEVOLUCIÓN
    // =========================================================

    async function ejecutarDevolucion() {
        try {
            setProcesando(true);
            setError("");
            setMensaje("");

            if (!usuario) {
                throw new Error(
                    "No se pudo identificar al usuario."
                );
            }

            if (!sesionCaja) {
                throw new Error(
                    "No existe una sesión de caja abierta."
                );
            }

            if (!venta) {
                throw new Error(
                    "Primero debes buscar una venta."
                );
            }

            // -------------------------------------------------------
            // VALIDACIÓN FINAL DE DISPONIBILIDAD
            // -------------------------------------------------------

            const detallesDevolucion =
                obtenerDetallesDevolucion();

            if (
                detallesDevolucion.length ===
                0
            ) {
                throw new Error(
                    "Esta venta ya fue devuelta por completo. No hay productos disponibles para devolver."
                );
            }

            for (
                const detalle of detallesDevolucion
            ) {
                const detalleVenta =
                    detalles.find(
                        (item) =>
                            item.id ===
                            detalle.detalle_venta_id
                    );

                const disponible =
                    Number(
                        detalleVenta?.cantidad_disponible ||
                        0
                    );

                if (
                    detalle.cantidad >
                    disponible
                ) {
                    throw new Error(
                        "Esta venta ya fue devuelta por completo. No hay productos disponibles para devolver."
                    );
                }
            }

            const totalDevolucion =
                calcularTotalDevolucion();

            if (
                totalDevolucion <= 0
            ) {
                throw new Error(
                    "El total de la devolución debe ser mayor que cero."
                );
            }

            // -------------------------------------------------------
            // VALIDAR REEMBOLSO MIXTO
            // -------------------------------------------------------

            if (
                metodoReembolso ===
                "mixto"
            ) {
                const efectivo =
                    Number(
                        montoEfectivo ||
                        0
                    );

                const tarjeta =
                    Number(
                        montoTarjeta ||
                        0
                    );

                const transferencia =
                    Number(
                        montoTransferencia ||
                        0
                    );

                if (
                    efectivo < 0 ||
                    tarjeta < 0 ||
                    transferencia < 0
                ) {
                    throw new Error(
                        "Los importes de reembolso no pueden ser negativos."
                    );
                }

                const totalMixto =
                    efectivo +
                    tarjeta +
                    transferencia;

                if (
                    Math.abs(
                        totalMixto -
                        totalDevolucion
                    ) > 0.01
                ) {
                    throw new Error(
                        `El reembolso mixto debe sumar ${dinero(
                            totalDevolucion
                        )}. Actualmente suma ${dinero(
                            totalMixto
                        )}.`
                    );
                }
            }

            // -------------------------------------------------------
            // LLAMAR RPC
            // -------------------------------------------------------

            const {
                data,
                error: rpcError,
            } = await supabasePOS.rpc(
                "registrar_devolucion",
                {
                    p_venta_id:
                        venta.id,

                    p_sesion_caja_id:
                        sesionCaja.id,

                    p_usuario_id:
                        usuario.id,

                    p_metodo_reembolso:
                        metodoReembolso,

                    p_motivo:
                        motivo.trim() ||
                        null,

                    p_detalles:
                        detallesDevolucion,
                }
            );

            if (rpcError) {
                const mensajeRPC =
                    String(
                        rpcError.message ||
                        ""
                    );

                // ---------------------------------------------------
                // ERROR ESPECÍFICO DE DISPONIBILIDAD
                // ---------------------------------------------------

                if (
                    mensajeRPC
                        .toLowerCase()
                        .includes(
                            "solo quedan"
                        ) ||
                    mensajeRPC
                        .toLowerCase()
                        .includes(
                            "no puedes devolver"
                        )
                ) {
                    throw new Error(
                        "Esta venta ya fue devuelta por completo. No hay productos disponibles para devolver."
                    );
                }

                throw new Error(
                    mensajeRPC ||
                    "No se pudo registrar la devolución."
                );
            }

            if (!data) {
                throw new Error(
                    "La devolución no devolvió ningún resultado."
                );
            }

            const resultado =
                data as any;

            const montoRegistrado =
                Number(
                    resultado.monto_total ||
                    totalDevolucion
                );

            // -------------------------------------------------------
            // LIMPIAR ANTES DEL MENSAJE
            // -------------------------------------------------------

            limpiarFormulario();

            setMensaje(
                `Devolución realizada correctamente. Total: ${dinero(
                    montoRegistrado
                )}`
            );

            mostrarModal(
                "exito",
                "Devolución realizada",
                `La devolución se registró correctamente por ${dinero(
                    montoRegistrado
                )}.`
            );
        } catch (err: any) {
            const mensajeError =
                err?.message ||
                "No se pudo procesar la devolución.";

            const esErrorDisponibilidad =
                mensajeError
                    .toLowerCase()
                    .includes(
                        "solo quedan"
                    ) ||
                mensajeError
                    .toLowerCase()
                    .includes(
                        "no puedes devolver"
                    ) ||
                mensajeError
                    .toLowerCase()
                    .includes(
                        "devuelta por completo"
                    );

            mostrarModal(
                esErrorDisponibilidad
                    ? "info"
                    : "error",
                esErrorDisponibilidad
                    ? "Venta ya devuelta"
                    : "No se pudo procesar",
                esErrorDisponibilidad
                    ? "Esta venta ya fue devuelta por completo. No hay productos disponibles para devolver."
                    : mensajeError
            );
        } finally {
            setProcesando(false);
        }
    }

    // =========================================================
    // PROCESAR DEVOLUCIÓN
    // =========================================================

    async function procesarDevolucion() {
        try {
            setError("");
            setMensaje("");

            if (!usuario) {
                mostrarModal(
                    "error",
                    "Usuario",
                    "No se pudo identificar al usuario."
                );
                return;
            }

            if (!sesionCaja) {
                mostrarModal(
                    "error",
                    "Caja",
                    "No existe una sesión de caja abierta."
                );
                return;
            }

            if (!venta) {
                mostrarModal(
                    "error",
                    "Venta",
                    "Primero debes buscar una venta."
                );
                return;
            }

            // -------------------------------------------------------
            // COMPROBAR QUE TODAVÍA EXISTA DISPONIBILIDAD
            // -------------------------------------------------------

            const productosDisponibles =
                detalles.some(
                    (detalle) =>
                        Number(
                            detalle.cantidad_disponible ||
                            0
                        ) > 0
                );

            if (
                !productosDisponibles
            ) {
                mostrarModal(
                    "info",
                    "Venta ya devuelta",
                    "Esta venta ya fue devuelta por completo. No hay productos disponibles para devolver."
                );
                return;
            }

            const detallesDevolucion =
                obtenerDetallesDevolucion();

            if (
                detallesDevolucion.length ===
                0
            ) {
                mostrarModal(
                    "error",
                    "Productos",
                    "Selecciona al menos un producto para devolver."
                );
                return;
            }

            // -------------------------------------------------------
            // VALIDACIÓN DE CANTIDADES
            // -------------------------------------------------------

            for (
                const detalle of detallesDevolucion
            ) {
                const detalleVenta =
                    detalles.find(
                        (item) =>
                            item.id ===
                            detalle.detalle_venta_id
                    );

                const disponible =
                    Number(
                        detalleVenta?.cantidad_disponible ||
                        0
                    );

                if (
                    disponible <= 0 ||
                    detalle.cantidad >
                    disponible
                ) {
                    mostrarModal(
                        "info",
                        "Venta ya devuelta",
                        "Esta venta ya fue devuelta por completo. No hay productos disponibles para devolver."
                    );
                    return;
                }
            }

            const totalDevolucion =
                calcularTotalDevolucion();

            if (
                totalDevolucion <= 0
            ) {
                mostrarModal(
                    "error",
                    "Total inválido",
                    "El total de la devolución debe ser mayor que cero."
                );
                return;
            }

            // -------------------------------------------------------
            // VALIDAR REEMBOLSO MIXTO
            // -------------------------------------------------------

            if (
                metodoReembolso ===
                "mixto"
            ) {
                const efectivo =
                    Number(
                        montoEfectivo ||
                        0
                    );

                const tarjeta =
                    Number(
                        montoTarjeta ||
                        0
                    );

                const transferencia =
                    Number(
                        montoTransferencia ||
                        0
                    );

                if (
                    efectivo < 0 ||
                    tarjeta < 0 ||
                    transferencia < 0
                ) {
                    mostrarModal(
                        "error",
                        "Reembolso inválido",
                        "Los importes de reembolso no pueden ser negativos."
                    );
                    return;
                }

                const totalMixto =
                    efectivo +
                    tarjeta +
                    transferencia;

                if (
                    Math.abs(
                        totalMixto -
                        totalDevolucion
                    ) > 0.01
                ) {
                    mostrarModal(
                        "error",
                        "Reembolso mixto",
                        `El reembolso mixto debe sumar ${dinero(
                            totalDevolucion
                        )}. Actualmente suma ${dinero(
                            totalMixto
                        )}.`
                    );
                    return;
                }
            }

            // -------------------------------------------------------
            // CONFIRMACIÓN
            // -------------------------------------------------------

            mostrarModal(
                "confirmacion",
                "Confirmar devolución",
                `¿Deseas realizar una devolución por ${dinero(
                    totalDevolucion
                )}?`,
                ejecutarDevolucion
            );
        } catch (err: any) {
            mostrarModal(
                "error",
                "No se pudo procesar",
                err?.message ||
                "No se pudo procesar la devolución."
            );
        }
    }

    // =========================================================
    // FORMATEAR DINERO
    // =========================================================

    function dinero(valor: number) {
        return Number(
            valor || 0
        ).toLocaleString(
            "es-MX",
            {
                style: "currency",
                currency: "MXN",
            }
        );
    }

    // =========================================================
    // LOADING
    // =========================================================

    if (cargando) {
        return (
            <main className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-6">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] p-8 text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]" />

                    <p className="text-[var(--color-text-secondary)]">
                        Cargando devoluciones...
                    </p>
                </div>
            </main>
        );
    }

    // =========================================================
    // ERROR DE CONTEXTO
    // =========================================================

    if (
        !usuario ||
        !sesionCaja
    ) {
        return (
            <main className="min-h-screen bg-[var(--color-background)] p-4 md:p-6">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] p-6 md:p-8">
                        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                            Devoluciones
                        </h1>

                        <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)] rounded-xl p-4">
                            {error ||
                                "No se pudo cargar el contexto del POS."}
                        </div>
                    </div>
                </div>

                <ModalMensaje
                    abierto={modal.abierto}
                    tipo={modal.tipo}
                    titulo={modal.titulo}
                    mensaje={modal.mensaje}
                    onCerrar={cerrarModal}
                />
            </main>
        );
    }

    // =========================================================
    // TOTAL
    // =========================================================

    const totalDevolucion =
        calcularTotalDevolucion();

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <main className="min-h-screen bg-[var(--color-background)] p-4 md:p-6">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* =====================================================
                    ENCABEZADO
                ====================================================== */}

                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] p-5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                        <div>
                            <h1 className="text-2xl font-bold text-[var(--color-text)]">
                                Devoluciones
                            </h1>

                            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                                Busca una venta y selecciona los productos que deseas devolver.
                            </p>
                        </div>

                        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl px-4 py-3">
                            <p className="text-xs text-[var(--color-text-secondary)]">
                                Sesión de caja
                            </p>

                            <p className="font-semibold text-[var(--color-text)]">
                                {sesionCaja.id.slice(
                                    0,
                                    8
                                )}
                                ...
                            </p>
                        </div>

                    </div>
                </div>

                {/* =====================================================
                    MENSAJES
                ====================================================== */}

                {mensaje && (
                    <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-[var(--color-success)] rounded-xl p-4">
                        {mensaje}
                    </div>
                )}

                {error && (
                    <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)] rounded-xl p-4">
                        {error}
                    </div>
                )}

                {/* =====================================================
                    BUSCAR VENTA
                ====================================================== */}

                <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] p-5">
                    <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
                        Buscar venta
                    </h2>

                    <div className="flex flex-col md:flex-row gap-3">

                        <input
                            type="number"
                            min="1"
                            value={
                                ventaFolioBusqueda
                            }
                            onChange={(e) =>
                                setVentaFolioBusqueda(
                                    e.target.value
                                )
                            }
                            onKeyDown={(e) => {
                                if (
                                    e.key ===
                                    "Enter"
                                ) {
                                    buscarVenta();
                                }
                            }}
                            placeholder="Ej. 29"
                            className="flex-1 border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                        />

                        <button
                            type="button"
                            onClick={
                                buscarVenta
                            }
                            disabled={
                                buscando
                            }
                            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-6 py-3 transition"
                        >
                            {buscando
                                ? "Buscando..."
                                : "Buscar venta"}
                        </button>

                    </div>

                    <p className="text-xs text-[var(--color-text-secondary)] mt-3">
                        Ingresa el número de venta mostrado en tu ticket.
                    </p>
                </section>

                {/* =====================================================
                    INFORMACIÓN VENTA
                ====================================================== */}

                {venta && (
                    <>
                        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] p-5">

                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                                <div>
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                        Venta
                                    </p>

                                    <p className="text-xl font-bold text-[var(--color-text)]">
                                        #{venta.folio}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                        Fecha
                                    </p>

                                    <p className="font-medium text-[var(--color-text)]">
                                        {new Date(
                                            venta.created_at
                                        ).toLocaleString(
                                            "es-MX"
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                        Método de pago
                                    </p>

                                    <p className="font-semibold capitalize text-[var(--color-text)]">
                                        {venta.metodo_pago}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                        Total venta
                                    </p>

                                    <p className="text-xl font-bold text-[var(--color-text)]">
                                        {dinero(
                                            Number(
                                                venta.total
                                            )
                                        )}
                                    </p>
                                </div>

                            </div>
                        </section>

                        {/* =================================================
                            PRODUCTOS
                        ================================================== */}

                        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">

                            <div className="p-5 border-b border-[var(--color-border)]">
                                <h2 className="text-lg font-semibold text-[var(--color-text)]">
                                    Productos de la venta
                                </h2>
                            </div>

                            <div className="divide-y divide-[var(--color-border)]">

                                {detalles.map(
                                    (
                                        detalle
                                    ) => {
                                        const disponible =
                                            Number(
                                                detalle.cantidad_disponible ||
                                                0
                                            );

                                        const cantidadSeleccionada =
                                            cantidades[
                                            detalle.id
                                            ] || 0;

                                        return (
                                            <div
                                                key={
                                                    detalle.id
                                                }
                                                className="p-5"
                                            >
                                                <div className="flex flex-col lg:flex-row lg:items-center gap-5">

                                                    <div className="flex-1 min-w-0">

                                                        <h3 className="font-semibold text-[var(--color-text)]">
                                                            {detalle.producto
                                                                ?.nombre ||
                                                                "Producto"}
                                                        </h3>

                                                        {detalle.producto
                                                            ?.codigo_barras && (
                                                                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                                                    Código:{" "}
                                                                    {
                                                                        detalle.producto
                                                                            .codigo_barras
                                                                    }
                                                                </p>
                                                            )}

                                                        <div className="flex flex-wrap gap-4 mt-3 text-sm">

                                                            <span className="text-[var(--color-text-secondary)]">
                                                                Vendido:{" "}
                                                                <strong className="text-[var(--color-text)]">
                                                                    {
                                                                        detalle.cantidad
                                                                    }
                                                                </strong>
                                                            </span>

                                                            <span className="text-[var(--color-text-secondary)]">
                                                                Devuelto:{" "}
                                                                <strong className="text-[var(--color-text)]">
                                                                    {
                                                                        detalle.cantidad_devuelta
                                                                    }
                                                                </strong>
                                                            </span>

                                                            <span
                                                                className={
                                                                    disponible >
                                                                        0
                                                                        ? "text-[var(--color-success)]"
                                                                        : "text-[var(--color-danger)]"
                                                                }
                                                            >
                                                                Disponible:{" "}
                                                                <strong>
                                                                    {
                                                                        detalle.cantidad_disponible
                                                                    }
                                                                </strong>
                                                            </span>

                                                        </div>
                                                    </div>

                                                    <div className="text-right">

                                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                                            Precio unitario
                                                        </p>

                                                        <p className="font-semibold text-[var(--color-text)]">
                                                            {dinero(
                                                                detalle.precio_unitario
                                                            )}
                                                        </p>

                                                    </div>

                                                    <div className="w-full lg:w-36">

                                                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                                                            Cantidad a devolver
                                                        </label>

                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={
                                                                disponible
                                                            }
                                                            step="1"
                                                            value={
                                                                cantidadSeleccionada
                                                            }
                                                            disabled={
                                                                disponible <=
                                                                0
                                                            }
                                                            onChange={(
                                                                e
                                                            ) =>
                                                                cambiarCantidad(
                                                                    detalle.id,
                                                                    Number(
                                                                        e
                                                                            .target
                                                                            .value
                                                                    ),
                                                                    disponible
                                                                )
                                                            }
                                                            className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-xl px-3 py-2 text-center outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] disabled:opacity-50"
                                                        />

                                                    </div>

                                                    <div className="text-right min-w-28">

                                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                                            Devolución
                                                        </p>

                                                        <p className="font-bold text-[var(--color-text)]">
                                                            {dinero(
                                                                detalle.cantidad >
                                                                    0
                                                                    ? (
                                                                        detalle.total /
                                                                        detalle.cantidad
                                                                    ) *
                                                                    cantidadSeleccionada
                                                                    : 0
                                                            )}
                                                        </p>

                                                    </div>

                                                </div>
                                            </div>
                                        );
                                    }
                                )}

                            </div>

                            <div className="bg-[var(--color-background)] border-t border-[var(--color-border)] p-5 flex justify-end">

                                <div className="text-right">

                                    <p className="text-sm text-[var(--color-text-secondary)]">
                                        Total a devolver
                                    </p>

                                    <p className="text-3xl font-bold text-[var(--color-text)]">
                                        {dinero(
                                            totalDevolucion
                                        )}
                                    </p>

                                </div>

                            </div>

                        </section>

                        {/* =================================================
                            REEMBOLSO
                        ================================================== */}

                        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] p-5">

                            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
                                Método de reembolso
                            </h2>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                                {(
                                    [
                                        "efectivo",
                                        "tarjeta",
                                        "transferencia",
                                        "mixto",
                                    ] as MetodoReembolso[]
                                ).map(
                                    (
                                        metodo
                                    ) => (
                                        <button
                                            key={
                                                metodo
                                            }
                                            type="button"
                                            onClick={() =>
                                                setMetodoReembolso(
                                                    metodo
                                                )
                                            }
                                            className={`rounded-xl border px-4 py-3 font-semibold capitalize transition ${metodoReembolso ===
                                                metodo
                                                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                                : "border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-background)]"
                                                }`}
                                        >
                                            {
                                                metodo
                                            }
                                        </button>
                                    )
                                )}

                            </div>

                            {/* =================================================
                                MIXTO
                            ================================================== */}

                            {metodoReembolso ===
                                "mixto" && (
                                    <div className="mt-5 border border-[var(--color-border)] rounded-2xl p-5 bg-[var(--color-background)]">

                                        <h3 className="font-semibold text-[var(--color-text)] mb-4">
                                            Distribución del reembolso
                                        </h3>

                                        <div className="grid md:grid-cols-3 gap-4">

                                            <div>
                                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                                                    Efectivo
                                                </label>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={
                                                        montoEfectivo
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        setMontoEfectivo(
                                                            e
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                                                    Tarjeta
                                                </label>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={
                                                        montoTarjeta
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        setMontoTarjeta(
                                                            e
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                                                    Transferencia
                                                </label>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={
                                                        montoTransferencia
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        setMontoTransferencia(
                                                            e
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                                                    placeholder="0.00"
                                                />
                                            </div>

                                        </div>

                                        <div className="mt-4 text-sm text-[var(--color-text-secondary)] space-y-1">

                                            <p>
                                                Total devolución:{" "}
                                                <strong className="text-[var(--color-text)]">
                                                    {dinero(
                                                        totalDevolucion
                                                    )}
                                                </strong>
                                            </p>

                                            <p>
                                                Distribuido:{" "}
                                                <strong className="text-[var(--color-text)]">
                                                    {dinero(
                                                        Number(
                                                            montoEfectivo ||
                                                            0
                                                        ) +
                                                        Number(
                                                            montoTarjeta ||
                                                            0
                                                        ) +
                                                        Number(
                                                            montoTransferencia ||
                                                            0
                                                        )
                                                    )}
                                                </strong>
                                            </p>

                                        </div>
                                    </div>
                                )}

                        </section>

                        {/* =================================================
                            MOTIVO
                        ================================================== */}

                        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] p-5">

                            <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">
                                Motivo de devolución
                            </label>

                            <textarea
                                value={
                                    motivo
                                }
                                onChange={(
                                    e
                                ) =>
                                    setMotivo(
                                        e.target.value
                                    )
                                }
                                rows={3}
                                placeholder="Ej. Producto defectuoso, cliente cambió de opinión..."
                                className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] rounded-xl px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                            />

                        </section>

                        {/* =================================================
                            CONFIRMAR
                        ================================================== */}

                        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-sm)] p-5">

                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

                                <div>

                                    <p className="text-sm text-[var(--color-text-secondary)]">
                                        Total de la devolución
                                    </p>

                                    <p className="text-3xl font-bold text-[var(--color-text)]">
                                        {dinero(
                                            totalDevolucion
                                        )}
                                    </p>

                                    <p className="text-sm text-[var(--color-text-secondary)] mt-1 capitalize">
                                        Reembolso:{" "}
                                        {metodoReembolso}
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        procesarDevolucion
                                    }
                                    disabled={
                                        procesando ||
                                        totalDevolucion <=
                                        0
                                    }
                                    className="bg-[var(--color-danger)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl px-8 py-4 transition"
                                >
                                    {procesando
                                        ? "Procesando..."
                                        : "Procesar devolución"}
                                </button>

                            </div>

                        </section>
                    </>
                )}
            </div>

            {/* =========================================================
                MODAL GLOBAL
            ========================================================== */}

            <ModalMensaje
                abierto={
                    modal.abierto
                }
                tipo={
                    modal.tipo
                }
                titulo={
                    modal.titulo
                }
                mensaje={
                    modal.mensaje
                }
                onCerrar={
                    cerrarModal
                }
                onConfirmar={
                    modal.confirmar
                        ? confirmarModal
                        : undefined
                }
            />
        </main>
    );
}