"use client";

import { useEffect, useMemo, useState } from "react";

import {
    verificarRol,
    type UsuarioActual,
} from "../../../lib/auth/roleGuard";

import { supabase } from "../../../lib/supabase";
import ModalMensaje from "../../components/ModalMensaje";
import Button from "../../components/Button";
import Card from "../../components/Card";

interface Sucursal {
    id: string;
    nombre: string;
}

interface Proveedor {
    id: string;
    nombre: string;
}

interface Producto {
    id: string;
    nombre: string;
    codigo_barras: string | null;
    sku: string | null;
    precio_compra: number;
    precio_venta: number;
    unidad: string;
}

interface DetalleCompra {
    producto_id: string;
    producto: Producto | null;
    cantidad: number;
    costo_unitario: number;
    descuento: number;
    impuesto: number;
    subtotal: number;
    total: number;
}

interface Compra {
    id: string;
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
    estado: string;
    referencia: string | null;
    notas: string | null;
    created_at: string;
    sucursal_id: string;
    proveedor_id: string;
    usuario_id: string;

    sucursal?: {
        nombre: string;
    } | null;

    proveedor?: {
        nombre: string;
    } | null;
}

type ModalTipo =
    | "exito"
    | "error"
    | "confirmacion"
    | "info";

type FiltroEstado =
    | "todos"
    | "recibida"
    | "cancelada";

/* =========================================================
   ICONOS
   ========================================================= */

function IconoPlus({
    className = "",
}: {
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={className}
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 5v14M5 12h14"
            />
        </svg>
    );
}

function IconoDocumento({
    className = "",
}: {
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className={className}
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            />
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 2v6h6M8 13h8M8 17h6"
            />
        </svg>
    );
}

function IconoBusqueda({
    className = "",
}: {
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={className}
            aria-hidden="true"
        >
            <circle
                cx="11"
                cy="11"
                r="7"
            />
            <path
                strokeLinecap="round"
                d="m20 20-4-4"
            />
        </svg>
    );
}

function IconoOjo({
    className = "",
}: {
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className={className}
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
            />
            <circle
                cx="12"
                cy="12"
                r="2.5"
            />
        </svg>
    );
}

function IconoX({
    className = "",
}: {
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={className}
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                d="M6 6l12 12M18 6 6 18"
            />
        </svg>
    );
}

function IconoDinero({
    className = "",
}: {
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className={className}
            aria-hidden="true"
        >
            <circle
                cx="12"
                cy="12"
                r="9"
            />
            <path
                strokeLinecap="round"
                d="M15 8.5c-.7-.6-1.7-1-3-1-1.7 0-3 .8-3 2s1.1 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.3 0-2.4-.4-3-1"
            />
            <path
                strokeLinecap="round"
                d="M12 6v12"
            />
        </svg>
    );
}

function IconoCheck({
    className = "",
}: {
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={className}
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m5 12 4 4L19 6"
            />
        </svg>
    );
}

function IconoCarrito({
    className = "",
}: {
    className?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className={className}
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4h2l2.2 10.3a2 2 0 0 0 2 1.7h7.9a2 2 0 0 0 1.9-1.4L21 8H6"
            />
            <circle
                cx="10"
                cy="19"
                r="1.5"
            />
            <circle
                cx="18"
                cy="19"
                r="1.5"
            />
        </svg>
    );
}

/* =========================================================
   COMPONENTE
   ========================================================= */

export default function ComprasPage() {
    const [cargando, setCargando] =
        useState(true);

    const [guardando, setGuardando] =
        useState(false);

    const [cancelando, setCancelando] =
        useState(false);

    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [sucursales, setSucursales] =
        useState<Sucursal[]>([]);

    const [proveedores, setProveedores] =
        useState<Proveedor[]>([]);

    const [productos, setProductos] =
        useState<Producto[]>([]);

    const [compras, setCompras] =
        useState<Compra[]>([]);

    /* =====================================================
       NUEVA COMPRA
       ===================================================== */

    const [
        sucursalSeleccionada,
        setSucursalSeleccionada,
    ] = useState("");

    const [
        proveedorSeleccionado,
        setProveedorSeleccionado,
    ] = useState("");

    const [referencia, setReferencia] =
        useState("");

    const [notas, setNotas] =
        useState("");

    const [
        productoSeleccionado,
        setProductoSeleccionado,
    ] = useState("");

    const [cantidad, setCantidad] =
        useState("1");

    const [
        costoUnitario,
        setCostoUnitario,
    ] = useState("");

    const [detalles, setDetalles] =
        useState<DetalleCompra[]>([]);

    const [
        busquedaProducto,
        setBusquedaProducto,
    ] = useState("");

    const [
        mostrarNuevaCompra,
        setMostrarNuevaCompra,
    ] = useState(false);

    /* =====================================================
       FILTROS
       ===================================================== */

    const [busqueda, setBusqueda] =
        useState("");

    const [filtroEstado, setFiltroEstado] =
        useState<FiltroEstado>("todos");

    const [filtroSucursal, setFiltroSucursal] =
        useState("");

    const [filtroProveedor, setFiltroProveedor] =
        useState("");

    /* =====================================================
       DETALLE
       ===================================================== */

    const [
        compraSeleccionada,
        setCompraSeleccionada,
    ] = useState<Compra | null>(null);

    const [
        detallesCompra,
        setDetallesCompra,
    ] = useState<DetalleCompra[]>([]);

    const [
        cargandoDetalle,
        setCargandoDetalle,
    ] = useState(false);

    const [
        mostrarDetalle,
        setMostrarDetalle,
    ] = useState(false);

    /* =====================================================
       MODAL
       ===================================================== */

    const [modal, setModal] = useState<{
        abierto: boolean;
        tipo: ModalTipo;
        titulo: string;
        mensaje: string;
        textoBoton?: string;
        textoCancelar?: string;
        onConfirmar?: () => void;
    }>({
        abierto: false,
        tipo: "info",
        titulo: "",
        mensaje: "",
    });

    function mostrarMensaje(
        tipo: ModalTipo,
        titulo: string,
        mensaje: string,
        opciones?: {
            textoBoton?: string;
            textoCancelar?: string;
            onConfirmar?: () => void;
        }
    ) {
        setModal({
            abierto: true,
            tipo,
            titulo,
            mensaje,
            textoBoton:
                opciones?.textoBoton,
            textoCancelar:
                opciones?.textoCancelar,
            onConfirmar:
                opciones?.onConfirmar,
        });
    }

    function cerrarModal() {
        setModal((actual) => ({
            ...actual,
            abierto: false,
            onConfirmar: undefined,
        }));
    }

    /* =====================================================
       FORMATO
       ===================================================== */

    function dinero(valor: number) {
        return new Intl.NumberFormat(
            "es-MX",
            {
                style: "currency",
                currency: "MXN",
            }
        ).format(Number(valor) || 0);
    }

    function fecha(valor: string) {
        return new Intl.DateTimeFormat(
            "es-MX",
            {
                dateStyle: "medium",
                timeStyle: "short",
            }
        ).format(new Date(valor));
    }

    function nombreEstado(
        estado: string
    ) {
        switch (estado) {
            case "recibida":
                return "Recibida";

            case "cancelada":
                return "Cancelada";

            case "pendiente":
                return "Pendiente";

            default:
                return estado;
        }
    }

    /* =====================================================
       CARGAR DATOS
       ===================================================== */

    useEffect(() => {
        cargarDatos();
    }, []);

    async function cargarDatos() {
        try {
            setCargando(true);

            const resultado =
                await verificarRol([
                    "admin",
                    "encargado",
                ]);

            if (
                !resultado.autorizado ||
                !resultado.usuario
            ) {
                mostrarMensaje(
                    "error",
                    "Acceso no permitido",
                    resultado.motivo ===
                        "no_autenticado"
                        ? "No hay un usuario autenticado."
                        : "No tienes permisos para acceder a Compras."
                );

                return;
            }

            const usuarioActual =
                resultado.usuario;

            setUsuario(usuarioActual);

            const negocioId =
                usuarioActual.negocio_id;

            /* SUCURSALES */

            const {
                data: sucursalesData,
                error: errorSucursales,
            } = await supabase
                .from("sucursales")
                .select(
                    "id, nombre"
                )
                .eq(
                    "negocio_id",
                    negocioId
                )
                .eq(
                    "activo",
                    true
                )
                .order("nombre");

            if (errorSucursales) {
                throw errorSucursales;
            }

            setSucursales(
                sucursalesData || []
            );

            if (
                sucursalesData &&
                sucursalesData.length > 0
            ) {
                setSucursalSeleccionada(
                    sucursalesData[0].id
                );
            }

            /* PROVEEDORES */

            const {
                data: proveedoresData,
                error: errorProveedores,
            } = await supabase
                .from("proveedores")
                .select(
                    "id, nombre"
                )
                .eq(
                    "negocio_id",
                    negocioId
                )
                .eq(
                    "activo",
                    true
                )
                .order("nombre");

            if (errorProveedores) {
                throw errorProveedores;
            }

            setProveedores(
                proveedoresData || []
            );

            /* PRODUCTOS */

            const {
                data: productosData,
                error: errorProductos,
            } = await supabase
                .from("productos")
                .select(`
                    id,
                    nombre,
                    codigo_barras,
                    sku,
                    precio_compra,
                    precio_venta,
                    unidad
                `)
                .eq(
                    "negocio_id",
                    negocioId
                )
                .eq(
                    "activo",
                    true
                )
                .order("nombre");

            if (errorProductos) {
                throw errorProductos;
            }

            setProductos(
                productosData || []
            );

            /* COMPRAS */

            await cargarCompras(
                negocioId
            );
        } catch (error: any) {
            console.error(
                "Error cargando compras:",
                error
            );

            mostrarMensaje(
                "error",
                "Error",
                error?.message ||
                "No se pudieron cargar las compras."
            );
        } finally {
            setCargando(false);
        }
    }

    /* =====================================================
       CARGAR COMPRAS
       ===================================================== */

    async function cargarCompras(
        negocioId: string
    ) {
        const {
            data,
            error,
        } = await supabase
            .from("compras")
            .select(`
                id,
                subtotal,
                descuento,
                impuesto,
                total,
                estado,
                referencia,
                notas,
                created_at,
                sucursal_id,
                proveedor_id,
                usuario_id,
                sucursales(
                    nombre
                ),
                proveedores(
                    nombre
                )
            `)
            .eq(
                "negocio_id",
                negocioId
            )
            .order(
                "created_at",
                {
                    ascending: false,
                }
            );

        if (error) {
            console.error(
                "Error cargando compras:",
                error
            );

            mostrarMensaje(
                "error",
                "Error",
                "No se pudo cargar el historial de compras."
            );

            return;
        }

        const comprasFormateadas =
            (data || []).map(
                (compra: any) => ({
                    ...compra,

                    subtotal:
                        Number(
                            compra.subtotal ||
                            0
                        ),

                    descuento:
                        Number(
                            compra.descuento ||
                            0
                        ),

                    impuesto:
                        Number(
                            compra.impuesto ||
                            0
                        ),

                    total:
                        Number(
                            compra.total ||
                            0
                        ),

                    sucursal:
                        Array.isArray(
                            compra.sucursales
                        )
                            ? compra.sucursales[0] ||
                            null
                            : compra.sucursales,

                    proveedor:
                        Array.isArray(
                            compra.proveedores
                        )
                            ? compra.proveedores[0] ||
                            null
                            : compra.proveedores,
                })
            );

        setCompras(
            comprasFormateadas
        );
    }

    /* =====================================================
       PRODUCTOS FILTRADOS
       ===================================================== */

    const productosFiltrados =
        useMemo(() => {
            const texto =
                busquedaProducto
                    .trim()
                    .toLowerCase();

            if (!texto) {
                return productos.slice(
                    0,
                    20
                );
            }

            return productos
                .filter(
                    (producto) =>
                        producto.nombre
                            .toLowerCase()
                            .includes(
                                texto
                            ) ||
                        producto.codigo_barras
                            ?.toLowerCase()
                            .includes(
                                texto
                            ) ||
                        producto.sku
                            ?.toLowerCase()
                            .includes(
                                texto
                            )
                )
                .slice(0, 20);
        }, [
            productos,
            busquedaProducto,
        ]);

    /* =====================================================
       COMPRAS FILTRADAS
       ===================================================== */

    const comprasFiltradas =
        useMemo(() => {
            const texto =
                busqueda
                    .trim()
                    .toLowerCase();

            return compras.filter(
                (compra) => {
                    const coincideBusqueda =
                        !texto ||
                        compra.referencia
                            ?.toLowerCase()
                            .includes(
                                texto
                            ) ||
                        compra.proveedor?.nombre
                            ?.toLowerCase()
                            .includes(
                                texto
                            ) ||
                        compra.sucursal?.nombre
                            ?.toLowerCase()
                            .includes(
                                texto
                            ) ||
                        compra.estado
                            .toLowerCase()
                            .includes(
                                texto
                            );

                    const coincideEstado =
                        filtroEstado ===
                        "todos" ||
                        compra.estado ===
                        filtroEstado;

                    const coincideSucursal =
                        !filtroSucursal ||
                        compra.sucursal_id ===
                        filtroSucursal;

                    const coincideProveedor =
                        !filtroProveedor ||
                        compra.proveedor_id ===
                        filtroProveedor;

                    return (
                        coincideBusqueda &&
                        coincideEstado &&
                        coincideSucursal &&
                        coincideProveedor
                    );
                }
            );
        }, [
            compras,
            busqueda,
            filtroEstado,
            filtroSucursal,
            filtroProveedor,
        ]);

    /* =====================================================
       RESUMEN
       ===================================================== */

    const comprasRecibidas =
        useMemo(
            () =>
                compras.filter(
                    (compra) =>
                        compra.estado ===
                        "recibida"
                ).length,
            [compras]
        );

    const comprasCanceladas =
        useMemo(
            () =>
                compras.filter(
                    (compra) =>
                        compra.estado ===
                        "cancelada"
                ).length,
            [compras]
        );

    const totalComprado =
        useMemo(
            () =>
                compras
                    .filter(
                        (compra) =>
                            compra.estado ===
                            "recibida"
                    )
                    .reduce(
                        (
                            acumulado,
                            compra
                        ) =>
                            acumulado +
                            Number(
                                compra.total ||
                                0
                            ),
                        0
                    ),
            [compras]
        );

    /* =====================================================
       AGREGAR PRODUCTO
       ===================================================== */

    function agregarProducto() {
        if (
            !productoSeleccionado
        ) {
            mostrarMensaje(
                "info",
                "Producto requerido",
                "Selecciona un producto."
            );

            return;
        }

        const producto =
            productos.find(
                (p) =>
                    p.id ===
                    productoSeleccionado
            );

        if (!producto) {
            mostrarMensaje(
                "error",
                "Producto no encontrado",
                "No se encontró el producto seleccionado."
            );

            return;
        }

        const cantidadNumero =
            Number(cantidad);

        const costoNumero =
            Number(costoUnitario);

        if (
            !Number.isFinite(
                cantidadNumero
            ) ||
            cantidadNumero <= 0
        ) {
            mostrarMensaje(
                "info",
                "Cantidad inválida",
                "La cantidad debe ser mayor a cero."
            );

            return;
        }

        if (
            !Number.isFinite(
                costoNumero
            ) ||
            costoNumero < 0
        ) {
            mostrarMensaje(
                "info",
                "Costo inválido",
                "El costo unitario no puede ser negativo."
            );

            return;
        }

        const existente =
            detalles.find(
                (detalle) =>
                    detalle.producto_id ===
                    producto.id
            );

        if (existente) {
            setDetalles(
                (actuales) =>
                    actuales.map(
                        (detalle) =>
                            detalle.producto_id ===
                                producto.id
                                ? {
                                    ...detalle,

                                    cantidad:
                                        detalle.cantidad +
                                        cantidadNumero,

                                    costo_unitario:
                                        costoNumero,

                                    subtotal:
                                        (detalle.cantidad +
                                            cantidadNumero) *
                                        costoNumero -
                                        detalle.descuento,

                                    total:
                                        (detalle.cantidad +
                                            cantidadNumero) *
                                        costoNumero -
                                        detalle.descuento +
                                        detalle.impuesto,
                                }
                                : detalle
                    )
            );

            mostrarMensaje(
                "exito",
                "Producto actualizado",
                "La cantidad del producto fue actualizada."
            );
        } else {
            const subtotalDetalle =
                cantidadNumero *
                costoNumero;

            setDetalles(
                (actuales) => [
                    ...actuales,
                    {
                        producto_id:
                            producto.id,

                        producto,

                        cantidad:
                            cantidadNumero,

                        costo_unitario:
                            costoNumero,

                        descuento: 0,

                        impuesto: 0,

                        subtotal:
                            subtotalDetalle,

                        total:
                            subtotalDetalle,
                    },
                ]
            );

            mostrarMensaje(
                "exito",
                "Producto agregado",
                "El producto fue agregado a la compra."
            );
        }

        setProductoSeleccionado(
            ""
        );

        setBusquedaProducto(
            ""
        );

        setCantidad("1");

        setCostoUnitario("");
    }

    /* =====================================================
       ELIMINAR DETALLE
       ===================================================== */

    function eliminarDetalle(
        productoId: string
    ) {
        const detalle =
            detalles.find(
                (item) =>
                    item.producto_id ===
                    productoId
            );

        if (!detalle) {
            return;
        }

        mostrarMensaje(
            "confirmacion",
            "Eliminar producto",
            `¿Deseas eliminar "${detalle.producto?.nombre || "este producto"}" de la compra?`,
            {
                textoBoton:
                    "Eliminar",

                textoCancelar:
                    "Cancelar",

                onConfirmar: () => {
                    setDetalles(
                        (actuales) =>
                            actuales.filter(
                                (item) =>
                                    item.producto_id !==
                                    productoId
                            )
                    );

                    cerrarModal();

                    setTimeout(() => {
                        mostrarMensaje(
                            "exito",
                            "Producto eliminado",
                            "El producto fue eliminado de la compra."
                        );
                    }, 100);
                },
            }
        );
    }

    /* =====================================================
       ACTUALIZAR DETALLE
       ===================================================== */

    function actualizarDetalle(
        productoId: string,
        campo:
            | "cantidad"
            | "costo_unitario",
        valor: string
    ) {
        const numero =
            Number(valor);

        setDetalles(
            (actuales) =>
                actuales.map(
                    (detalle) => {
                        if (
                            detalle.producto_id !==
                            productoId
                        ) {
                            return detalle;
                        }

                        const valorValido =
                            Number.isFinite(
                                numero
                            ) &&
                                numero >= 0
                                ? numero
                                : 0;

                        const nuevaCantidad =
                            campo ===
                                "cantidad"
                                ? valorValido
                                : detalle.cantidad;

                        const nuevoCosto =
                            campo ===
                                "costo_unitario"
                                ? valorValido
                                : detalle.costo_unitario;

                        const nuevoSubtotal =
                            nuevaCantidad *
                            nuevoCosto -
                            detalle.descuento;

                        const nuevoTotal =
                            nuevoSubtotal +
                            detalle.impuesto;

                        return {
                            ...detalle,

                            [campo]:
                                valorValido,

                            subtotal:
                                nuevoSubtotal,

                            total:
                                nuevoTotal,
                        };
                    }
                )
        );
    }

    /* =====================================================
       TOTALES NUEVA COMPRA
       ===================================================== */

    const subtotal =
        useMemo(
            () =>
                detalles.reduce(
                    (
                        acumulado,
                        detalle
                    ) =>
                        acumulado +
                        detalle.cantidad *
                        detalle.costo_unitario -
                        detalle.descuento,
                    0
                ),
            [detalles]
        );

    const descuentoTotal =
        useMemo(
            () =>
                detalles.reduce(
                    (
                        acumulado,
                        detalle
                    ) =>
                        acumulado +
                        detalle.descuento,
                    0
                ),
            [detalles]
        );

    const impuestoTotal =
        useMemo(
            () =>
                detalles.reduce(
                    (
                        acumulado,
                        detalle
                    ) =>
                        acumulado +
                        detalle.impuesto,
                    0
                ),
            [detalles]
        );

    const total =
        subtotal +
        impuestoTotal;

    /* =====================================================
       REGISTRAR COMPRA
       ===================================================== */

    function registrarCompra() {
        if (!usuario) {
            mostrarMensaje(
                "error",
                "Usuario no encontrado",
                "No se encontró el usuario actual."
            );

            return;
        }

        if (
            !sucursalSeleccionada
        ) {
            mostrarMensaje(
                "info",
                "Sucursal requerida",
                "Selecciona una sucursal."
            );

            return;
        }

        if (
            !proveedorSeleccionado
        ) {
            mostrarMensaje(
                "info",
                "Proveedor requerido",
                "Selecciona un proveedor."
            );

            return;
        }

        if (
            detalles.length ===
            0
        ) {
            mostrarMensaje(
                "info",
                "Productos requeridos",
                "Agrega al menos un producto."
            );

            return;
        }

        mostrarMensaje(
            "confirmacion",
            "Registrar compra",
            `¿Deseas registrar esta compra por ${dinero(total)}? El inventario será actualizado automáticamente.`,
            {
                textoBoton:
                    "Registrar compra",

                textoCancelar:
                    "Cancelar",

                onConfirmar:
                    async () => {
                        cerrarModal();

                        await ejecutarRegistroCompra();
                    },
            }
        );
    }

    async function ejecutarRegistroCompra() {
        if (!usuario) {
            return;
        }

        try {
            setGuardando(true);

            const detallesJson =
                detalles.map(
                    (detalle) => {
                        const subtotalDetalle =
                            detalle.cantidad *
                            detalle.costo_unitario -
                            detalle.descuento;

                        const totalDetalle =
                            subtotalDetalle +
                            detalle.impuesto;

                        return {
                            producto_id:
                                detalle.producto_id,

                            cantidad:
                                detalle.cantidad,

                            costo_unitario:
                                detalle.costo_unitario,

                            descuento:
                                detalle.descuento,

                            impuesto:
                                detalle.impuesto,

                            subtotal:
                                subtotalDetalle,

                            total:
                                totalDetalle,
                        };
                    }
                );

            const {
                error,
            } = await supabase.rpc(
                "registrar_compra",
                {
                    p_sucursal_id:
                        sucursalSeleccionada,

                    p_proveedor_id:
                        proveedorSeleccionado,

                    p_referencia:
                        referencia.trim() ||
                        null,

                    p_notas:
                        notas.trim() ||
                        null,

                    p_detalles:
                        detallesJson,
                }
            );

            if (error) {
                throw error;
            }

            setProveedorSeleccionado(
                ""
            );

            setReferencia("");

            setNotas("");

            setDetalles([]);

            setProductoSeleccionado(
                ""
            );

            setBusquedaProducto(
                ""
            );

            setCantidad("1");

            setCostoUnitario("");

            setMostrarNuevaCompra(
                false
            );

            await cargarCompras(
                usuario.negocio_id
            );

            mostrarMensaje(
                "exito",
                "Compra registrada",
                "La compra fue registrada correctamente y el inventario fue actualizado."
            );
        } catch (error: any) {
            console.error(
                "Error registrando compra:",
                error
            );

            mostrarMensaje(
                "error",
                "No se pudo registrar",
                error?.message ||
                "No se pudo registrar la compra."
            );
        } finally {
            setGuardando(false);
        }
    }

    /* =====================================================
       VER DETALLE
       ===================================================== */

    async function verDetalleCompra(
        compra: Compra
    ) {
        try {
            setCompraSeleccionada(
                compra
            );

            setDetallesCompra([]);

            setMostrarDetalle(
                true
            );

            setCargandoDetalle(
                true
            );

            const {
                data,
                error,
            } = await supabase
                .from(
                    "detalle_compras"
                )
                .select(`
                    producto_id,
                    cantidad,
                    costo_unitario,
                    descuento,
                    impuesto,
                    subtotal,
                    total,
                    created_at,
                    productos(
                        id,
                        nombre,
                        codigo_barras,
                        sku,
                        precio_compra,
                        precio_venta,
                        unidad
                    )
                `)
                .eq(
                    "compra_id",
                    compra.id
                )
                .order(
                    "created_at",
                    {
                        ascending: true,
                    }
                );

            if (error) {
                throw error;
            }

            const detallesFormateados =
                (data || []).map(
                    (detalle: any) => ({
                        producto_id:
                            detalle.producto_id,

                        cantidad:
                            Number(
                                detalle.cantidad ||
                                0
                            ),

                        costo_unitario:
                            Number(
                                detalle.costo_unitario ||
                                0
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
                            Array.isArray(
                                detalle.productos
                            )
                                ? detalle.productos[0] ||
                                null
                                : detalle.productos ||
                                null,
                    })
                );

            setDetallesCompra(
                detallesFormateados
            );
        } catch (error: any) {
            console.error(
                "Error cargando detalle:",
                error
            );

            setMostrarDetalle(
                false
            );

            mostrarMensaje(
                "error",
                "No se pudo cargar",
                error?.message ||
                "No se pudo cargar el detalle de la compra."
            );
        } finally {
            setCargandoDetalle(
                false
            );
        }
    }

    function cerrarDetalleCompra() {
        setMostrarDetalle(
            false
        );

        setCompraSeleccionada(
            null
        );

        setDetallesCompra([]);
    }

    /* =====================================================
       CANCELAR COMPRA
       ===================================================== */

    function solicitarCancelarCompra(
        compra: Compra
    ) {
        if (
            compra.estado ===
            "cancelada"
        ) {
            mostrarMensaje(
                "info",
                "Compra ya cancelada",
                "Esta compra ya se encuentra cancelada."
            );

            return;
        }

        mostrarMensaje(
            "confirmacion",
            "Cancelar compra",
            `¿Estás seguro de cancelar esta compra por ${dinero(compra.total)}? El inventario será revertido automáticamente.`,
            {
                textoBoton:
                    "Sí, cancelar compra",

                textoCancelar:
                    "No, conservar",

                onConfirmar:
                    async () => {
                        cerrarModal();

                        await cancelarCompra(
                            compra
                        );
                    },
            }
        );
    }

    async function cancelarCompra(
        compra: Compra
    ) {
        if (!usuario) {
            mostrarMensaje(
                "error",
                "Usuario no encontrado",
                "No se encontró el usuario actual."
            );

            return;
        }

        try {
            setCancelando(true);

            const {
                data,
                error,
            } = await supabase.rpc(
                "cancelar_compra",
                {
                    p_compra_id:
                        compra.id,
                }
            );

            if (error) {
                throw error;
            }

            if (data !== true) {
                throw new Error(
                    "La compra no pudo ser cancelada."
                );
            }

            await cargarCompras(
                usuario.negocio_id
            );

            if (
                compraSeleccionada?.id ===
                compra.id
            ) {
                setCompraSeleccionada(
                    (actual) =>
                        actual
                            ? {
                                ...actual,
                                estado:
                                    "cancelada",
                            }
                            : null
                );
            }

            mostrarMensaje(
                "exito",
                "Compra cancelada",
                "La compra fue cancelada y el inventario fue revertido correctamente."
            );
        } catch (error: any) {
            console.error(
                "Error cancelando compra:",
                error
            );

            mostrarMensaje(
                "error",
                "No se pudo cancelar",
                error?.message ||
                "No se pudo cancelar la compra."
            );
        } finally {
            setCancelando(
                false
            );
        }
    }

    /* =====================================================
       LIMPIAR FILTROS
       ===================================================== */

    function limpiarFiltros() {
        setBusqueda("");

        setFiltroEstado(
            "todos"
        );

        setFiltroSucursal("");

        setFiltroProveedor("");
    }

    const hayFiltros =
        Boolean(
            busqueda ||
            filtroSucursal ||
            filtroProveedor ||
            filtroEstado !==
            "todos"
        );

    /* =====================================================
       LOADING
       ===================================================== */

    if (cargando) {
        return (
            <main
                className="
                    min-h-screen
                    bg-[var(--color-background)]
                    p-4
                    md:p-6
                "
            >
                <div className="mx-auto max-w-7xl">
                    <Card className="p-10 text-center">
                        <div
                            className="
                                mx-auto
                                mb-4
                                h-10
                                w-10
                                animate-spin
                                rounded-full
                                border-4
                                border-[var(--color-border)]
                                border-t-[var(--color-primary)]
                            "
                        />

                        <p
                            className="
                                text-sm
                                font-medium
                                text-[var(--color-text-secondary)]
                            "
                        >
                            Cargando compras...
                        </p>
                    </Card>
                </div>
            </main>
        );
    }

    return (
        <main
            className="
                min-h-screen
                bg-[var(--color-background)]
                p-4
                md:p-6
            "
        >
            <ModalMensaje
                abierto={modal.abierto}
                tipo={modal.tipo}
                titulo={modal.titulo}
                mensaje={modal.mensaje}
                textoBoton={
                    modal.textoBoton
                }
                textoCancelar={
                    modal.textoCancelar
                }
                onCerrar={
                    cerrarModal
                }
                onConfirmar={
                    modal.onConfirmar
                }
            />

            <div
                className="
                    mx-auto
                    max-w-7xl
                    space-y-6
                "
            >
                {/* =================================================
                    ENCABEZADO
                ================================================= */}

                <div
                    className="
                        flex
                        flex-col
                        gap-4
                        lg:flex-row
                        lg:items-center
                        lg:justify-between
                    "
                >
                    <div>
                        <div
                            className="
                                mb-2
                                inline-flex
                                items-center
                                rounded-full
                                border
                                border-[var(--color-border)]
                                bg-[var(--color-surface)]
                                px-3
                                py-1
                                text-xs
                                font-semibold
                                text-[var(--color-text-secondary)]
                            "
                        >
                            Administrador
                        </div>

                        <h1
                            className="
                                text-3xl
                                font-bold
                                tracking-tight
                                text-[var(--color-text)]
                            "
                        >
                            Compras
                        </h1>

                        <p
                            className="
                                mt-1
                                max-w-2xl
                                text-sm
                                text-[var(--color-text-secondary)]
                            "
                        >
                            Registra y consulta las compras realizadas a proveedores.
                        </p>
                    </div>

                    <Button
                        type="button"
                        size="large"
                        onClick={() =>
                            setMostrarNuevaCompra(
                                true
                            )
                        }
                        className="
                            w-full
                            sm:w-auto
                        "
                    >
                        <span className="flex items-center justify-center gap-2">
                            <IconoPlus className="h-5 w-5" />
                            Nueva compra
                        </span>
                    </Button>
                </div>

                {/* =================================================
                    RESUMEN
                ================================================= */}

                <section
                    className="
                        grid
                        gap-4
                        md:grid-cols-3
                    "
                >
                    <Card
                        className="
                            p-5
                            transition
                            duration-200
                            hover:-translate-y-0.5
                            hover:shadow-[var(--shadow-md)]
                        "
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p
                                    className="
                                        text-sm
                                        font-medium
                                        text-[var(--color-text-secondary)]
                                    "
                                >
                                    Compras registradas
                                </p>

                                <p
                                    className="
                                        mt-2
                                        text-3xl
                                        font-bold
                                        text-[var(--color-text)]
                                    "
                                >
                                    {
                                        compras.length
                                    }
                                </p>
                            </div>

                            <div
                                className="
                                    flex
                                    h-11
                                    w-11
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-xl
                                    bg-[var(--color-background)]
                                    text-[var(--color-primary)]
                                "
                            >
                                <IconoDocumento className="h-5 w-5" />
                            </div>
                        </div>

                        <p
                            className="
                                mt-3
                                text-xs
                                text-[var(--color-text-secondary)]
                            "
                        >
                            Total de compras del negocio
                        </p>
                    </Card>

                    <Card
                        className="
                            p-5
                            transition
                            duration-200
                            hover:-translate-y-0.5
                            hover:shadow-[var(--shadow-md)]
                        "
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p
                                    className="
                                        text-sm
                                        font-medium
                                        text-[var(--color-text-secondary)]
                                    "
                                >
                                    Compras recibidas
                                </p>

                                <p
                                    className="
                                        mt-2
                                        text-3xl
                                        font-bold
                                        text-[var(--color-text)]
                                    "
                                >
                                    {
                                        comprasRecibidas
                                    }
                                </p>
                            </div>

                            <div
                                className="
                                    flex
                                    h-11
                                    w-11
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-xl
                                    bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)]
                                    text-[var(--color-success)]
                                "
                            >
                                <IconoCheck className="h-5 w-5" />
                            </div>
                        </div>

                        <p
                            className="
                                mt-3
                                text-xs
                                text-[var(--color-text-secondary)]
                            "
                        >
                            Compras que actualizaron inventario
                        </p>
                    </Card>

                    <Card
                        className="
                            p-5
                            transition
                            duration-200
                            hover:-translate-y-0.5
                            hover:shadow-[var(--shadow-md)]
                        "
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p
                                    className="
                                        text-sm
                                        font-medium
                                        text-[var(--color-text-secondary)]
                                    "
                                >
                                    Total comprado
                                </p>

                                <p
                                    className="
                                        mt-2
                                        text-3xl
                                        font-bold
                                        text-[var(--color-text)]
                                    "
                                >
                                    {
                                        dinero(
                                            totalComprado
                                        )
                                    }
                                </p>
                            </div>

                            <div
                                className="
                                    flex
                                    h-11
                                    w-11
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-xl
                                    bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)]
                                    text-[var(--color-primary)]
                                "
                            >
                                <IconoDinero className="h-5 w-5" />
                            </div>
                        </div>

                        <p
                            className="
                                mt-3
                                text-xs
                                text-[var(--color-text-secondary)]
                            "
                        >
                            Solamente compras recibidas
                        </p>
                    </Card>
                </section>

                {/* =================================================
                    NUEVA COMPRA
                ================================================= */}

                {mostrarNuevaCompra && (
                    <Card
                        className="
                            overflow-hidden
                            p-0
                        "
                    >
                        <div
                            className="
                                flex
                                flex-col
                                gap-3
                                border-b
                                border-[var(--color-border)]
                                bg-[var(--color-background)]
                                px-5
                                py-5
                                sm:flex-row
                                sm:items-center
                                sm:justify-between
                            "
                        >
                            <div>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="
                                            flex
                                            h-10
                                            w-10
                                            shrink-0
                                            items-center
                                            justify-center
                                            rounded-xl
                                            bg-[var(--color-primary)]
                                            text-white
                                        "
                                    >
                                        <IconoPlus className="h-5 w-5" />
                                    </div>

                                    <div>
                                        <h2
                                            className="
                                                font-bold
                                                text-[var(--color-text)]
                                            "
                                        >
                                            Nueva compra
                                        </h2>

                                        <p
                                            className="
                                                mt-1
                                                text-sm
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Selecciona la sucursal, proveedor y productos recibidos.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={() =>
                                    setMostrarNuevaCompra(
                                        false
                                    )
                                }
                            >
                                Cerrar
                            </Button>
                        </div>

                        <div className="space-y-6 p-5">
                            {/* DATOS GENERALES */}

                            <div
                                className="
                                    grid
                                    gap-4
                                    md:grid-cols-3
                                "
                            >
                                <div>
                                    <label
                                        className="
                                            mb-2
                                            block
                                            text-sm
                                            font-semibold
                                            text-[var(--color-text)]
                                        "
                                    >
                                        Sucursal
                                    </label>

                                    <select
                                        value={
                                            sucursalSeleccionada
                                        }
                                        onChange={(e) =>
                                            setSucursalSeleccionada(
                                                e.target
                                                    .value
                                            )
                                        }
                                        className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            px-3
                                            py-3
                                            text-sm
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            focus:border-[var(--color-primary)]
                                            focus:ring-2
                                            focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                        "
                                    >
                                        <option value="">
                                            Seleccionar sucursal
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
                                    <label
                                        className="
                                            mb-2
                                            block
                                            text-sm
                                            font-semibold
                                            text-[var(--color-text)]
                                        "
                                    >
                                        Proveedor
                                    </label>

                                    <select
                                        value={
                                            proveedorSeleccionado
                                        }
                                        onChange={(e) =>
                                            setProveedorSeleccionado(
                                                e.target
                                                    .value
                                            )
                                        }
                                        className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            px-3
                                            py-3
                                            text-sm
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            focus:border-[var(--color-primary)]
                                            focus:ring-2
                                            focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                        "
                                    >
                                        <option value="">
                                            Seleccionar proveedor
                                        </option>

                                        {proveedores.map(
                                            (
                                                proveedor
                                            ) => (
                                                <option
                                                    key={
                                                        proveedor.id
                                                    }
                                                    value={
                                                        proveedor.id
                                                    }
                                                >
                                                    {
                                                        proveedor.nombre
                                                    }
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label
                                        className="
                                            mb-2
                                            block
                                            text-sm
                                            font-semibold
                                            text-[var(--color-text)]
                                        "
                                    >
                                        Referencia
                                    </label>

                                    <input
                                        value={
                                            referencia
                                        }
                                        onChange={(e) =>
                                            setReferencia(
                                                e.target
                                                    .value
                                            )
                                        }
                                        placeholder="Factura, folio, orden de compra..."
                                        className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            px-3
                                            py-3
                                            text-sm
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            placeholder:text-[var(--color-text-secondary)]
                                            focus:border-[var(--color-primary)]
                                            focus:ring-2
                                            focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                        "
                                    />
                                </div>
                            </div>

                            {/* AGREGAR PRODUCTOS */}

                            <div
                                className="
                                    rounded-2xl
                                    border
                                    border-[var(--color-border)]
                                    bg-[var(--color-background)]
                                    p-4
                                "
                            >
                                <div className="mb-4">
                                    <h3
                                        className="
                                            font-bold
                                            text-[var(--color-text)]
                                        "
                                    >
                                        Agregar productos
                                    </h3>

                                    <p
                                        className="
                                            mt-1
                                            text-xs
                                            text-[var(--color-text-secondary)]
                                        "
                                    >
                                        Busca un producto y define la cantidad y costo de compra.
                                    </p>
                                </div>

                                <div
                                    className="
                                        grid
                                        gap-3
                                        md:grid-cols-[1fr_120px_160px_auto]
                                    "
                                >
                                    <div>
                                        <input
                                            value={
                                                busquedaProducto
                                            }
                                            onChange={(e) =>
                                                setBusquedaProducto(
                                                    e.target
                                                        .value
                                                )
                                            }
                                            placeholder="Buscar por nombre, código o SKU..."
                                            className="
                                                w-full
                                                rounded-xl
                                                border
                                                border-[var(--color-border)]
                                                bg-[var(--color-surface)]
                                                px-3
                                                py-3
                                                text-sm
                                                text-[var(--color-text)]
                                                outline-none
                                                transition
                                                placeholder:text-[var(--color-text-secondary)]
                                                focus:border-[var(--color-primary)]
                                                focus:ring-2
                                                focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                            "
                                        />

                                        <select
                                            value={
                                                productoSeleccionado
                                            }
                                            onChange={(e) => {
                                                const id =
                                                    e
                                                        .target
                                                        .value;

                                                setProductoSeleccionado(
                                                    id
                                                );

                                                const producto =
                                                    productos.find(
                                                        (p) =>
                                                            p.id ===
                                                            id
                                                    );

                                                if (
                                                    producto
                                                ) {
                                                    setCostoUnitario(
                                                        String(
                                                            producto.precio_compra ??
                                                            0
                                                        )
                                                    );
                                                }
                                            }}
                                            className="
                                                mt-2
                                                w-full
                                                rounded-xl
                                                border
                                                border-[var(--color-border)]
                                                bg-[var(--color-surface)]
                                                px-3
                                                py-3
                                                text-sm
                                                text-[var(--color-text)]
                                                outline-none
                                                transition
                                                focus:border-[var(--color-primary)]
                                                focus:ring-2
                                                focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                            "
                                        >
                                            <option value="">
                                                Seleccionar producto
                                            </option>

                                            {productosFiltrados.map(
                                                (
                                                    producto
                                                ) => (
                                                    <option
                                                        key={
                                                            producto.id
                                                        }
                                                        value={
                                                            producto.id
                                                        }
                                                    >
                                                        {
                                                            producto.nombre
                                                        }

                                                        {producto.codigo_barras
                                                            ? ` — ${producto.codigo_barras}`
                                                            : ""}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>

                                    <div>
                                        <label
                                            className="
                                                mb-2
                                                block
                                                text-xs
                                                font-semibold
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Cantidad
                                        </label>

                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={
                                                cantidad
                                            }
                                            onChange={(e) =>
                                                setCantidad(
                                                    e
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="
                                                w-full
                                                rounded-xl
                                                border
                                                border-[var(--color-border)]
                                                bg-[var(--color-surface)]
                                                px-3
                                                py-3
                                                text-right
                                                text-sm
                                                text-[var(--color-text)]
                                                outline-none
                                                transition
                                                focus:border-[var(--color-primary)]
                                                focus:ring-2
                                                focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                            "
                                        />
                                    </div>

                                    <div>
                                        <label
                                            className="
                                                mb-2
                                                block
                                                text-xs
                                                font-semibold
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Costo unitario
                                        </label>

                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={
                                                costoUnitario
                                            }
                                            onChange={(e) =>
                                                setCostoUnitario(
                                                    e
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="
                                                w-full
                                                rounded-xl
                                                border
                                                border-[var(--color-border)]
                                                bg-[var(--color-surface)]
                                                px-3
                                                py-3
                                                text-right
                                                text-sm
                                                text-[var(--color-text)]
                                                outline-none
                                                transition
                                                focus:border-[var(--color-primary)]
                                                focus:ring-2
                                                focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                            "
                                        />
                                    </div>

                                    <div className="flex items-end">
                                        <Button
                                            type="button"
                                            onClick={
                                                agregarProducto
                                            }
                                            className="w-full"
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                <IconoPlus className="h-4 w-4" />
                                                Agregar
                                            </span>
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* PRODUCTOS */}

                            <div>
                                <div
                                    className="
                                        mb-3
                                        flex
                                        flex-col
                                        gap-1
                                        sm:flex-row
                                        sm:items-center
                                        sm:justify-between
                                    "
                                >
                                    <div>
                                        <h3
                                            className="
                                                font-bold
                                                text-[var(--color-text)]
                                            "
                                        >
                                            Productos de la compra
                                        </h3>

                                        <p
                                            className="
                                                mt-1
                                                text-xs
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            {
                                                detalles.length
                                            }{" "}
                                            producto
                                            {detalles.length !==
                                                1
                                                ? "s"
                                                : ""}
                                        </p>
                                    </div>
                                </div>

                                {detalles.length ===
                                    0 ? (
                                    <div
                                        className="
                                            rounded-2xl
                                            border
                                            border-dashed
                                            border-[var(--color-border)]
                                            bg-[var(--color-background)]
                                            p-10
                                            text-center
                                        "
                                    >
                                        <div
                                            className="
                                                mx-auto
                                                mb-3
                                                flex
                                                h-12
                                                w-12
                                                items-center
                                                justify-center
                                                rounded-2xl
                                                bg-[var(--color-surface)]
                                                text-[var(--color-primary)]
                                            "
                                        >
                                            <IconoCarrito className="h-6 w-6" />
                                        </div>

                                        <p
                                            className="
                                                text-sm
                                                font-medium
                                                text-[var(--color-text)]
                                            "
                                        >
                                            Aún no has agregado productos.
                                        </p>

                                        <p
                                            className="
                                                mt-1
                                                text-xs
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Utiliza el buscador de arriba para comenzar.
                                        </p>
                                    </div>
                                ) : (
                                    <div
                                        className="
                                            overflow-x-auto
                                            rounded-2xl
                                            border
                                            border-[var(--color-border)]
                                        "
                                    >
                                        <table className="w-full min-w-[850px] text-sm">
                                            <thead
                                                className="
                                                    bg-[var(--color-background)]
                                                "
                                            >
                                                <tr>
                                                    <th
                                                        className="
                                                            px-4
                                                            py-3
                                                            text-left
                                                            text-xs
                                                            font-semibold
                                                            uppercase
                                                            tracking-wide
                                                            text-[var(--color-text-secondary)]
                                                        "
                                                    >
                                                        Producto
                                                    </th>

                                                    <th
                                                        className="
                                                            px-4
                                                            py-3
                                                            text-right
                                                            text-xs
                                                            font-semibold
                                                            uppercase
                                                            tracking-wide
                                                            text-[var(--color-text-secondary)]
                                                        "
                                                    >
                                                        Cantidad
                                                    </th>

                                                    <th
                                                        className="
                                                            px-4
                                                            py-3
                                                            text-right
                                                            text-xs
                                                            font-semibold
                                                            uppercase
                                                            tracking-wide
                                                            text-[var(--color-text-secondary)]
                                                        "
                                                    >
                                                        Costo
                                                    </th>

                                                    <th
                                                        className="
                                                            px-4
                                                            py-3
                                                            text-right
                                                            text-xs
                                                            font-semibold
                                                            uppercase
                                                            tracking-wide
                                                            text-[var(--color-text-secondary)]
                                                        "
                                                    >
                                                        Subtotal
                                                    </th>

                                                    <th
                                                        className="
                                                            px-4
                                                            py-3
                                                            text-right
                                                            text-xs
                                                            font-semibold
                                                            uppercase
                                                            tracking-wide
                                                            text-[var(--color-text-secondary)]
                                                        "
                                                    >
                                                        Total
                                                    </th>

                                                    <th className="px-4 py-3" />
                                                </tr>
                                            </thead>

                                            <tbody
                                                className="
                                                    divide-y
                                                    divide-[var(--color-border)]
                                                "
                                            >
                                                {detalles.map(
                                                    (
                                                        detalle
                                                    ) => {
                                                        const subtotalDetalle =
                                                            detalle.cantidad *
                                                            detalle.costo_unitario -
                                                            detalle.descuento;

                                                        const totalDetalle =
                                                            subtotalDetalle +
                                                            detalle.impuesto;

                                                        return (
                                                            <tr
                                                                key={
                                                                    detalle.producto_id
                                                                }
                                                                className="
                                                                    transition
                                                                    hover:bg-[var(--color-background)]
                                                                "
                                                            >
                                                                <td className="px-4 py-4">
                                                                    <div
                                                                        className="
                                                                            font-semibold
                                                                            text-[var(--color-text)]
                                                                        "
                                                                    >
                                                                        {
                                                                            detalle
                                                                                .producto
                                                                                ?.nombre
                                                                        }
                                                                    </div>

                                                                    <div
                                                                        className="
                                                                            mt-1
                                                                            text-xs
                                                                            text-[var(--color-text-secondary)]
                                                                        "
                                                                    >
                                                                        {detalle.producto?.sku ||
                                                                            detalle
                                                                                .producto
                                                                                ?.codigo_barras ||
                                                                            "Sin código"}
                                                                    </div>
                                                                </td>

                                                                <td className="px-4 py-4 text-right">
                                                                    <input
                                                                        type="number"
                                                                        min="0.01"
                                                                        step="0.01"
                                                                        value={
                                                                            detalle.cantidad
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            actualizarDetalle(
                                                                                detalle.producto_id,
                                                                                "cantidad",
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        className="
                                                                            w-24
                                                                            rounded-lg
                                                                            border
                                                                            border-[var(--color-border)]
                                                                            bg-[var(--color-surface)]
                                                                            px-2
                                                                            py-2
                                                                            text-right
                                                                            text-[var(--color-text)]
                                                                            outline-none
                                                                            focus:border-[var(--color-primary)]
                                                                        "
                                                                    />
                                                                </td>

                                                                <td className="px-4 py-4 text-right">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={
                                                                            detalle.costo_unitario
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            actualizarDetalle(
                                                                                detalle.producto_id,
                                                                                "costo_unitario",
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        className="
                                                                            w-28
                                                                            rounded-lg
                                                                            border
                                                                            border-[var(--color-border)]
                                                                            bg-[var(--color-surface)]
                                                                            px-2
                                                                            py-2
                                                                            text-right
                                                                            text-[var(--color-text)]
                                                                            outline-none
                                                                            focus:border-[var(--color-primary)]
                                                                        "
                                                                    />
                                                                </td>

                                                                <td
                                                                    className="
                                                                        px-4
                                                                        py-4
                                                                        text-right
                                                                        text-[var(--color-text-secondary)]
                                                                    "
                                                                >
                                                                    {dinero(
                                                                        subtotalDetalle
                                                                    )}
                                                                </td>

                                                                <td
                                                                    className="
                                                                        px-4
                                                                        py-4
                                                                        text-right
                                                                        font-bold
                                                                        text-[var(--color-text)]
                                                                    "
                                                                >
                                                                    {dinero(
                                                                        totalDetalle
                                                                    )}
                                                                </td>

                                                                <td className="px-4 py-4 text-right">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="small"
                                                                        onClick={() =>
                                                                            eliminarDetalle(
                                                                                detalle.producto_id
                                                                            )
                                                                        }
                                                                        className="
                                                                            !px-3
                                                                            !py-2
                                                                            !text-[var(--color-danger)]
                                                                        "
                                                                    >
                                                                        Eliminar
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
                            </div>

                            {/* NOTAS Y TOTALES */}

                            <div
                                className="
                                    grid
                                    gap-6
                                    md:grid-cols-2
                                "
                            >
                                <div>
                                    <label
                                        className="
                                            mb-2
                                            block
                                            text-sm
                                            font-semibold
                                            text-[var(--color-text)]
                                        "
                                    >
                                        Notas
                                    </label>

                                    <textarea
                                        value={
                                            notas
                                        }
                                        onChange={(e) =>
                                            setNotas(
                                                e
                                                    .target
                                                    .value
                                            )
                                        }
                                        rows={6}
                                        placeholder="Notas adicionales de la compra..."
                                        className="
                                            w-full
                                            resize-none
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            px-3
                                            py-3
                                            text-sm
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            placeholder:text-[var(--color-text-secondary)]
                                            focus:border-[var(--color-primary)]
                                            focus:ring-2
                                            focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                        "
                                    />
                                </div>

                                <div
                                    className="
                                        rounded-2xl
                                        border
                                        border-[var(--color-border)]
                                        bg-[var(--color-background)]
                                        p-5
                                    "
                                >
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between gap-4">
                                            <span
                                                className="
                                                    text-[var(--color-text-secondary)]
                                                "
                                            >
                                                Subtotal
                                            </span>

                                            <span
                                                className="
                                                    font-semibold
                                                    text-[var(--color-text)]
                                                "
                                            >
                                                {dinero(
                                                    subtotal
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex justify-between gap-4">
                                            <span
                                                className="
                                                    text-[var(--color-text-secondary)]
                                                "
                                            >
                                                Descuento
                                            </span>

                                            <span
                                                className="
                                                    font-semibold
                                                    text-[var(--color-text)]
                                                "
                                            >
                                                {dinero(
                                                    descuentoTotal
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex justify-between gap-4">
                                            <span
                                                className="
                                                    text-[var(--color-text-secondary)]
                                                "
                                            >
                                                Impuesto
                                            </span>

                                            <span
                                                className="
                                                    font-semibold
                                                    text-[var(--color-text)]
                                                "
                                            >
                                                {dinero(
                                                    impuestoTotal
                                                )}
                                            </span>
                                        </div>

                                        <div
                                            className="
                                                border-t
                                                border-[var(--color-border)]
                                                pt-4
                                            "
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <span
                                                    className="
                                                        font-bold
                                                        text-[var(--color-text)]
                                                    "
                                                >
                                                    Total
                                                </span>

                                                <span
                                                    className="
                                                        text-2xl
                                                        font-bold
                                                        text-[var(--color-primary)]
                                                    "
                                                >
                                                    {dinero(
                                                        total
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BOTONES */}

                            <div
                                className="
                                    flex
                                    flex-col-reverse
                                    gap-3
                                    border-t
                                    border-[var(--color-border)]
                                    pt-5
                                    sm:flex-row
                                    sm:justify-end
                                "
                            >
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="large"
                                    onClick={() =>
                                        setMostrarNuevaCompra(
                                            false
                                        )
                                    }
                                    className="w-full sm:w-auto"
                                >
                                    Cancelar
                                </Button>

                                <Button
                                    type="button"
                                    variant="primary"
                                    size="large"
                                    onClick={
                                        registrarCompra
                                    }
                                    disabled={
                                        guardando ||
                                        detalles.length ===
                                        0 ||
                                        !sucursalSeleccionada ||
                                        !proveedorSeleccionado
                                    }
                                    className="w-full sm:w-auto"
                                >
                                    {guardando ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span
                                                className="
                                                    h-4
                                                    w-4
                                                    animate-spin
                                                    rounded-full
                                                    border-2
                                                    border-white/40
                                                    border-t-white
                                                "
                                            />

                                            Registrando compra...
                                        </span>
                                    ) : (
                                        "Registrar compra"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                {/* =================================================
                    HISTORIAL
                ================================================= */}

                <Card className="overflow-hidden p-0">
                    <div
                        className="
                            border-b
                            border-[var(--color-border)]
                            px-5
                            py-5
                        "
                    >
                        <div
                            className="
                                flex
                                flex-col
                                gap-4
                                lg:flex-row
                                lg:items-center
                                lg:justify-between
                            "
                        >
                            <div>
                                <h2
                                    className="
                                        text-lg
                                        font-bold
                                        text-[var(--color-text)]
                                    "
                                >
                                    Historial de compras
                                </h2>

                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        text-[var(--color-text-secondary)]
                                    "
                                >
                                    Consulta, filtra y administra las compras registradas.
                                </p>
                            </div>

                            <div
                                className="
                                    inline-flex
                                    w-fit
                                    rounded-xl
                                    border
                                    border-[var(--color-border)]
                                    bg-[var(--color-background)]
                                    px-3
                                    py-2
                                    text-xs
                                    font-semibold
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                {
                                    comprasFiltradas.length
                                }{" "}
                                resultado
                                {comprasFiltradas.length !==
                                    1
                                    ? "s"
                                    : ""}
                            </div>
                        </div>
                    </div>

                    {/* FILTROS */}

                    <div
                        className="
                            bg-[var(--color-background)]
                            p-5
                        "
                    >
                        <div
                            className="
                                grid
                                gap-3
                                lg:grid-cols-[1fr_180px_180px_180px_auto]
                            "
                        >
                            <div>
                                <label
                                    className="
                                        mb-2
                                        block
                                        text-xs
                                        font-bold
                                        uppercase
                                        tracking-wide
                                        text-[var(--color-text-secondary)]
                                    "
                                >
                                    Buscar
                                </label>

                                <div className="relative">
                                    <IconoBusqueda
                                        className="
                                            pointer-events-none
                                            absolute
                                            left-3
                                            top-1/2
                                            h-4
                                            w-4
                                            -translate-y-1/2
                                            text-[var(--color-text-secondary)]
                                        "
                                    />

                                    <input
                                        value={
                                            busqueda
                                        }
                                        onChange={(e) =>
                                            setBusqueda(
                                                e
                                                    .target
                                                    .value
                                            )
                                        }
                                        placeholder="Proveedor, sucursal, referencia..."
                                        className="
                                            w-full
                                            rounded-xl
                                            border
                                            border-[var(--color-border)]
                                            bg-[var(--color-surface)]
                                            py-3
                                            pl-10
                                            pr-3
                                            text-sm
                                            text-[var(--color-text)]
                                            outline-none
                                            transition
                                            placeholder:text-[var(--color-text-secondary)]
                                            focus:border-[var(--color-primary)]
                                            focus:ring-2
                                            focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                        "
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    className="
                                        mb-2
                                        block
                                        text-xs
                                        font-bold
                                        uppercase
                                        tracking-wide
                                        text-[var(--color-text-secondary)]
                                    "
                                >
                                    Estado
                                </label>

                                <select
                                    value={
                                        filtroEstado
                                    }
                                    onChange={(e) =>
                                        setFiltroEstado(
                                            e.target
                                                .value as FiltroEstado
                                        )
                                    }
                                    className="
                                        w-full
                                        rounded-xl
                                        border
                                        border-[var(--color-border)]
                                        bg-[var(--color-surface)]
                                        px-3
                                        py-3
                                        text-sm
                                        font-medium
                                        text-[var(--color-text)]
                                        outline-none
                                        transition
                                        focus:border-[var(--color-primary)]
                                        focus:ring-2
                                        focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                    "
                                >
                                    <option value="todos">
                                        Todos los estados
                                    </option>

                                    <option value="recibida">
                                        Recibidas
                                    </option>

                                    <option value="cancelada">
                                        Canceladas
                                    </option>
                                </select>
                            </div>

                            <div>
                                <label
                                    className="
                                        mb-2
                                        block
                                        text-xs
                                        font-bold
                                        uppercase
                                        tracking-wide
                                        text-[var(--color-text-secondary)]
                                    "
                                >
                                    Sucursal
                                </label>

                                <select
                                    value={
                                        filtroSucursal
                                    }
                                    onChange={(e) =>
                                        setFiltroSucursal(
                                            e.target
                                                .value
                                        )
                                    }
                                    className="
                                        w-full
                                        rounded-xl
                                        border
                                        border-[var(--color-border)]
                                        bg-[var(--color-surface)]
                                        px-3
                                        py-3
                                        text-sm
                                        font-medium
                                        text-[var(--color-text)]
                                        outline-none
                                        transition
                                        focus:border-[var(--color-primary)]
                                        focus:ring-2
                                        focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                    "
                                >
                                    <option value="">
                                        Todas las sucursales
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
                                <label
                                    className="
                                        mb-2
                                        block
                                        text-xs
                                        font-bold
                                        uppercase
                                        tracking-wide
                                        text-[var(--color-text-secondary)]
                                    "
                                >
                                    Proveedor
                                </label>

                                <select
                                    value={
                                        filtroProveedor
                                    }
                                    onChange={(e) =>
                                        setFiltroProveedor(
                                            e.target
                                                .value
                                        )
                                    }
                                    className="
                                        w-full
                                        rounded-xl
                                        border
                                        border-[var(--color-border)]
                                        bg-[var(--color-surface)]
                                        px-3
                                        py-3
                                        text-sm
                                        font-medium
                                        text-[var(--color-text)]
                                        outline-none
                                        transition
                                        focus:border-[var(--color-primary)]
                                        focus:ring-2
                                        focus:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]
                                    "
                                >
                                    <option value="">
                                        Todos los proveedores
                                    </option>

                                    {proveedores.map(
                                        (
                                            proveedor
                                        ) => (
                                            <option
                                                key={
                                                    proveedor.id
                                                }
                                                value={
                                                    proveedor.id
                                                }
                                            >
                                                {
                                                    proveedor.nombre
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <div className="flex items-end">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="medium"
                                    onClick={
                                        limpiarFiltros
                                    }
                                    disabled={
                                        !hayFiltros
                                    }
                                    className="w-full lg:w-auto"
                                >
                                    Limpiar
                                </Button>
                            </div>
                        </div>

                        {/* FILTROS RÁPIDOS */}

                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setFiltroEstado(
                                        "todos"
                                    )
                                }
                                className="
                                    rounded-full
                                    border
                                    px-3
                                    py-1.5
                                    text-xs
                                    font-bold
                                    transition
                                "
                                style={{
                                    backgroundColor:
                                        filtroEstado ===
                                            "todos"
                                            ? "var(--color-primary)"
                                            : "var(--color-surface)",

                                    color:
                                        filtroEstado ===
                                            "todos"
                                            ? "#ffffff"
                                            : "var(--color-text-secondary)",

                                    borderColor:
                                        filtroEstado ===
                                            "todos"
                                            ? "var(--color-primary)"
                                            : "var(--color-border)",
                                }}
                            >
                                Todas ·{" "}
                                {
                                    compras.length
                                }
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setFiltroEstado(
                                        "recibida"
                                    )
                                }
                                className="
                                    rounded-full
                                    border
                                    px-3
                                    py-1.5
                                    text-xs
                                    font-bold
                                    transition
                                "
                                style={{
                                    backgroundColor:
                                        filtroEstado ===
                                            "recibida"
                                            ? "var(--color-success)"
                                            : "var(--color-surface)",

                                    color:
                                        filtroEstado ===
                                            "recibida"
                                            ? "#ffffff"
                                            : "var(--color-text-secondary)",

                                    borderColor:
                                        filtroEstado ===
                                            "recibida"
                                            ? "var(--color-success)"
                                            : "var(--color-border)",
                                }}
                            >
                                Recibidas ·{" "}
                                {
                                    comprasRecibidas
                                }
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setFiltroEstado(
                                        "cancelada"
                                    )
                                }
                                className="
                                    rounded-full
                                    border
                                    px-3
                                    py-1.5
                                    text-xs
                                    font-bold
                                    transition
                                "
                                style={{
                                    backgroundColor:
                                        filtroEstado ===
                                            "cancelada"
                                            ? "var(--color-danger)"
                                            : "var(--color-surface)",

                                    color:
                                        filtroEstado ===
                                            "cancelada"
                                            ? "#ffffff"
                                            : "var(--color-text-secondary)",

                                    borderColor:
                                        filtroEstado ===
                                            "cancelada"
                                            ? "var(--color-danger)"
                                            : "var(--color-border)",
                                }}
                            >
                                Canceladas ·{" "}
                                {
                                    comprasCanceladas
                                }
                            </button>
                        </div>
                    </div>

                    {/* =================================================
                        TABLA
                    ================================================= */}

                    {compras.length ===
                        0 ? (
                        <div className="p-10 text-center sm:p-12">
                            <div
                                className="
                                    mx-auto
                                    mb-4
                                    flex
                                    h-16
                                    w-16
                                    items-center
                                    justify-center
                                    rounded-2xl
                                    bg-[var(--color-background)]
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                <IconoDocumento className="h-7 w-7" />
                            </div>

                            <p
                                className="
                                    text-sm
                                    font-semibold
                                    text-[var(--color-text)]
                                "
                            >
                                No hay compras registradas.
                            </p>

                            <p
                                className="
                                    mt-1
                                    text-xs
                                    leading-5
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                Registra tu primera compra para comenzar.
                            </p>

                            <Button
                                type="button"
                                size="small"
                                onClick={() =>
                                    setMostrarNuevaCompra(
                                        true
                                    )
                                }
                                className="mt-5"
                            >
                                <span className="flex items-center gap-2">
                                    <IconoPlus className="h-4 w-4" />
                                    Registrar compra
                                </span>
                            </Button>
                        </div>
                    ) : comprasFiltradas.length ===
                        0 ? (
                        <div className="p-10 text-center sm:p-12">
                            <div
                                className="
                                    mx-auto
                                    mb-4
                                    flex
                                    h-16
                                    w-16
                                    items-center
                                    justify-center
                                    rounded-2xl
                                    bg-[var(--color-background)]
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                <IconoBusqueda className="h-7 w-7" />
                            </div>

                            <p
                                className="
                                    text-sm
                                    font-semibold
                                    text-[var(--color-text)]
                                "
                            >
                                No encontramos compras.
                            </p>

                            <p
                                className="
                                    mt-1
                                    text-xs
                                    leading-5
                                    text-[var(--color-text-secondary)]
                                "
                            >
                                Prueba cambiando los filtros o el término de búsqueda.
                            </p>

                            <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={
                                    limpiarFiltros
                                }
                                className="mt-5"
                            >
                                Limpiar filtros
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1050px] text-sm">
                                <thead
                                    className="
                                        border-b
                                        border-[var(--color-border)]
                                        bg-[var(--color-surface)]
                                    "
                                >
                                    <tr>
                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-left
                                                text-xs
                                                font-bold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Fecha
                                        </th>

                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-left
                                                text-xs
                                                font-bold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Proveedor
                                        </th>

                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-left
                                                text-xs
                                                font-bold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Sucursal
                                        </th>

                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-left
                                                text-xs
                                                font-bold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Referencia
                                        </th>

                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-center
                                                text-xs
                                                font-bold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Estado
                                        </th>

                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-right
                                                text-xs
                                                font-bold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Total
                                        </th>

                                        <th
                                            className="
                                                px-5
                                                py-4
                                                text-right
                                                text-xs
                                                font-bold
                                                uppercase
                                                tracking-wide
                                                text-[var(--color-text-secondary)]
                                            "
                                        >
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>

                                <tbody
                                    className="
                                        divide-y
                                        divide-[var(--color-border)]
                                    "
                                >
                                    {comprasFiltradas.map(
                                        (
                                            compra
                                        ) => {
                                            const cancelada =
                                                compra.estado ===
                                                "cancelada";

                                            return (
                                                <tr
                                                    key={
                                                        compra.id
                                                    }
                                                    className="
                                                        transition
                                                        hover:bg-[var(--color-background)]
                                                    "
                                                    style={
                                                        cancelada
                                                            ? {
                                                                backgroundColor:
                                                                    "color-mix(in_srgb,var(--color-danger)_5%,transparent)",
                                                            }
                                                            : undefined
                                                    }
                                                >
                                                    <td className="px-5 py-4">
                                                        <div
                                                            className="
                                                                font-medium
                                                                text-[var(--color-text)]
                                                            "
                                                        >
                                                            {fecha(
                                                                compra.created_at
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <div
                                                            className="
                                                                font-semibold
                                                                text-[var(--color-text)]
                                                            "
                                                        >
                                                            {compra.proveedor
                                                                ?.nombre ||
                                                                "Sin proveedor"}
                                                        </div>
                                                    </td>

                                                    <td
                                                        className="
                                                            px-5
                                                            py-4
                                                            text-[var(--color-text-secondary)]
                                                        "
                                                    >
                                                        {compra.sucursal
                                                            ?.nombre ||
                                                            "Sin sucursal"}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        {compra.referencia ? (
                                                            <span
                                                                className="
                                                                    inline-flex
                                                                    max-w-[220px]
                                                                    truncate
                                                                    rounded-lg
                                                                    border
                                                                    border-[var(--color-border)]
                                                                    bg-[var(--color-background)]
                                                                    px-2.5
                                                                    py-1
                                                                    text-xs
                                                                    font-semibold
                                                                    text-[var(--color-text-secondary)]
                                                                "
                                                            >
                                                                {
                                                                    compra.referencia
                                                                }
                                                            </span>
                                                        ) : (
                                                            <span
                                                                className="
                                                                    text-[var(--color-text-secondary)]
                                                                "
                                                            >
                                                                —
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="px-5 py-4 text-center">
                                                        <span
                                                            className="
                                                                inline-flex
                                                                items-center
                                                                gap-1.5
                                                                rounded-full
                                                                px-3
                                                                py-1.5
                                                                text-xs
                                                                font-bold
                                                            "
                                                            style={{
                                                                backgroundColor:
                                                                    cancelada
                                                                        ? "color-mix(in_srgb,var(--color-danger)_12%,transparent)"
                                                                        : compra.estado ===
                                                                            "recibida"
                                                                            ? "color-mix(in_srgb,var(--color-success)_12%,transparent)"
                                                                            : "var(--color-background)",

                                                                color:
                                                                    cancelada
                                                                        ? "var(--color-danger)"
                                                                        : compra.estado ===
                                                                            "recibida"
                                                                            ? "var(--color-success)"
                                                                            : "var(--color-text-secondary)",
                                                            }}
                                                        >
                                                            <span
                                                                className="
                                                                    h-1.5
                                                                    w-1.5
                                                                    rounded-full
                                                                "
                                                                style={{
                                                                    backgroundColor:
                                                                        cancelada
                                                                            ? "var(--color-danger)"
                                                                            : compra.estado ===
                                                                                "recibida"
                                                                                ? "var(--color-success)"
                                                                                : "var(--color-text-secondary)",
                                                                }}
                                                            />

                                                            {nombreEstado(
                                                                compra.estado
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-right">
                                                        <span
                                                            className="
                                                                font-bold
                                                            "
                                                            style={{
                                                                color:
                                                                    cancelada
                                                                        ? "var(--color-text-secondary)"
                                                                        : "var(--color-text)",
                                                                textDecoration:
                                                                    cancelada
                                                                        ? "line-through"
                                                                        : undefined,
                                                            }}
                                                        >
                                                            {dinero(
                                                                compra.total
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                size="small"
                                                                onClick={() =>
                                                                    verDetalleCompra(
                                                                        compra
                                                                    )
                                                                }
                                                                className="
                                                                    inline-flex
                                                                    items-center
                                                                    gap-1.5
                                                                "
                                                            >
                                                                <IconoOjo className="h-4 w-4" />
                                                                Ver detalle
                                                            </Button>

                                                            {!cancelada && (
                                                                <Button
                                                                    type="button"
                                                                    variant="danger"
                                                                    size="small"
                                                                    disabled={
                                                                        cancelando
                                                                    }
                                                                    onClick={() =>
                                                                        solicitarCancelarCompra(
                                                                            compra
                                                                        )
                                                                    }
                                                                >
                                                                    Cancelar
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
            </div>

            {/* =========================================================
                MODAL DETALLE
            ========================================================= */}

            {mostrarDetalle && (
                <div
                    className="
                        fixed
                        inset-0
                        z-50
                        flex
                        items-center
                        justify-center
                        bg-[color-mix(in_srgb,var(--color-text)_65%,transparent)]
                        p-2
                        backdrop-blur-sm
                        sm:p-4
                    "
                >
                    <div
                        className="
                            flex
                            max-h-[96vh]
                            w-full
                            max-w-6xl
                            flex-col
                            overflow-hidden
                            rounded-2xl
                            border
                            border-[var(--color-border)]
                            bg-[var(--color-surface)]
                            shadow-2xl
                            sm:max-h-[92vh]
                            sm:rounded-3xl
                        "
                    >
                        {/* HEADER */}

                        <div
                            className="
                                flex
                                items-center
                                justify-between
                                gap-4
                                border-b
                                border-[var(--color-border)]
                                px-4
                                py-4
                                sm:px-5
                                sm:py-5
                            "
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="
                                            flex
                                            h-10
                                            w-10
                                            shrink-0
                                            items-center
                                            justify-center
                                            rounded-xl
                                            bg-[var(--color-primary)]
                                            text-white
                                        "
                                    >
                                        <IconoDocumento className="h-5 w-5" />
                                    </div>

                                    <div className="min-w-0">
                                        <h2
                                            className="
                                                text-lg
                                                font-bold
                                                text-[var(--color-text)]
                                            "
                                        >
                                            Detalle de compra
                                        </h2>

                                        {compraSeleccionada && (
                                            <p
                                                className="
                                                    mt-1
                                                    truncate
                                                    text-xs
                                                    text-[var(--color-text-secondary)]
                                                "
                                            >
                                                {
                                                    compraSeleccionada
                                                        .proveedor
                                                        ?.nombre
                                                }

                                                {" · "}

                                                {fecha(
                                                    compraSeleccionada.created_at
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                onClick={
                                    cerrarDetalleCompra
                                }
                                aria-label="Cerrar detalle"
                                className="
                                    !h-10
                                    !w-10
                                    !px-0
                                    !py-0
                                "
                            >
                                <IconoX className="mx-auto h-5 w-5" />
                            </Button>
                        </div>

                        {/* CONTENIDO */}

                        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                            {cargandoDetalle ? (
                                <div className="p-10 text-center sm:p-12">
                                    <div
                                        className="
                                            mx-auto
                                            mb-4
                                            flex
                                            h-11
                                            w-11
                                            items-center
                                            justify-center
                                            rounded-2xl
                                            bg-[var(--color-background)]
                                        "
                                    >
                                        <div
                                            className="
                                                h-6
                                                w-6
                                                animate-spin
                                                rounded-full
                                                border-[3px]
                                                border-[var(--color-border)]
                                                border-t-[var(--color-primary)]
                                            "
                                        />
                                    </div>

                                    <p
                                        className="
                                            text-sm
                                            font-semibold
                                            text-[var(--color-text-secondary)]
                                        "
                                    >
                                        Cargando detalle...
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-5 sm:space-y-6">
                                    {/* INFORMACIÓN */}

                                    {compraSeleccionada && (
                                        <div
                                            className="
                                                grid
                                                gap-3
                                                sm:grid-cols-2
                                                lg:grid-cols-4
                                            "
                                        >
                                            {[
                                                {
                                                    titulo: "Sucursal",
                                                    valor:
                                                        compraSeleccionada
                                                            .sucursal
                                                            ?.nombre ||
                                                        "Sin sucursal",
                                                },
                                                {
                                                    titulo: "Proveedor",
                                                    valor:
                                                        compraSeleccionada
                                                            .proveedor
                                                            ?.nombre ||
                                                        "Sin proveedor",
                                                },
                                                {
                                                    titulo: "Referencia",
                                                    valor:
                                                        compraSeleccionada.referencia ||
                                                        "—",
                                                },
                                            ].map(
                                                (
                                                    item
                                                ) => (
                                                    <div
                                                        key={
                                                            item.titulo
                                                        }
                                                        className="
                                                            rounded-2xl
                                                            border
                                                            border-[var(--color-border)]
                                                            bg-[var(--color-background)]
                                                            p-4
                                                        "
                                                    >
                                                        <p
                                                            className="
                                                                text-xs
                                                                font-bold
                                                                uppercase
                                                                tracking-wide
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            {
                                                                item.titulo
                                                            }
                                                        </p>

                                                        <p
                                                            className="
                                                                mt-2
                                                                break-words
                                                                font-bold
                                                                text-[var(--color-text)]
                                                            "
                                                        >
                                                            {
                                                                item.valor
                                                            }
                                                        </p>
                                                    </div>
                                                )
                                            )}

                                            <div
                                                className="
                                                    rounded-2xl
                                                    border
                                                    border-[var(--color-border)]
                                                    bg-[var(--color-background)]
                                                    p-4
                                                "
                                            >
                                                <p
                                                    className="
                                                        text-xs
                                                        font-bold
                                                        uppercase
                                                        tracking-wide
                                                        text-[var(--color-text-secondary)]
                                                    "
                                                >
                                                    Estado
                                                </p>

                                                <div className="mt-2">
                                                    <span
                                                        className="
                                                            inline-flex
                                                            items-center
                                                            gap-1.5
                                                            rounded-full
                                                            px-3
                                                            py-1
                                                            text-xs
                                                            font-bold
                                                        "
                                                        style={{
                                                            backgroundColor:
                                                                compraSeleccionada.estado ===
                                                                    "cancelada"
                                                                    ? "color-mix(in_srgb,var(--color-danger)_12%,transparent)"
                                                                    : "color-mix(in_srgb,var(--color-success)_12%,transparent)",

                                                            color:
                                                                compraSeleccionada.estado ===
                                                                    "cancelada"
                                                                    ? "var(--color-danger)"
                                                                    : "var(--color-success)",
                                                        }}
                                                    >
                                                        <span
                                                            className="
                                                                h-1.5
                                                                w-1.5
                                                                rounded-full
                                                            "
                                                            style={{
                                                                backgroundColor:
                                                                    compraSeleccionada.estado ===
                                                                        "cancelada"
                                                                        ? "var(--color-danger)"
                                                                        : "var(--color-success)",
                                                            }}
                                                        />

                                                        {nombreEstado(
                                                            compraSeleccionada.estado
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* PRODUCTOS */}

                                    {detallesCompra.length ===
                                        0 ? (
                                        <div
                                            className="
                                                rounded-2xl
                                                border
                                                border-dashed
                                                border-[var(--color-border)]
                                                bg-[var(--color-background)]
                                                p-8
                                                text-center
                                                sm:p-10
                                            "
                                        >
                                            <div
                                                className="
                                                    mx-auto
                                                    mb-3
                                                    flex
                                                    h-11
                                                    w-11
                                                    items-center
                                                    justify-center
                                                    rounded-xl
                                                    bg-[var(--color-surface)]
                                                    text-[var(--color-text-secondary)]
                                                "
                                            >
                                                <IconoDocumento className="h-5 w-5" />
                                            </div>

                                            <p
                                                className="
                                                    text-sm
                                                    font-medium
                                                    text-[var(--color-text-secondary)]
                                                "
                                            >
                                                Esta compra no tiene productos registrados.
                                            </p>
                                        </div>
                                    ) : (
                                        <div
                                            className="
                                                overflow-x-auto
                                                rounded-2xl
                                                border
                                                border-[var(--color-border)]
                                            "
                                        >
                                            <table className="w-full min-w-[850px] text-sm">
                                                <thead
                                                    className="
                                                        bg-[var(--color-background)]
                                                    "
                                                >
                                                    <tr>
                                                        <th
                                                            className="
                                                                px-4
                                                                py-3
                                                                text-left
                                                                text-xs
                                                                font-bold
                                                                uppercase
                                                                tracking-wide
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            Producto
                                                        </th>

                                                        <th
                                                            className="
                                                                px-4
                                                                py-3
                                                                text-right
                                                                text-xs
                                                                font-bold
                                                                uppercase
                                                                tracking-wide
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            Cantidad
                                                        </th>

                                                        <th
                                                            className="
                                                                px-4
                                                                py-3
                                                                text-right
                                                                text-xs
                                                                font-bold
                                                                uppercase
                                                                tracking-wide
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            Costo unitario
                                                        </th>

                                                        <th
                                                            className="
                                                                px-4
                                                                py-3
                                                                text-right
                                                                text-xs
                                                                font-bold
                                                                uppercase
                                                                tracking-wide
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            Descuento
                                                        </th>

                                                        <th
                                                            className="
                                                                px-4
                                                                py-3
                                                                text-right
                                                                text-xs
                                                                font-bold
                                                                uppercase
                                                                tracking-wide
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            Impuesto
                                                        </th>

                                                        <th
                                                            className="
                                                                px-4
                                                                py-3
                                                                text-right
                                                                text-xs
                                                                font-bold
                                                                uppercase
                                                                tracking-wide
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            Subtotal
                                                        </th>

                                                        <th
                                                            className="
                                                                px-4
                                                                py-3
                                                                text-right
                                                                text-xs
                                                                font-bold
                                                                uppercase
                                                                tracking-wide
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            Total
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody
                                                    className="
                                                        divide-y
                                                        divide-[var(--color-border)]
                                                    "
                                                >
                                                    {detallesCompra.map(
                                                        (
                                                            detalle,
                                                            indice
                                                        ) => (
                                                            <tr
                                                                key={`${detalle.producto_id}-${indice}`}
                                                                className="
                                                                    transition
                                                                    hover:bg-[var(--color-background)]
                                                                "
                                                            >
                                                                <td className="px-4 py-4">
                                                                    <div
                                                                        className="
                                                                            font-semibold
                                                                            text-[var(--color-text)]
                                                                        "
                                                                    >
                                                                        {detalle.producto
                                                                            ?.nombre ||
                                                                            "Producto"}
                                                                    </div>

                                                                    <div
                                                                        className="
                                                                            mt-1
                                                                            text-xs
                                                                            text-[var(--color-text-secondary)]
                                                                        "
                                                                    >
                                                                        {detalle.producto?.sku ||
                                                                            detalle
                                                                                .producto
                                                                                ?.codigo_barras ||
                                                                            "Sin código"}
                                                                    </div>
                                                                </td>

                                                                <td
                                                                    className="
                                                                        px-4
                                                                        py-4
                                                                        text-right
                                                                        text-[var(--color-text)]
                                                                    "
                                                                >
                                                                    {
                                                                        detalle.cantidad
                                                                    }
                                                                </td>

                                                                <td
                                                                    className="
                                                                        px-4
                                                                        py-4
                                                                        text-right
                                                                        text-[var(--color-text)]
                                                                    "
                                                                >
                                                                    {dinero(
                                                                        detalle.costo_unitario
                                                                    )}
                                                                </td>

                                                                <td
                                                                    className="
                                                                        px-4
                                                                        py-4
                                                                        text-right
                                                                        text-[var(--color-text-secondary)]
                                                                    "
                                                                >
                                                                    {dinero(
                                                                        detalle.descuento
                                                                    )}
                                                                </td>

                                                                <td
                                                                    className="
                                                                        px-4
                                                                        py-4
                                                                        text-right
                                                                        text-[var(--color-text-secondary)]
                                                                    "
                                                                >
                                                                    {dinero(
                                                                        detalle.impuesto
                                                                    )}
                                                                </td>

                                                                <td
                                                                    className="
                                                                        px-4
                                                                        py-4
                                                                        text-right
                                                                        text-[var(--color-text-secondary)]
                                                                    "
                                                                >
                                                                    {dinero(
                                                                        detalle.subtotal
                                                                    )}
                                                                </td>

                                                                <td
                                                                    className="
                                                                        px-4
                                                                        py-4
                                                                        text-right
                                                                        font-bold
                                                                        text-[var(--color-text)]
                                                                    "
                                                                >
                                                                    {dinero(
                                                                        detalle.total
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        )
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* TOTALES */}

                                    {compraSeleccionada && (
                                        <div className="flex justify-end">
                                            <div
                                                className="
                                                    w-full
                                                    max-w-sm
                                                    rounded-2xl
                                                    border
                                                    border-[var(--color-border)]
                                                    bg-[var(--color-background)]
                                                    p-4
                                                    sm:p-5
                                                "
                                            >
                                                <div className="mb-4 flex items-center gap-2">
                                                    <div
                                                        className="
                                                            flex
                                                            h-8
                                                            w-8
                                                            items-center
                                                            justify-center
                                                            rounded-lg
                                                            bg-[var(--color-surface)]
                                                            text-[var(--color-primary)]
                                                        "
                                                    >
                                                        <IconoDinero className="h-4 w-4" />
                                                    </div>

                                                    <p
                                                        className="
                                                            text-sm
                                                            font-bold
                                                            text-[var(--color-text)]
                                                        "
                                                    >
                                                        Resumen
                                                    </p>
                                                </div>

                                                <div className="space-y-3 text-sm">
                                                    <div className="flex justify-between gap-4">
                                                        <span
                                                            className="
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            Subtotal
                                                        </span>

                                                        <span
                                                            className="
                                                                font-semibold
                                                                text-[var(--color-text)]
                                                            "
                                                        >
                                                            {dinero(
                                                                compraSeleccionada.subtotal
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between gap-4">
                                                        <span
                                                            className="
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            Descuento
                                                        </span>

                                                        <span
                                                            className="
                                                                font-semibold
                                                                text-[var(--color-text)]
                                                            "
                                                        >
                                                            {dinero(
                                                                compraSeleccionada.descuento
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between gap-4">
                                                        <span
                                                            className="
                                                                text-[var(--color-text-secondary)]
                                                            "
                                                        >
                                                            Impuesto
                                                        </span>

                                                        <span
                                                            className="
                                                                font-semibold
                                                                text-[var(--color-text)]
                                                            "
                                                        >
                                                            {dinero(
                                                                compraSeleccionada.impuesto
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div
                                                        className="
                                                            border-t
                                                            border-[var(--color-border)]
                                                            pt-4
                                                        "
                                                    >
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span
                                                                className="
                                                                    font-bold
                                                                    text-[var(--color-text)]
                                                                "
                                                            >
                                                                Total
                                                            </span>

                                                            <span
                                                                className="
                                                                    text-2xl
                                                                    font-bold
                                                                "
                                                                style={{
                                                                    color:
                                                                        compraSeleccionada.estado ===
                                                                            "cancelada"
                                                                            ? "var(--color-text-secondary)"
                                                                            : "var(--color-primary)",
                                                                    textDecoration:
                                                                        compraSeleccionada.estado ===
                                                                            "cancelada"
                                                                            ? "line-through"
                                                                            : undefined,
                                                                }}
                                                            >
                                                                {dinero(
                                                                    compraSeleccionada.total
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* NOTAS */}

                                    {compraSeleccionada?.notas && (
                                        <div
                                            className="
                                                rounded-2xl
                                                border
                                                border-[var(--color-border)]
                                                bg-[var(--color-surface)]
                                                p-4
                                                sm:p-5
                                            "
                                        >
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="
                                                        flex
                                                        h-8
                                                        w-8
                                                        items-center
                                                        justify-center
                                                        rounded-lg
                                                        bg-[var(--color-background)]
                                                        text-[var(--color-primary)]
                                                    "
                                                >
                                                    <IconoDocumento className="h-4 w-4" />
                                                </div>

                                                <p
                                                    className="
                                                        text-sm
                                                        font-bold
                                                        text-[var(--color-text)]
                                                    "
                                                >
                                                    Notas
                                                </p>
                                            </div>

                                            <p
                                                className="
                                                    mt-3
                                                    whitespace-pre-wrap
                                                    text-sm
                                                    leading-6
                                                    text-[var(--color-text-secondary)]
                                                "
                                            >
                                                {
                                                    compraSeleccionada.notas
                                                }
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* FOOTER */}

                        <div
                            className="
                                flex
                                flex-col
                                gap-3
                                border-t
                                border-[var(--color-border)]
                                px-4
                                py-4
                                sm:flex-row
                                sm:items-center
                                sm:justify-between
                                sm:px-5
                            "
                        >
                            <div>
                                {compraSeleccionada &&
                                    compraSeleccionada.estado !==
                                    "cancelada" && (
                                        <Button
                                            type="button"
                                            variant="danger"
                                            size="medium"
                                            disabled={
                                                cancelando
                                            }
                                            onClick={() => {
                                                if (
                                                    compraSeleccionada
                                                ) {
                                                    solicitarCancelarCompra(
                                                        compraSeleccionada
                                                    );
                                                }
                                            }}
                                            className="w-full sm:w-auto"
                                        >
                                            {cancelando ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <span
                                                        className="
                                                            h-4
                                                            w-4
                                                            animate-spin
                                                            rounded-full
                                                            border-2
                                                            border-white/40
                                                            border-t-white
                                                        "
                                                    />

                                                    Cancelando...
                                                </span>
                                            ) : (
                                                "Cancelar compra"
                                            )}
                                        </Button>
                                    )}
                            </div>

                            <Button
                                type="button"
                                variant="primary"
                                size="medium"
                                onClick={
                                    cerrarDetalleCompra
                                }
                                className="w-full sm:w-auto"
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}