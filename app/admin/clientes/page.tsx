"use client";

import {
    Fragment,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    verificarRol,
    type UsuarioActual,
} from "../../../lib/auth/roleGuard";

import { supabase } from "../../../lib/supabase";
import ModalMensaje from "../../components/ModalMensaje";
import Button from "../../components/Button";
import Card from "../../components/Card";

interface Cliente {
    id: string;
    negocio_id: string;
    nombre: string;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    rfc: string | null;
    limite_credito: number;
    saldo_credito: number;
    activo: boolean;
    created_at: string;
}

interface VentaCliente {
    id: string;
    cliente_id: string | null;
    negocio_id: string;
    sucursal_id: string | null;
    total: number;
    estado: string;
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
    codigo_barras: string | null;
    sku: string | null;
}

interface PagoVenta {
    venta_id: string;
    metodo_pago: string | null;
    monto: number;
}

interface DevolucionVenta {
    id: string;
    venta_id: string;
    monto_total: number;
    estado: string;
    metodo_reembolso: string | null;
    created_at: string;
}

interface Sucursal {
    id: string;
    nombre: string;
}

interface AbonoCliente {
    id: string;
    cliente_id: string;
    sesion_caja_id: string;
    usuario_id: string;
    monto: number;
    metodo_pago: string | null;
    referencia: string | null;
    notas: string | null;
    created_at: string;
}

interface HistorialProducto {
    productoId: string;
    nombre: string;
    codigoBarras: string | null;
    sku: string | null;
    cantidadVendida: number;
    cantidadDevuelta: number;
    cantidadNeta: number;
    totalVenta: number;
    totalDevuelto: number;
    totalNeto: number;
}

interface HistorialVenta {
    id: string;
    total: number;
    estado: string;
    created_at: string;
    sucursal: string;
    metodoPago: string;
    devolucion: number;
    totalNeto: number;
    productos: HistorialProducto[];
}

type TipoMensaje =
    | "exito"
    | "error"
    | "confirmacion"
    | "info";

type MetodoAbono =
    | "efectivo"
    | "tarjeta"
    | "transferencia";

export default function ClientesPage() {
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [registrandoAbono, setRegistrandoAbono] = useState(false);

    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [clientes, setClientes] =
        useState<Cliente[]>([]);

    const [ventas, setVentas] =
        useState<VentaCliente[]>([]);

    const [detallesVentas, setDetallesVentas] =
        useState<DetalleVenta[]>([]);

    const [detallesDevoluciones, setDetallesDevoluciones] =
        useState<DetalleDevolucion[]>([]);

    const [productos, setProductos] =
        useState<Producto[]>([]);

    const [pagos, setPagos] =
        useState<PagoVenta[]>([]);

    const [devoluciones, setDevoluciones] =
        useState<DevolucionVenta[]>([]);

    const [sucursales, setSucursales] =
        useState<Sucursal[]>([]);

    const [abonos, setAbonos] =
        useState<AbonoCliente[]>([]);

    const [busqueda, setBusqueda] = useState("");

    // ==========================================
    // CLIENTE SELECCIONADO
    // ==========================================

    const [clienteHistorial, setClienteHistorial] =
        useState<Cliente | null>(null);

    const [mostrarHistorial, setMostrarHistorial] =
        useState(false);

    // ==========================================
    // VENTA SELECCIONADA
    // ==========================================

    const [ventaSeleccionada, setVentaSeleccionada] =
        useState<string | null>(null);

    // ==========================================
    // FORMULARIO CLIENTE
    // ==========================================

    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [email, setEmail] = useState("");
    const [direccion, setDireccion] = useState("");
    const [rfc, setRfc] = useState("");
    const [limiteCredito, setLimiteCredito] = useState("0");

    // ==========================================
    // EDICIÓN
    // ==========================================

    const [clienteEditando, setClienteEditando] =
        useState<Cliente | null>(null);

    // ==========================================
    // ABONO
    // ==========================================

    const [clienteAbono, setClienteAbono] =
        useState<Cliente | null>(null);

    const [mostrarAbono, setMostrarAbono] =
        useState(false);

    const [montoAbono, setMontoAbono] =
        useState("");

    const [metodoAbono, setMetodoAbono] =
        useState<MetodoAbono>("efectivo");

    const [referenciaAbono, setReferenciaAbono] =
        useState("");

    const [notasAbono, setNotasAbono] =
        useState("");

    // ==========================================
    // MODAL MENSAJE
    // ==========================================

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
        mensaje: string,
        tipo: TipoMensaje = "info",
        titulo?: string
    ) {
        setModalMensaje({
            abierto: true,
            tipo,
            titulo:
                titulo ||
                (tipo === "exito"
                    ? "Operación exitosa"
                    : tipo === "error"
                        ? "Ocurrió un error"
                        : tipo === "confirmacion"
                            ? "Atención"
                            : "Información"),
            mensaje,
        });
    }

    function cerrarMensaje() {
        setModalMensaje((actual) => ({
            ...actual,
            abierto: false,
        }));
    }

    // ==========================================
    // CARGAR DATOS
    // ==========================================

    useEffect(() => {
        cargarDatos();
    }, []);

    async function cargarDatos() {
        try {
            setCargando(true);

            const resultado = await verificarRol([
                "admin",
                "encargado",
            ]);

            if (
                !resultado.autorizado ||
                !resultado.usuario
            ) {
                mostrarMensaje(
                    resultado.motivo === "no_autenticado"
                        ? "No hay un usuario autenticado."
                        : "No tienes permisos para acceder a Clientes.",
                    "error",
                    "Acceso denegado"
                );
                return;
            }

            const usuarioActual = resultado.usuario;

            setUsuario(usuarioActual);

            await Promise.all([
                cargarClientes(usuarioActual.negocio_id),
                cargarVentas(usuarioActual.negocio_id),
                cargarDetallesVentas(usuarioActual.negocio_id),
                cargarDetallesDevoluciones(usuarioActual.negocio_id),
                cargarProductos(usuarioActual.negocio_id),
                cargarPagos(),
                cargarDevoluciones(usuarioActual.negocio_id),
                cargarSucursales(usuarioActual.negocio_id),
                cargarAbonos(usuarioActual.negocio_id),
            ]);
        } catch (error: any) {
            mostrarMensaje(
                error?.message ||
                "No se pudieron cargar los datos de clientes.",
                "error"
            );
        } finally {
            setCargando(false);
        }
    }

    // ==========================================
    // CARGAR CLIENTES
    // ==========================================

    async function cargarClientes(
        negocioId: string
    ) {
        const {
            data,
            error,
        } = await supabase
            .from("clientes")
            .select(`
                id,
                negocio_id,
                nombre,
                telefono,
                email,
                direccion,
                rfc,
                limite_credito,
                saldo_credito,
                activo,
                created_at
            `)
            .eq("negocio_id", negocioId)
            .order("nombre");

        if (error) {
            mostrarMensaje(
                "No se pudo cargar el listado de clientes.",
                "error"
            );
            return;
        }

        setClientes(
            (data || []).map((cliente: any) => ({
                ...cliente,
                limite_credito:
                    Number(cliente.limite_credito) || 0,
                saldo_credito:
                    Number(cliente.saldo_credito) || 0,
            }))
        );
    }

    // ==========================================
    // CARGAR VENTAS
    // ==========================================

    async function cargarVentas(
        negocioId: string
    ) {
        const {
            data,
            error,
        } = await supabase
            .from("ventas")
            .select(`
                id,
                cliente_id,
                negocio_id,
                sucursal_id,
                total,
                estado,
                created_at
            `)
            .eq("negocio_id", negocioId)
            .eq("estado", "completada")
            .not("cliente_id", "is", null)
            .order("created_at", {
                ascending: false,
            });

        if (error) {
            mostrarMensaje(
                "No se pudo cargar el historial de ventas.",
                "error"
            );
            return;
        }

        setVentas(
            (data || []).map((venta: any) => ({
                ...venta,
                total: Number(venta.total) || 0,
            }))
        );
    }

    // ==========================================
    // CARGAR DETALLES DE VENTAS
    // ==========================================

    async function cargarDetallesVentas(
        negocioId: string
    ) {
        const {
            data: ventasNegocio,
            error: errorVentas,
        } = await supabase
            .from("ventas")
            .select("id")
            .eq("negocio_id", negocioId)
            .eq("estado", "completada");

        if (errorVentas) {
            mostrarMensaje(
                "No se pudieron identificar las ventas para cargar sus productos.",
                "error"
            );
            return;
        }

        const ventaIds =
            (ventasNegocio || []).map(
                (venta: any) => venta.id
            );

        if (ventaIds.length === 0) {
            setDetallesVentas([]);
            return;
        }

        const {
            data,
            error,
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
                total
            `)
            .in("venta_id", ventaIds);

        if (error) {
            mostrarMensaje(
                "No se pudieron cargar los productos vendidos.",
                "error"
            );
            return;
        }

        setDetallesVentas(
            (data || []).map((detalle: any) => ({
                ...detalle,
                cantidad:
                    Number(detalle.cantidad) || 0,
                precio_unitario:
                    Number(detalle.precio_unitario) || 0,
                descuento:
                    Number(detalle.descuento) || 0,
                impuesto:
                    Number(detalle.impuesto) || 0,
                subtotal:
                    Number(detalle.subtotal) || 0,
                total:
                    Number(detalle.total) || 0,
            }))
        );
    }

    // ==========================================
    // CARGAR DETALLES DE DEVOLUCIONES
    // ==========================================

    async function cargarDetallesDevoluciones(
        negocioId: string
    ) {
        const {
            data: devolucionesNegocio,
            error: errorDevoluciones,
        } = await supabase
            .from("devoluciones")
            .select("id")
            .eq("negocio_id", negocioId)
            .eq("estado", "completada");

        if (errorDevoluciones) {
            mostrarMensaje(
                "No se pudieron identificar las devoluciones.",
                "error"
            );
            return;
        }

        const devolucionIds =
            (devolucionesNegocio || []).map(
                (devolucion: any) =>
                    devolucion.id
            );

        if (devolucionIds.length === 0) {
            setDetallesDevoluciones([]);
            return;
        }

        const {
            data,
            error,
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
                total
            `)
            .in(
                "devolucion_id",
                devolucionIds
            );

        if (error) {
            mostrarMensaje(
                "No se pudieron cargar los productos devueltos.",
                "error"
            );
            return;
        }

        setDetallesDevoluciones(
            (data || []).map((detalle: any) => ({
                ...detalle,
                cantidad:
                    Number(detalle.cantidad) || 0,
                precio_unitario:
                    Number(detalle.precio_unitario) || 0,
                descuento:
                    Number(detalle.descuento) || 0,
                impuesto:
                    Number(detalle.impuesto) || 0,
                subtotal:
                    Number(detalle.subtotal) || 0,
                total:
                    Number(detalle.total) || 0,
            }))
        );
    }

    // ==========================================
    // CARGAR PRODUCTOS
    // ==========================================

    async function cargarProductos(
        negocioId: string
    ) {
        const {
            data,
            error,
        } = await supabase
            .from("productos")
            .select(`
                id,
                nombre,
                codigo_barras,
                sku
            `)
            .eq("negocio_id", negocioId);

        if (error) {
            mostrarMensaje(
                "No se pudieron cargar los productos.",
                "error"
            );
            return;
        }

        setProductos(data || []);
    }

    // ==========================================
    // CARGAR PAGOS
    // ==========================================

    async function cargarPagos() {
        const {
            data,
            error,
        } = await supabase
            .from("pagos")
            .select(`
                venta_id,
                metodo_pago,
                monto
            `);

        if (error) {
            mostrarMensaje(
                "No se pudieron cargar los métodos de pago.",
                "error"
            );
            return;
        }

        setPagos(
            (data || []).map((pago: any) => ({
                venta_id: pago.venta_id,
                metodo_pago: pago.metodo_pago,
                monto:
                    Number(pago.monto) || 0,
            }))
        );
    }

    // ==========================================
    // CARGAR DEVOLUCIONES
    // ==========================================

    async function cargarDevoluciones(
        negocioId: string
    ) {
        const {
            data,
            error,
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
            .eq("negocio_id", negocioId)
            .eq("estado", "completada");

        if (error) {
            mostrarMensaje(
                "No se pudieron cargar las devoluciones.",
                "error"
            );
            return;
        }

        setDevoluciones(
            (data || []).map((devolucion: any) => ({
                ...devolucion,
                monto_total:
                    Number(
                        devolucion.monto_total
                    ) || 0,
            }))
        );
    }

    // ==========================================
    // CARGAR SUCURSALES
    // ==========================================

    async function cargarSucursales(
        negocioId: string
    ) {
        const {
            data,
            error,
        } = await supabase
            .from("sucursales")
            .select(`
                id,
                nombre
            `)
            .eq("negocio_id", negocioId)
            .order("nombre");

        if (error) {
            mostrarMensaje(
                "No se pudieron cargar las sucursales.",
                "error"
            );
            return;
        }

        setSucursales(data || []);
    }

    // ==========================================
    // CARGAR ABONOS
    // ==========================================

    async function cargarAbonos(
        negocioId: string
    ) {
        const {
            data: clientesNegocio,
            error: errorClientes,
        } = await supabase
            .from("clientes")
            .select("id")
            .eq("negocio_id", negocioId);

        if (errorClientes) {
            mostrarMensaje(
                "No se pudieron identificar los clientes para cargar los abonos.",
                "error"
            );
            return;
        }

        const clienteIds =
            (clientesNegocio || []).map(
                (cliente: any) => cliente.id
            );

        if (clienteIds.length === 0) {
            setAbonos([]);
            return;
        }

        const {
            data,
            error,
        } = await supabase
            .from("abonos_clientes")
            .select(`
                id,
                cliente_id,
                sesion_caja_id,
                usuario_id,
                monto,
                metodo_pago,
                referencia,
                notas,
                created_at
            `)
            .in("cliente_id", clienteIds)
            .order("created_at", {
                ascending: false,
            });

        if (error) {
            mostrarMensaje(
                "No se pudo cargar el historial de abonos.",
                "error"
            );
            return;
        }

        setAbonos(
            (data || []).map((abono: any) => ({
                ...abono,
                monto:
                    Number(abono.monto) || 0,
            }))
        );
    }

    // ==========================================
    // CLIENTES FILTRADOS
    // ==========================================

    const clientesFiltrados = useMemo(() => {
        const texto =
            busqueda.trim().toLowerCase();

        if (!texto) {
            return clientes;
        }

        return clientes.filter(
            (cliente) =>
                cliente.nombre
                    .toLowerCase()
                    .includes(texto) ||
                cliente.telefono
                    ?.toLowerCase()
                    .includes(texto) ||
                cliente.email
                    ?.toLowerCase()
                    .includes(texto) ||
                cliente.rfc
                    ?.toLowerCase()
                    .includes(texto)
        );
    }, [clientes, busqueda]);

    // ==========================================
    // OBTENER PRODUCTOS DE UNA VENTA
    // ==========================================

    function obtenerProductosVenta(
        ventaId: string
    ): HistorialProducto[] {
        const detalles =
            detallesVentas.filter(
                (detalle) =>
                    detalle.venta_id === ventaId
            );

        return detalles.map((detalle) => {
            const producto =
                productos.find(
                    (item) =>
                        item.id ===
                        detalle.producto_id
                );

            const devolucionCantidad =
                detallesDevoluciones
                    .filter(
                        (detalleDevolucion) =>
                            detalleDevolucion.detalle_venta_id ===
                            detalle.id
                    )
                    .reduce(
                        (total, detalleDevolucion) =>
                            total +
                            Number(
                                detalleDevolucion.cantidad
                            ),
                        0
                    );

            const devolucionTotal =
                detallesDevoluciones
                    .filter(
                        (detalleDevolucion) =>
                            detalleDevolucion.detalle_venta_id ===
                            detalle.id
                    )
                    .reduce(
                        (total, detalleDevolucion) =>
                            total +
                            Number(
                                detalleDevolucion.total
                            ),
                        0
                    );

            return {
                productoId:
                    detalle.producto_id,

                nombre:
                    producto?.nombre ||
                    "Producto no encontrado",

                codigoBarras:
                    producto?.codigo_barras ||
                    null,

                sku:
                    producto?.sku ||
                    null,

                cantidadVendida:
                    Number(detalle.cantidad) || 0,

                cantidadDevuelta:
                    devolucionCantidad,

                cantidadNeta:
                    Math.max(
                        0,
                        (Number(detalle.cantidad) || 0) -
                        devolucionCantidad
                    ),

                totalVenta:
                    Number(detalle.total) || 0,

                totalDevuelto:
                    devolucionTotal,

                totalNeto:
                    Math.max(
                        0,
                        (Number(detalle.total) || 0) -
                        devolucionTotal
                    ),
            };
        });
    }

    // ==========================================
    // OBTENER VENTAS DE CLIENTE
    // ==========================================

    function obtenerVentasCliente(
        clienteId: string
    ): HistorialVenta[] {
        const ventasCliente = ventas.filter(
            (venta) =>
                venta.cliente_id ===
                clienteId
        );

        return ventasCliente.map((venta) => {
            const devolucion =
                devoluciones
                    .filter(
                        (d) =>
                            d.venta_id ===
                            venta.id
                    )
                    .reduce(
                        (total, d) =>
                            total +
                            Number(
                                d.monto_total || 0
                            ),
                        0
                    );

            const pagosVenta =
                pagos.filter(
                    (pago) =>
                        pago.venta_id ===
                        venta.id
                );

            let metodoPago =
                "Sin información";

            if (
                pagosVenta.length === 1
            ) {
                metodoPago =
                    formatearMetodoPago(
                        pagosVenta[0]
                            .metodo_pago
                    );
            } else if (
                pagosVenta.length > 1
            ) {
                const metodos = [
                    ...new Set(
                        pagosVenta
                            .map(
                                (p) =>
                                    p.metodo_pago
                            )
                            .filter(Boolean)
                    ),
                ];

                if (
                    metodos.length === 1
                ) {
                    metodoPago =
                        formatearMetodoPago(
                            metodos[0]
                        );
                } else if (
                    metodos.length > 1
                ) {
                    metodoPago =
                        "Mixto";
                }
            }

            const sucursal =
                sucursales.find(
                    (item) =>
                        item.id ===
                        venta.sucursal_id
                )?.nombre ||
                "Sin sucursal";

            return {
                id: venta.id,

                total:
                    Number(venta.total) ||
                    0,

                estado:
                    venta.estado,

                created_at:
                    venta.created_at,

                sucursal,

                metodoPago,

                devolucion,

                totalNeto:
                    Math.max(
                        0,
                        (Number(venta.total) ||
                            0) -
                        devolucion
                    ),

                productos:
                    obtenerProductosVenta(
                        venta.id
                    ),
            };
        });
    }

    // ==========================================
    // OBTENER ABONOS DE CLIENTE
    // ==========================================

    function obtenerAbonosCliente(
        clienteId: string
    ) {
        return abonos
            .filter(
                (abono) =>
                    abono.cliente_id === clienteId
            )
            .sort(
                (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
            );
    }

    // ==========================================
    // RESUMEN CLIENTE
    // ==========================================

    function obtenerResumenCliente(
        clienteId: string
    ) {
        const historial =
            obtenerVentasCliente(
                clienteId
            );

        const cliente =
            clientes.find(
                (item) =>
                    item.id === clienteId
            );

        const abonosCliente =
            obtenerAbonosCliente(
                clienteId
            );

        const totalCompras =
            historial.length;

        const totalBruto =
            historial.reduce(
                (total, venta) =>
                    total + venta.total,
                0
            );

        const totalDevuelto =
            historial.reduce(
                (total, venta) =>
                    total + venta.devolucion,
                0
            );

        const totalNeto =
            historial.reduce(
                (total, venta) =>
                    total +
                    venta.totalNeto,
                0
            );

        const totalAbonado =
            abonosCliente.reduce(
                (total, abono) =>
                    total +
                    Number(abono.monto || 0),
                0
            );

        const limiteCredito =
            Number(
                cliente?.limite_credito || 0
            );

        const saldoCredito =
            Number(
                cliente?.saldo_credito || 0
            );

        const creditoDisponible =
            Math.max(
                0,
                limiteCredito -
                saldoCredito
            );

        const ultimaCompra =
            historial.length > 0
                ? historial
                    .slice()
                    .sort(
                        (a, b) =>
                            new Date(
                                b.created_at
                            ).getTime() -
                            new Date(
                                a.created_at
                            ).getTime()
                    )[0]
                : null;

        return {
            totalCompras,
            totalBruto,
            totalDevuelto,
            totalNeto,
            totalAbonado,
            limiteCredito,
            saldoCredito,
            creditoDisponible,
            ultimaCompra,
        };
    }

    // ==========================================
    // ABRIR HISTORIAL
    // ==========================================

    function abrirHistorial(
        cliente: Cliente
    ) {
        setClienteHistorial(
            cliente
        );

        setMostrarHistorial(true);

        setVentaSeleccionada(null);
    }

    function cerrarHistorial() {
        setMostrarHistorial(false);

        setClienteHistorial(null);

        setVentaSeleccionada(null);
    }

    // ==========================================
    // ABRIR ABONO
    // ==========================================

    function abrirAbono(
        cliente: Cliente
    ) {
        if (!cliente.activo) {
            mostrarMensaje(
                "No puedes registrar un abono para un cliente inactivo.",
                "confirmacion"
            );
            return;
        }

        if (
            Number(cliente.saldo_credito || 0) <= 0
        ) {
            mostrarMensaje(
                "Este cliente no tiene saldo pendiente de crédito.",
                "info"
            );
            return;
        }

        setClienteAbono(cliente);
        setMontoAbono("");
        setMetodoAbono("efectivo");
        setReferenciaAbono("");
        setNotasAbono("");
        setMostrarAbono(true);
    }

    function cerrarAbono() {
        if (registrandoAbono) {
            return;
        }

        setMostrarAbono(false);
        setClienteAbono(null);
        setMontoAbono("");
        setMetodoAbono("efectivo");
        setReferenciaAbono("");
        setNotasAbono("");
    }

    // ==========================================
    // REGISTRAR ABONO
    // ==========================================

    async function registrarAbono() {
        if (!usuario) {
            mostrarMensaje(
                "No se encontró el usuario actual.",
                "error"
            );
            return;
        }

        if (!clienteAbono) {
            mostrarMensaje(
                "No se encontró el cliente seleccionado.",
                "error"
            );
            return;
        }

        const monto =
            Number(montoAbono);

        const saldoActual =
            Number(
                clienteAbono.saldo_credito || 0
            );

        if (
            !Number.isFinite(monto) ||
            monto <= 0
        ) {
            mostrarMensaje(
                "El monto del abono debe ser mayor a cero.",
                "confirmacion"
            );
            return;
        }

        if (monto > saldoActual) {
            mostrarMensaje(
                `El abono no puede ser mayor al saldo pendiente de ${dinero(saldoActual)}.`,
                "confirmacion"
            );
            return;
        }

        if (
            metodoAbono !== "efectivo" &&
            !referenciaAbono.trim()
        ) {
            mostrarMensaje(
                "La referencia es obligatoria para pagos con tarjeta o transferencia.",
                "confirmacion"
            );
            return;
        }

        try {
            setRegistrandoAbono(true);

            // ==========================================
            // BUSCAR SESIÓN DE CAJA ABIERTA
            // DEL USUARIO ACTUAL
            // ==========================================

            const {
                data: sesiones,
                error: errorSesion,
            } = await supabase
                .from("sesiones_caja")
                .select("id, estado")
                .eq(
                    "usuario_apertura_id",
                    usuario.id
                )
                .eq(
                    "estado",
                    "abierta"
                )
                .limit(1);

            if (errorSesion) {
                throw errorSesion;
            }

            const sesion =
                sesiones?.[0];

            if (!sesion) {
                mostrarMensaje(
                    "No tienes una sesión de caja abierta. Abre una caja antes de registrar un abono.",
                    "confirmacion",
                    "Caja no disponible"
                );
                return;
            }

            // ==========================================
            // REGISTRO SEGURO MEDIANTE RPC
            // ==========================================

            const {
                data,
                error,
            } = await supabase.rpc(
                "registrar_abono_cliente",
                {
                    p_cliente_id:
                        clienteAbono.id,

                    p_sesion_caja_id:
                        sesion.id,

                    p_monto:
                        monto,

                    p_metodo_pago:
                        metodoAbono,

                    p_referencia:
                        referenciaAbono.trim() ||
                        null,

                    p_notas:
                        notasAbono.trim() ||
                        null,
                }
            );

            if (error) {
                throw error;
            }

            const saldoNuevo =
                typeof data === "number"
                    ? data
                    : Number(
                        data?.saldo_nuevo ??
                        data?.nuevo_saldo ??
                        NaN
                    );

            cerrarAbono();

            if (Number.isFinite(saldoNuevo)) {
                mostrarMensaje(
                    `El abono de ${dinero(monto)} fue registrado correctamente. Nuevo saldo: ${dinero(saldoNuevo)}.`,
                    "exito"
                );
            } else {
                mostrarMensaje(
                    `El abono de ${dinero(monto)} fue registrado correctamente.`,
                    "exito"
                );
            }

            await Promise.all([
                cargarClientes(
                    usuario.negocio_id
                ),
                cargarAbonos(
                    usuario.negocio_id
                ),
            ]);
        } catch (error: any) {
            mostrarMensaje(
                error?.message ||
                "No se pudo registrar el abono.",
                "error"
            );
        } finally {
            setRegistrandoAbono(false);
        }
    }

    // ==========================================
    // LIMPIAR FORMULARIO
    // ==========================================

    function limpiarFormulario() {
        setNombre("");
        setTelefono("");
        setEmail("");
        setDireccion("");
        setRfc("");
        setLimiteCredito("0");
        setClienteEditando(null);
    }

    // ==========================================
    // GUARDAR CLIENTE
    // ==========================================

    async function guardarCliente() {
        if (!usuario) {
            mostrarMensaje(
                "No se encontró el usuario actual.",
                "error"
            );
            return;
        }

        const nombreLimpio =
            nombre.trim();

        if (!nombreLimpio) {
            mostrarMensaje(
                "El nombre del cliente es obligatorio.",
                "confirmacion"
            );
            return;
        }

        const limite =
            Number(limiteCredito);

        if (
            !Number.isFinite(limite) ||
            limite < 0
        ) {
            mostrarMensaje(
                "El límite de crédito no puede ser negativo.",
                "confirmacion"
            );
            return;
        }

        try {
            setGuardando(true);

            const datosCliente = {
                nombre:
                    nombreLimpio,

                telefono:
                    telefono.trim() ||
                    null,

                email:
                    email.trim() ||
                    null,

                direccion:
                    direccion.trim() ||
                    null,

                rfc:
                    rfc.trim()
                        .toUpperCase() ||
                    null,

                limite_credito:
                    limite,
            };

            if (clienteEditando) {
                const {
                    error,
                } = await supabase
                    .from("clientes")
                    .update(
                        datosCliente
                    )
                    .eq(
                        "id",
                        clienteEditando.id
                    )
                    .eq(
                        "negocio_id",
                        usuario.negocio_id
                    );

                if (error) {
                    throw error;
                }

                mostrarMensaje(
                    "Los datos del cliente fueron actualizados correctamente.",
                    "exito"
                );
            } else {
                const {
                    error,
                } = await supabase
                    .from("clientes")
                    .insert({
                        negocio_id:
                            usuario.negocio_id,

                        ...datosCliente,

                        saldo_credito:
                            0,

                        activo:
                            true,
                    });

                if (error) {
                    throw error;
                }

                mostrarMensaje(
                    "El cliente fue registrado correctamente.",
                    "exito"
                );
            }

            limpiarFormulario();

            await cargarClientes(
                usuario.negocio_id
            );
        } catch (error: any) {
            mostrarMensaje(
                error?.message ||
                "No se pudo guardar el cliente.",
                "error"
            );
        } finally {
            setGuardando(false);
        }
    }

    // ==========================================
    // EDITAR CLIENTE
    // ==========================================

    function editarCliente(
        cliente: Cliente
    ) {
        setClienteEditando(
            cliente
        );

        setNombre(
            cliente.nombre
        );

        setTelefono(
            cliente.telefono ||
            ""
        );

        setEmail(
            cliente.email ||
            ""
        );

        setDireccion(
            cliente.direccion ||
            ""
        );

        setRfc(
            cliente.rfc ||
            ""
        );

        setLimiteCredito(
            String(
                cliente.limite_credito
            )
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    // ==========================================
    // CAMBIAR ESTADO
    // ==========================================

    async function cambiarEstado(
        cliente: Cliente
    ) {
        if (!usuario) {
            return;
        }

        const nuevoEstado =
            !cliente.activo;

        try {
            const {
                error,
            } = await supabase
                .from("clientes")
                .update({
                    activo:
                        nuevoEstado,
                })
                .eq(
                    "id",
                    cliente.id
                )
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                );

            if (error) {
                throw error;
            }

            mostrarMensaje(
                nuevoEstado
                    ? "El cliente fue activado correctamente."
                    : "El cliente fue desactivado correctamente.",
                "exito"
            );

            await cargarClientes(
                usuario.negocio_id
            );
        } catch (error: any) {
            mostrarMensaje(
                error?.message ||
                "No se pudo cambiar el estado del cliente.",
                "error"
            );
        }
    }

    // ==========================================
    // FORMATO MÉTODO DE PAGO
    // ==========================================

    function formatearMetodoPago(
        metodo: string | null
    ) {
        if (!metodo) {
            return "Sin información";
        }

        switch (
        metodo.toLowerCase()
        ) {
            case "efectivo":
                return "Efectivo";

            case "tarjeta":
                return "Tarjeta";

            case "transferencia":
                return "Transferencia";

            case "mixto":
                return "Mixto";

            default:
                return metodo;
        }
    }

    // ==========================================
    // FORMATO DINERO
    // ==========================================

    function dinero(
        valor: number
    ) {
        return new Intl.NumberFormat(
            "es-MX",
            {
                style: "currency",
                currency: "MXN",
            }
        ).format(valor);
    }

    // ==========================================
    // FORMATO FECHA
    // ==========================================

    function fecha(
        valor: string
    ) {
        return new Intl.DateTimeFormat(
            "es-MX",
            {
                dateStyle: "medium",
                timeStyle: "short",
            }
        ).format(
            new Date(valor)
        );
    }

    // ==========================================
    // LOADING
    // ==========================================

    if (cargando) {
        return (
            <main className="min-h-screen bg-[var(--color-background)] p-4 text-[var(--color-text)] md:p-6">
                <div className="mx-auto max-w-7xl">
                    <Card className="p-8 text-center">
                        <p className="text-[var(--color-text-secondary)]">
                            Cargando clientes...
                        </p>
                    </Card>
                </div>

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
                        cerrarMensaje
                    }
                />
            </main>
        );
    }

    // ==========================================
    // UI
    // ==========================================

    return (
        <main className="min-h-screen bg-[var(--color-background)] p-4 text-[var(--color-text)] md:p-6">

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
                    cerrarMensaje
                }
            />

            <div className="mx-auto max-w-7xl space-y-6">

                {/* ENCABEZADO */}

                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">
                        Clientes
                    </h1>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Administra los clientes de tu negocio,
                        su información de crédito, abonos e
                        historial de compras.
                    </p>
                </div>

                {/* FORMULARIO */}

                <Card className="p-0 overflow-hidden">

                    <div className="border-b border-[var(--color-border)] px-5 py-4">

                        <h2 className="font-semibold text-[var(--color-text)]">
                            {clienteEditando
                                ? "Editar cliente"
                                : "Nuevo cliente"}
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            {clienteEditando
                                ? "Actualiza la información del cliente."
                                : "Registra un nuevo cliente para tu negocio."}
                        </p>

                    </div>

                    <div className="space-y-5 p-5">

                        <div className="grid gap-4 md:grid-cols-2">

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                                    Nombre *
                                </label>

                                <input
                                    value={nombre}
                                    onChange={(e) =>
                                        setNombre(
                                            e.target.value
                                        )
                                    }
                                    placeholder="Nombre completo"
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                                    Teléfono
                                </label>

                                <input
                                    value={telefono}
                                    onChange={(e) =>
                                        setTelefono(
                                            e.target.value
                                        )
                                    }
                                    placeholder="Número telefónico"
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                                    Correo electrónico
                                </label>

                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) =>
                                        setEmail(
                                            e.target.value
                                        )
                                    }
                                    placeholder="cliente@correo.com"
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                                    RFC
                                </label>

                                <input
                                    value={rfc}
                                    onChange={(e) =>
                                        setRfc(
                                            e.target.value.toUpperCase()
                                        )
                                    }
                                    placeholder="RFC del cliente"
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm uppercase text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                                    Límite de crédito
                                </label>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={
                                        limiteCredito
                                    }
                                    onChange={(e) =>
                                        setLimiteCredito(
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                />

                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    Usa 0 si el cliente no tendrá crédito.
                                </p>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                                    Dirección
                                </label>

                                <input
                                    value={
                                        direccion
                                    }
                                    onChange={(e) =>
                                        setDireccion(
                                            e.target.value
                                        )
                                    }
                                    placeholder="Dirección del cliente"
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                />
                            </div>

                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">

                            {clienteEditando && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={
                                        limpiarFormulario
                                    }
                                >
                                    Cancelar
                                </Button>
                            )}

                            <Button
                                type="button"
                                variant="primary"
                                onClick={
                                    guardarCliente
                                }
                                disabled={
                                    guardando
                                }
                            >
                                {guardando
                                    ? "Guardando..."
                                    : clienteEditando
                                        ? "Guardar cambios"
                                        : "Registrar cliente"}
                            </Button>

                        </div>

                    </div>

                </Card>

                {/* LISTADO */}

                <Card className="p-0 overflow-hidden">

                    <div className="border-b border-[var(--color-border)] px-5 py-4">

                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                            <div>

                                <h2 className="font-semibold text-[var(--color-text)]">
                                    Clientes registrados
                                </h2>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    {clientes.length} cliente
                                    {clientes.length !== 1
                                        ? "s"
                                        : ""}{" "}
                                    registrado
                                    {clientes.length !== 1
                                        ? "s"
                                        : ""}
                                </p>

                            </div>

                            <div className="w-full md:max-w-sm">

                                <input
                                    value={
                                        busqueda
                                    }
                                    onChange={(e) =>
                                        setBusqueda(
                                            e.target.value
                                        )
                                    }
                                    placeholder="Buscar cliente..."
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                />

                            </div>

                        </div>

                    </div>

                    {clientesFiltrados.length === 0 ? (

                        <div className="p-10 text-center">

                            <p className="text-sm text-[var(--color-text-secondary)]">
                                {busqueda
                                    ? "No se encontraron clientes con esa búsqueda."
                                    : "Todavía no hay clientes registrados."}
                            </p>

                        </div>

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="w-full min-w-[1550px] text-sm">

                                <thead className="bg-[var(--color-background)]">

                                    <tr>

                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                            Cliente
                                        </th>

                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                            Contacto
                                        </th>

                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                            RFC
                                        </th>

                                        <th className="px-5 py-3 text-right font-semibold text-[var(--color-text)]">
                                            Límite crédito
                                        </th>

                                        <th className="px-5 py-3 text-right font-semibold text-[var(--color-text)]">
                                            Saldo
                                        </th>

                                        <th className="px-5 py-3 text-right font-semibold text-[var(--color-text)]">
                                            Disponible
                                        </th>

                                        <th className="px-5 py-3 text-center font-semibold text-[var(--color-text)]">
                                            Compras
                                        </th>

                                        <th className="px-5 py-3 text-right font-semibold text-[var(--color-text)]">
                                            Total neto
                                        </th>

                                        <th className="px-5 py-3 text-center font-semibold text-[var(--color-text)]">
                                            Última compra
                                        </th>

                                        <th className="px-5 py-3 text-center font-semibold text-[var(--color-text)]">
                                            Estado
                                        </th>

                                        <th className="px-5 py-3 text-right font-semibold text-[var(--color-text)]">
                                            Acciones
                                        </th>

                                    </tr>

                                </thead>

                                <tbody className="divide-y divide-[var(--color-border)]">

                                    {clientesFiltrados.map(
                                        (cliente) => {

                                            const resumen =
                                                obtenerResumenCliente(
                                                    cliente.id
                                                );

                                            return (
                                                <tr
                                                    key={
                                                        cliente.id
                                                    }
                                                    className="hover:bg-[var(--color-background)]"
                                                >

                                                    <td className="px-5 py-4">

                                                        <div className="font-medium text-[var(--color-text)]">
                                                            {
                                                                cliente.nombre
                                                            }
                                                        </div>

                                                        {cliente.direccion && (
                                                            <div className="mt-1 max-w-xs truncate text-xs text-[var(--color-text-secondary)]">
                                                                {
                                                                    cliente.direccion
                                                                }
                                                            </div>
                                                        )}

                                                    </td>

                                                    <td className="px-5 py-4 text-[var(--color-text)]">

                                                        {cliente.telefono ? (
                                                            <div>
                                                                {
                                                                    cliente.telefono
                                                                }
                                                            </div>
                                                        ) : (
                                                            <span className="text-[var(--color-text-secondary)]">
                                                                Sin teléfono
                                                            </span>
                                                        )}

                                                        {cliente.email && (
                                                            <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                {
                                                                    cliente.email
                                                                }
                                                            </div>
                                                        )}

                                                    </td>

                                                    <td className="px-5 py-4 text-[var(--color-text)]">

                                                        {cliente.rfc || (
                                                            <span className="text-[var(--color-text-secondary)]">
                                                                —
                                                            </span>
                                                        )}

                                                    </td>

                                                    <td className="px-5 py-4 text-right text-[var(--color-text)]">
                                                        {dinero(
                                                            cliente.limite_credito
                                                        )}
                                                    </td>

                                                    <td className="px-5 py-4 text-right">

                                                        <span
                                                            className={
                                                                cliente.saldo_credito >
                                                                    0
                                                                    ? "font-semibold text-[var(--color-danger)]"
                                                                    : "font-medium text-[var(--color-text)]"
                                                            }
                                                        >
                                                            {dinero(
                                                                cliente.saldo_credito
                                                            )}
                                                        </span>

                                                    </td>

                                                    <td className="px-5 py-4 text-right">

                                                        <span
                                                            className={
                                                                resumen.creditoDisponible > 0
                                                                    ? "font-semibold text-[var(--color-success)]"
                                                                    : "font-semibold text-[var(--color-danger)]"
                                                            }
                                                        >
                                                            {dinero(
                                                                resumen.creditoDisponible
                                                            )}
                                                        </span>

                                                    </td>

                                                    <td className="px-5 py-4 text-center">

                                                        <span className="font-semibold text-[var(--color-text)]">
                                                            {
                                                                resumen.totalCompras
                                                            }
                                                        </span>

                                                    </td>

                                                    <td className="px-5 py-4 text-right">

                                                        {resumen.totalCompras >
                                                            0 ? (

                                                            <div>

                                                                <div className="font-semibold text-[var(--color-text)]">
                                                                    {dinero(
                                                                        resumen.totalNeto
                                                                    )}
                                                                </div>

                                                                {resumen.totalDevuelto >
                                                                    0 && (
                                                                        <div className="mt-1 text-xs text-[var(--color-danger)]">
                                                                            Devuelto:{" "}
                                                                            {dinero(
                                                                                resumen.totalDevuelto
                                                                            )}
                                                                        </div>
                                                                    )}

                                                            </div>

                                                        ) : (

                                                            <span className="text-[var(--color-text-secondary)]">
                                                                —
                                                            </span>

                                                        )}

                                                    </td>

                                                    <td className="px-5 py-4 text-center">

                                                        {resumen.ultimaCompra ? (

                                                            <div>

                                                                <div className="text-xs text-[var(--color-text)]">
                                                                    {fecha(
                                                                        resumen
                                                                            .ultimaCompra
                                                                            .created_at
                                                                    )}
                                                                </div>

                                                                <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                                    {
                                                                        resumen
                                                                            .ultimaCompra
                                                                            .sucursal
                                                                    }
                                                                </div>

                                                            </div>

                                                        ) : (

                                                            <span className="text-[var(--color-text-secondary)]">
                                                                Sin compras
                                                            </span>

                                                        )}

                                                    </td>

                                                    <td className="px-5 py-4 text-center">

                                                        <span
                                                            className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                                                            style={{
                                                                backgroundColor:
                                                                    cliente.activo
                                                                        ? "color-mix(in srgb, var(--color-success) 10%, var(--color-surface))"
                                                                        : "color-mix(in srgb, var(--color-text-secondary) 10%, var(--color-surface))",
                                                                color:
                                                                    cliente.activo
                                                                        ? "var(--color-success)"
                                                                        : "var(--color-text-secondary)",
                                                            }}
                                                        >
                                                            {cliente.activo
                                                                ? "Activo"
                                                                : "Inactivo"}
                                                        </span>

                                                    </td>

                                                    <td className="px-5 py-4">

                                                        <div className="flex justify-end gap-2">

                                                            {cliente.activo &&
                                                                cliente.saldo_credito > 0 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="primary"
                                                                        size="small"
                                                                        onClick={() =>
                                                                            abrirAbono(
                                                                                cliente
                                                                            )
                                                                        }
                                                                    >
                                                                        Abonar
                                                                    </Button>
                                                                )}

                                                            <Button
                                                                type="button"
                                                                variant="primary"
                                                                size="small"
                                                                onClick={() =>
                                                                    abrirHistorial(
                                                                        cliente
                                                                    )
                                                                }
                                                            >
                                                                Ver compras
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                size="small"
                                                                onClick={() =>
                                                                    editarCliente(
                                                                        cliente
                                                                    )
                                                                }
                                                            >
                                                                Editar
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                variant={
                                                                    cliente.activo
                                                                        ? "danger"
                                                                        : "secondary"
                                                                }
                                                                size="small"
                                                                onClick={() =>
                                                                    cambiarEstado(
                                                                        cliente
                                                                    )
                                                                }
                                                            >
                                                                {cliente.activo
                                                                    ? "Desactivar"
                                                                    : "Activar"}
                                                            </Button>

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

            {/* ========================================== */}
            {/* MODAL ABONO */}
            {/* ========================================== */}

            {mostrarAbono &&
                clienteAbono && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

                        <Card className="w-full max-w-lg overflow-hidden p-0">

                            <div className="border-b border-[var(--color-border)] px-5 py-4">

                                <div className="flex items-start justify-between">

                                    <div>
                                        <h2 className="text-lg font-bold text-[var(--color-text)]">
                                            Registrar abono
                                        </h2>

                                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                            {clienteAbono.nombre}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={cerrarAbono}
                                        disabled={registrandoAbono}
                                        aria-label="Cerrar"
                                        className="rounded-lg px-3 py-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text)] disabled:opacity-50"
                                    >
                                        ✕
                                    </button>

                                </div>

                            </div>

                            <div className="space-y-5 p-5">

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                                    <div
                                        className="rounded-xl border border-[var(--color-border)] p-4"
                                        style={{
                                            backgroundColor:
                                                "color-mix(in srgb, var(--color-danger) 7%, var(--color-surface))",
                                        }}
                                    >
                                        <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                                            Saldo pendiente
                                        </p>

                                        <p className="mt-1 text-xl font-bold text-[var(--color-danger)]">
                                            {dinero(
                                                clienteAbono.saldo_credito
                                            )}
                                        </p>
                                    </div>

                                    <div
                                        className="rounded-xl border border-[var(--color-border)] p-4"
                                        style={{
                                            backgroundColor:
                                                "color-mix(in srgb, var(--color-success) 7%, var(--color-surface))",
                                        }}
                                    >
                                        <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                                            Crédito disponible
                                        </p>

                                        <p className="mt-1 text-xl font-bold text-[var(--color-success)]">
                                            {dinero(
                                                Math.max(
                                                    0,
                                                    clienteAbono.limite_credito -
                                                    clienteAbono.saldo_credito
                                                )
                                            )}
                                        </p>
                                    </div>

                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                                        Monto del abono *
                                    </label>

                                    <input
                                        type="number"
                                        min="0.01"
                                        max={clienteAbono.saldo_credito}
                                        step="0.01"
                                        value={montoAbono}
                                        onChange={(e) =>
                                            setMontoAbono(e.target.value)
                                        }
                                        placeholder="0.00"
                                        disabled={registrandoAbono}
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-background)]"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                                        Método de pago *
                                    </label>

                                    <select
                                        value={metodoAbono}
                                        onChange={(e) =>
                                            setMetodoAbono(
                                                e.target.value as MetodoAbono
                                            )
                                        }
                                        disabled={registrandoAbono}
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-background)]"
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
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                                        Referencia
                                        {metodoAbono !== "efectivo" &&
                                            " *"}
                                    </label>

                                    <input
                                        value={referenciaAbono}
                                        onChange={(e) =>
                                            setReferenciaAbono(e.target.value)
                                        }
                                        placeholder={
                                            metodoAbono === "tarjeta"
                                                ? "Referencia de la terminal"
                                                : metodoAbono === "transferencia"
                                                    ? "Folio o referencia bancaria"
                                                    : "Opcional"
                                        }
                                        disabled={registrandoAbono}
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-background)]"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                                        Notas
                                    </label>

                                    <textarea
                                        value={notasAbono}
                                        onChange={(e) =>
                                            setNotasAbono(e.target.value)
                                        }
                                        rows={3}
                                        placeholder="Notas opcionales del abono..."
                                        disabled={registrandoAbono}
                                        className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-background)]"
                                    />
                                </div>

                                <div
                                    className="rounded-xl border p-4"
                                    style={{
                                        borderColor:
                                            "color-mix(in srgb, var(--color-primary) 25%, var(--color-border))",
                                        backgroundColor:
                                            "color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))",
                                    }}
                                >
                                    <p className="text-sm font-medium text-[var(--color-primary)]">
                                        Importante
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                                        El abono se registrará mediante la
                                        operación segura de caja y actualizará
                                        automáticamente el saldo del cliente.
                                        Necesitas tener una sesión de caja abierta.
                                    </p>
                                </div>

                            </div>

                            <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-5 py-4 sm:flex-row sm:justify-end">

                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={cerrarAbono}
                                    disabled={registrandoAbono}
                                >
                                    Cancelar
                                </Button>

                                <Button
                                    type="button"
                                    variant="primary"
                                    onClick={registrarAbono}
                                    disabled={registrandoAbono}
                                >
                                    {registrandoAbono
                                        ? "Registrando..."
                                        : "Registrar abono"}
                                </Button>

                            </div>

                        </Card>

                    </div>
                )}

            {/* ========================================== */}
            {/* MODAL HISTORIAL */}
            {/* ========================================== */}

            {mostrarHistorial &&
                clienteHistorial && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

                        <Card className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden p-0">

                            {/* HEADER */}

                            <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">

                                <div>
                                    <h2 className="text-lg font-bold text-[var(--color-text)]">
                                        Historial del cliente
                                    </h2>

                                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                        {
                                            clienteHistorial.nombre
                                        }
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarHistorial
                                    }
                                    aria-label="Cerrar"
                                    className="rounded-lg px-3 py-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text)]"
                                >
                                    ✕
                                </button>

                            </div>

                            {/* RESUMEN */}

                            {(() => {
                                const resumen =
                                    obtenerResumenCliente(
                                        clienteHistorial.id
                                    );

                                return (
                                    <div className="grid gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)] p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                                                Compras
                                            </p>

                                            <p className="mt-1 text-xl font-bold text-[var(--color-text)]">
                                                {
                                                    resumen.totalCompras
                                                }
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                                                Total bruto
                                            </p>

                                            <p className="mt-1 text-xl font-bold text-[var(--color-text)]">
                                                {dinero(
                                                    resumen.totalBruto
                                                )}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                                                Total devuelto
                                            </p>

                                            <p className="mt-1 text-xl font-bold text-[var(--color-danger)]">
                                                {dinero(
                                                    resumen.totalDevuelto
                                                )}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                                                Total neto
                                            </p>

                                            <p className="mt-1 text-xl font-bold text-[var(--color-success)]">
                                                {dinero(
                                                    resumen.totalNeto
                                                )}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                                                Saldo crédito
                                            </p>

                                            <p className="mt-1 text-xl font-bold text-[var(--color-danger)]">
                                                {dinero(
                                                    resumen.saldoCredito
                                                )}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                                                Disponible
                                            </p>

                                            <p className="mt-1 text-xl font-bold text-[var(--color-success)]">
                                                {dinero(
                                                    resumen.creditoDisponible
                                                )}
                                            </p>
                                        </div>

                                    </div>
                                );
                            })()}

                            {/* CONTENIDO */}

                            <div className="flex-1 space-y-6 overflow-y-auto p-5">

                                {/* ABONOS */}

                                <section className="overflow-hidden rounded-2xl border border-[var(--color-border)]">

                                    <div className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

                                        <div>
                                            <h3 className="font-semibold text-[var(--color-text)]">
                                                Historial de abonos
                                            </h3>

                                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                                Pagos realizados por el cliente para cubrir su crédito.
                                            </p>
                                        </div>

                                        {clienteHistorial.saldo_credito > 0 && (
                                            <Button
                                                type="button"
                                                variant="primary"
                                                size="small"
                                                onClick={() =>
                                                    abrirAbono(
                                                        clienteHistorial
                                                    )
                                                }
                                            >
                                                Registrar abono
                                            </Button>
                                        )}

                                    </div>

                                    {obtenerAbonosCliente(
                                        clienteHistorial.id
                                    ).length === 0 ? (

                                        <div className="p-8 text-center">

                                            <p className="text-sm text-[var(--color-text-secondary)]">
                                                Este cliente todavía no tiene abonos registrados.
                                            </p>

                                        </div>

                                    ) : (

                                        <div className="overflow-x-auto">

                                            <table className="w-full min-w-[900px] text-sm">

                                                <thead className="bg-[var(--color-surface)]">

                                                    <tr>

                                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                                            Fecha
                                                        </th>

                                                        <th className="px-5 py-3 text-right font-semibold text-[var(--color-text)]">
                                                            Monto
                                                        </th>

                                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                                            Método
                                                        </th>

                                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                                            Referencia
                                                        </th>

                                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                                            Notas
                                                        </th>

                                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                                            Sesión
                                                        </th>

                                                    </tr>

                                                </thead>

                                                <tbody className="divide-y divide-[var(--color-border)]">

                                                    {obtenerAbonosCliente(
                                                        clienteHistorial.id
                                                    ).map(
                                                        (abono) => (
                                                            <tr
                                                                key={abono.id}
                                                                className="hover:bg-[var(--color-background)]"
                                                            >

                                                                <td className="px-5 py-4 text-[var(--color-text)]">
                                                                    {fecha(
                                                                        abono.created_at
                                                                    )}
                                                                </td>

                                                                <td className="px-5 py-4 text-right font-semibold text-[var(--color-success)]">
                                                                    {dinero(
                                                                        abono.monto
                                                                    )}
                                                                </td>

                                                                <td className="px-5 py-4 text-[var(--color-text)]">
                                                                    {formatearMetodoPago(
                                                                        abono.metodo_pago
                                                                    )}
                                                                </td>

                                                                <td className="px-5 py-4 text-[var(--color-text-secondary)]">
                                                                    {abono.referencia || (
                                                                        <span className="text-[var(--color-text-secondary)]">
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                <td className="max-w-xs px-5 py-4 text-[var(--color-text-secondary)]">
                                                                    {abono.notas || (
                                                                        <span className="text-[var(--color-text-secondary)]">
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                <td className="px-5 py-4 font-mono text-xs text-[var(--color-text-secondary)]">
                                                                    {abono.sesion_caja_id
                                                                        ? `#${abono.sesion_caja_id.slice(0, 8)}`
                                                                        : "—"}
                                                                </td>

                                                            </tr>
                                                        )
                                                    )}

                                                </tbody>

                                            </table>

                                        </div>

                                    )}

                                </section>

                                {/* HISTORIAL DE COMPRAS */}

                                <section className="overflow-hidden rounded-2xl border border-[var(--color-border)]">

                                    <div className="border-b border-[var(--color-border)] bg-[var(--color-background)] px-5 py-4">

                                        <h3 className="font-semibold text-[var(--color-text)]">
                                            Historial de compras
                                        </h3>

                                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                            Ventas, devoluciones, métodos de pago y productos.
                                        </p>

                                    </div>

                                    {obtenerVentasCliente(
                                        clienteHistorial.id
                                    ).length === 0 ? (

                                        <div className="p-10 text-center">

                                            <p className="text-sm text-[var(--color-text-secondary)]">
                                                Este cliente todavía no tiene compras registradas.
                                            </p>

                                        </div>

                                    ) : (

                                        <div className="overflow-x-auto">

                                            <table className="w-full min-w-[1100px] text-sm">

                                                <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">

                                                    <tr>

                                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                                            Fecha
                                                        </th>

                                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                                            Venta
                                                        </th>

                                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                                            Sucursal
                                                        </th>

                                                        <th className="px-5 py-3 text-left font-semibold text-[var(--color-text)]">
                                                            Método de pago
                                                        </th>

                                                        <th className="px-5 py-3 text-right font-semibold text-[var(--color-text)]">
                                                            Venta
                                                        </th>

                                                        <th className="px-5 py-3 text-right font-semibold text-[var(--color-text)]">
                                                            Devolución
                                                        </th>

                                                        <th className="px-5 py-3 text-right font-semibold text-[var(--color-text)]">
                                                            Total neto
                                                        </th>

                                                        <th className="px-5 py-3 text-center font-semibold text-[var(--color-text)]">
                                                            Productos
                                                        </th>

                                                        <th className="px-5 py-3 text-center font-semibold text-[var(--color-text)]">
                                                            Estado
                                                        </th>

                                                    </tr>

                                                </thead>

                                                <tbody className="divide-y divide-[var(--color-border)]">

                                                    {obtenerVentasCliente(
                                                        clienteHistorial.id
                                                    )
                                                        .sort(
                                                            (a, b) =>
                                                                new Date(b.created_at).getTime() -
                                                                new Date(a.created_at).getTime()
                                                        )
                                                        .map((venta) => {

                                                            const expandida =
                                                                ventaSeleccionada === venta.id;

                                                            return (
                                                                <Fragment key={venta.id}>

                                                                    <tr className="hover:bg-[var(--color-background)]">

                                                                        <td className="px-5 py-4 text-[var(--color-text)]">
                                                                            {fecha(
                                                                                venta.created_at
                                                                            )}
                                                                        </td>

                                                                        <td className="px-5 py-4">
                                                                            <span className="font-medium text-[var(--color-text)]">
                                                                                #{venta.id.slice(0, 8)}
                                                                            </span>
                                                                        </td>

                                                                        <td className="px-5 py-4 text-[var(--color-text)]">
                                                                            {venta.sucursal}
                                                                        </td>

                                                                        <td className="px-5 py-4 text-[var(--color-text)]">
                                                                            {venta.metodoPago}
                                                                        </td>

                                                                        <td className="px-5 py-4 text-right font-medium text-[var(--color-text)]">
                                                                            {dinero(
                                                                                venta.total
                                                                            )}
                                                                        </td>

                                                                        <td className="px-5 py-4 text-right">

                                                                            {venta.devolucion > 0 ? (

                                                                                <span className="font-medium text-[var(--color-danger)]">
                                                                                    -{dinero(
                                                                                        venta.devolucion
                                                                                    )}
                                                                                </span>

                                                                            ) : (

                                                                                <span className="text-[var(--color-text-secondary)]">
                                                                                    —
                                                                                </span>

                                                                            )}

                                                                        </td>

                                                                        <td className="px-5 py-4 text-right">

                                                                            <span className="font-semibold text-[var(--color-text)]">
                                                                                {dinero(
                                                                                    venta.totalNeto
                                                                                )}
                                                                            </span>

                                                                        </td>

                                                                        <td className="px-5 py-4 text-center">

                                                                            <Button
                                                                                type="button"
                                                                                variant="secondary"
                                                                                size="small"
                                                                                onClick={() =>
                                                                                    setVentaSeleccionada(
                                                                                        expandida
                                                                                            ? null
                                                                                            : venta.id
                                                                                    )
                                                                                }
                                                                            >
                                                                                {expandida
                                                                                    ? "Ocultar"
                                                                                    : `Ver ${venta.productos.length} producto${venta.productos.length !== 1
                                                                                        ? "s"
                                                                                        : ""
                                                                                    }`}
                                                                            </Button>

                                                                        </td>

                                                                        <td className="px-5 py-4 text-center">

                                                                            <span
                                                                                className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                                                                                style={{
                                                                                    backgroundColor:
                                                                                        "color-mix(in srgb, var(--color-success) 10%, var(--color-surface))",
                                                                                    color:
                                                                                        "var(--color-success)",
                                                                                }}
                                                                            >
                                                                                Completada
                                                                            </span>

                                                                        </td>

                                                                    </tr>

                                                                    {expandida && (
                                                                        <tr>

                                                                            <td
                                                                                colSpan={9}
                                                                                className="bg-[var(--color-background)] px-5 py-5"
                                                                            >

                                                                                {venta.productos.length === 0 ? (

                                                                                    <Card className="p-5 text-center">

                                                                                        <p className="text-sm text-[var(--color-text-secondary)]">
                                                                                            No se encontraron productos para esta venta.
                                                                                        </p>

                                                                                    </Card>

                                                                                ) : (

                                                                                    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">

                                                                                        <table className="w-full min-w-[850px] text-sm">

                                                                                            <thead className="bg-[var(--color-background)]">

                                                                                                <tr>

                                                                                                    <th className="px-4 py-3 text-left font-semibold text-[var(--color-text)]">
                                                                                                        Producto
                                                                                                    </th>

                                                                                                    <th className="px-4 py-3 text-left font-semibold text-[var(--color-text)]">
                                                                                                        SKU / Código
                                                                                                    </th>

                                                                                                    <th className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">
                                                                                                        Vendido
                                                                                                    </th>

                                                                                                    <th className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">
                                                                                                        Devuelto
                                                                                                    </th>

                                                                                                    <th className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">
                                                                                                        Neto
                                                                                                    </th>

                                                                                                    <th className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">
                                                                                                        Venta
                                                                                                    </th>

                                                                                                    <th className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">
                                                                                                        Devolución
                                                                                                    </th>

                                                                                                    <th className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">
                                                                                                        Neto
                                                                                                    </th>

                                                                                                </tr>

                                                                                            </thead>

                                                                                            <tbody className="divide-y divide-[var(--color-border)]">

                                                                                                {venta.productos.map(
                                                                                                    (producto) => (

                                                                                                        <tr
                                                                                                            key={`${venta.id}-${producto.productoId}`}
                                                                                                            className="hover:bg-[var(--color-background)]"
                                                                                                        >

                                                                                                            <td className="px-4 py-3">

                                                                                                                <div className="font-medium text-[var(--color-text)]">
                                                                                                                    {producto.nombre}
                                                                                                                </div>

                                                                                                            </td>

                                                                                                            <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">

                                                                                                                {producto.sku && (
                                                                                                                    <div>
                                                                                                                        SKU:{" "}
                                                                                                                        {producto.sku}
                                                                                                                    </div>
                                                                                                                )}

                                                                                                                {producto.codigoBarras && (
                                                                                                                    <div className="mt-1">
                                                                                                                        Código:{" "}
                                                                                                                        {
                                                                                                                            producto.codigoBarras
                                                                                                                        }
                                                                                                                    </div>
                                                                                                                )}

                                                                                                                {!producto.sku &&
                                                                                                                    !producto.codigoBarras && (
                                                                                                                        <span>
                                                                                                                            —
                                                                                                                        </span>
                                                                                                                    )}

                                                                                                            </td>

                                                                                                            <td className="px-4 py-3 text-right font-medium text-[var(--color-text)]">
                                                                                                                {
                                                                                                                    producto.cantidadVendida
                                                                                                                }
                                                                                                            </td>

                                                                                                            <td className="px-4 py-3 text-right">

                                                                                                                {producto.cantidadDevuelta >
                                                                                                                    0 ? (

                                                                                                                    <span className="font-medium text-[var(--color-danger)]">
                                                                                                                        {
                                                                                                                            producto.cantidadDevuelta
                                                                                                                        }
                                                                                                                    </span>

                                                                                                                ) : (

                                                                                                                    <span className="text-[var(--color-text-secondary)]">
                                                                                                                        —
                                                                                                                    </span>

                                                                                                                )}

                                                                                                            </td>

                                                                                                            <td className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">
                                                                                                                {
                                                                                                                    producto.cantidadNeta
                                                                                                                }
                                                                                                            </td>

                                                                                                            <td className="px-4 py-3 text-right text-[var(--color-text)]">
                                                                                                                {dinero(
                                                                                                                    producto.totalVenta
                                                                                                                )}
                                                                                                            </td>

                                                                                                            <td className="px-4 py-3 text-right">

                                                                                                                {producto.totalDevuelto >
                                                                                                                    0 ? (

                                                                                                                    <span className="font-medium text-[var(--color-danger)]">
                                                                                                                        -{dinero(
                                                                                                                            producto.totalDevuelto
                                                                                                                        )}
                                                                                                                    </span>

                                                                                                                ) : (

                                                                                                                    <span className="text-[var(--color-text-secondary)]">
                                                                                                                        —
                                                                                                                    </span>

                                                                                                                )}

                                                                                                            </td>

                                                                                                            <td className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">
                                                                                                                {dinero(
                                                                                                                    producto.totalNeto
                                                                                                                )}
                                                                                                            </td>

                                                                                                        </tr>

                                                                                                    )
                                                                                                )}

                                                                                            </tbody>

                                                                                        </table>

                                                                                    </div>

                                                                                )}

                                                                            </td>

                                                                        </tr>
                                                                    )}

                                                                </Fragment>
                                                            );
                                                        })}

                                                </tbody>

                                            </table>

                                        </div>

                                    )}

                                </section>

                            </div>

                            {/* FOOTER */}

                            <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 sm:flex-row sm:justify-end">

                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={
                                        cerrarHistorial
                                    }
                                >
                                    Cerrar
                                </Button>

                            </div>

                        </Card>

                    </div>
                )}

        </main>
    );
}