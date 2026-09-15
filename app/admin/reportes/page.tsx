"use client";

import { useEffect, useMemo, useState } from "react";
import * as ExcelJS from "exceljs";

import { supabase } from "../../../lib/supabase";
import ModalMensaje from "../../components/ModalMensaje";

interface UsuarioAdmin {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

interface NegocioReporte {
    id: string;
    nombre: string;
    logo_url: string | null;
}

interface Sucursal {
    id: string;
    nombre: string;
}

interface UsuarioReporte {
    id: string;
    nombre: string;
    rol: string;
}

interface Venta {
    id: string;
    folio: number;
    sucursal_id: string;
    usuario_id: string;
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
    metodo_pago: string;
    estado: string;
    created_at: string;
}

interface Devolucion {
    id: string;
    sucursal_id: string;
    venta_id: string;
    monto_total: number;
    estado: string;
    created_at: string;
}

interface Pago {
    id: string;
    venta_id: string;
    metodo_pago: string;
    monto: number;
    monto_recibido: number | null;
    cambio: number | null;
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
}

interface Producto {
    id: string;
    nombre: string;
}

type TipoMensaje =
    | "error"
    | "info"
    | "exito"
    | "confirmacion";

const formatearMoneda = (valor: number) =>
    new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
    }).format(valor || 0);

const formatearNumero = (valor: number) =>
    new Intl.NumberFormat("es-MX", {
        maximumFractionDigits: 2,
    }).format(valor || 0);

const formatearFecha = (fecha: string) =>
    new Date(fecha).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
    });

const normalizarFechaInput = (
    valor: string | null | undefined
) => {
    const limpio = String(valor || "")
        .replace(/\s+/g, "")
        .replace(/[^\d-]/g, "");

    const match = limpio.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) {
        return "";
    }

    return `${match[1]}-${match[2]}-${match[3]}`;
};

const obtenerFechaLocalInput = () => {
    const ahora = new Date();

    const year = ahora.getFullYear();

    const month = String(
        ahora.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        ahora.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const convertirFechaLocalAISO = (
    fecha: string,
    siguienteDia = false
) => {
    const [year, month, day] =
        fecha.split("-").map(Number);

    const resultado = new Date(
        year,
        month - 1,
        day + (siguienteDia ? 1 : 0),
        0,
        0,
        0,
        0
    );

    return resultado.toISOString();
};

const convertirInputAFechaLocal = (
    fecha: string
) => {
    const [year, month, day] =
        fecha.split("-").map(Number);

    return new Date(
        year,
        month - 1,
        day
    );
};

const normalizarMetodoPago = (
    metodo: string | null | undefined
) => {
    const valor = String(metodo || "")
        .trim()
        .toLowerCase();

    if (valor === "efectivo") return "efectivo";
    if (valor === "tarjeta") return "tarjeta";
    if (valor === "transferencia") return "transferencia";
    if (valor === "mixto") return "mixto";

    if (
        valor === "credito" ||
        valor === "crédito"
    ) {
        return "credito";
    }

    return valor || "otro";
};

const nombreMetodoPago = (metodo: string) => {
    switch (metodo) {
        case "efectivo":
            return "Efectivo";

        case "tarjeta":
            return "Tarjeta";

        case "transferencia":
            return "Transferencia";

        case "mixto":
            return "Mixto";

        case "credito":
            return "Crédito";

        default:
            return (
                metodo.charAt(0).toUpperCase() +
                metodo.slice(1)
            );
    }
};

const obtenerColorMetodo = (metodo: string) => {
    switch (metodo) {
        case "efectivo":
            return "text-emerald-700 bg-emerald-50 border-emerald-100";

        case "tarjeta":
            return "text-blue-700 bg-blue-50 border-blue-100";

        case "transferencia":
            return "text-violet-700 bg-violet-50 border-violet-100";

        case "mixto":
            return "text-amber-700 bg-amber-50 border-amber-100";

        case "credito":
            return "text-orange-700 bg-orange-50 border-orange-100";

        default:
            return "text-gray-700 bg-gray-50 border-gray-100";
    }
};

const obtenerIniciales = (nombre: string) => {
    return nombre
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) =>
            parte.charAt(0).toUpperCase()
        )
        .join("");
};

export default function ReportesPage() {
    const [usuario, setUsuario] =
        useState<UsuarioAdmin | null>(null);

    const [negocio, setNegocio] =
        useState<NegocioReporte | null>(null);

    const [sucursales, setSucursales] =
        useState<Sucursal[]>([]);

    const [usuariosReporte, setUsuariosReporte] =
        useState<UsuarioReporte[]>([]);

    const [ventas, setVentas] =
        useState<Venta[]>([]);

    const [devoluciones, setDevoluciones] =
        useState<Devolucion[]>([]);

    const [pagos, setPagos] =
        useState<Pago[]>([]);

    const [detallesVenta, setDetallesVenta] =
        useState<DetalleVenta[]>([]);

    const [productos, setProductos] =
        useState<Producto[]>([]);

    const [cargando, setCargando] =
        useState(true);

    const [cargandoReporte, setCargandoReporte] =
        useState(false);

    const [fechaInicio, setFechaInicio] =
        useState("");

    const [fechaFin, setFechaFin] =
        useState("");

    const [sucursalFiltro, setSucursalFiltro] =
        useState("");

    const [modal, setModal] = useState<{
        abierto: boolean;
        tipo: TipoMensaje;
        mensaje: string;
    }>({
        abierto: false,
        tipo: "info",
        mensaje: "",
    });

    const abrirModal = (
        tipo: TipoMensaje,
        mensaje: string
    ) => {
        setModal({
            abierto: true,
            tipo,
            mensaje,
        });
    };

    const cerrarModal = () => {
        setModal((prev) => ({
            ...prev,
            abierto: false,
        }));
    };

    const obtenerRangoMesActual = () => {
        const ahora = new Date();

        const year = ahora.getFullYear();
        const month = ahora.getMonth();

        const inicio = new Date(
            year,
            month,
            1
        );

        const fin = ahora;

        const convertirFecha = (
            fecha: Date
        ) => {
            const fechaYear =
                fecha.getFullYear();

            const fechaMonth = String(
                fecha.getMonth() + 1
            ).padStart(2, "0");

            const fechaDay = String(
                fecha.getDate()
            ).padStart(2, "0");

            return `${fechaYear}-${fechaMonth}-${fechaDay}`;
        };

        return {
            inicio: convertirFecha(inicio),
            fin: convertirFecha(fin),
        };
    };

    useEffect(() => {
        const inicializar = async () => {
            try {
                setCargando(true);

                const {
                    data: {
                        user: authUser,
                    },
                    error: authError,
                } = await supabase.auth.getUser();

                if (authError || !authUser) {
                    abrirModal(
                        "error",
                        "No se pudo obtener el usuario autenticado."
                    );
                    return;
                }

                const {
                    data: usuarioData,
                    error: usuarioError,
                } = await supabase
                    .from("usuarios")
                    .select(
                        "id, negocio_id, nombre, rol"
                    )
                    .eq(
                        "auth_user_id",
                        authUser.id
                    )
                    .single();

                if (
                    usuarioError ||
                    !usuarioData
                ) {
                    abrirModal(
                        "error",
                        "No se encontró el usuario administrativo."
                    );
                    return;
                }

                setUsuario(usuarioData);

                const {
                    data: negocioData,
                    error: negocioError,
                } = await supabase
                    .from("negocios")
                    .select(
                        "id, nombre, logo_url"
                    )
                    .eq(
                        "id",
                        usuarioData.negocio_id
                    )
                    .maybeSingle();

                if (negocioError) {
                    console.error(
                        "Error negocio:",
                        negocioError
                    );
                } else if (negocioData) {
                    setNegocio(
                        negocioData as NegocioReporte
                    );
                }

                const {
                    data: sucursalesData,
                    error: sucursalesError,
                } = await supabase
                    .from("sucursales")
                    .select("id, nombre")
                    .eq(
                        "negocio_id",
                        usuarioData.negocio_id
                    )
                    .eq("activo", true)
                    .order("nombre");

                if (sucursalesError) {
                    abrirModal(
                        "error",
                        "No se pudieron cargar las sucursales."
                    );
                    return;
                }

                setSucursales(
                    sucursalesData || []
                );

                const {
                    data: usuariosData,
                    error: usuariosError,
                } = await supabase
                    .from("usuarios")
                    .select(
                        "id, nombre, rol"
                    )
                    .eq(
                        "negocio_id",
                        usuarioData.negocio_id
                    )
                    .eq("activo", true)
                    .order("nombre");

                if (usuariosError) {
                    console.error(
                        "Error usuarios:",
                        usuariosError
                    );
                } else {
                    setUsuariosReporte(
                        (usuariosData ||
                            []) as UsuarioReporte[]
                    );
                }

                const rango =
                    obtenerRangoMesActual();

                setFechaInicio(
                    normalizarFechaInput(
                        rango.inicio
                    )
                );

                setFechaFin(
                    normalizarFechaInput(
                        rango.fin
                    )
                );
            } catch (error) {
                console.error(error);

                abrirModal(
                    "error",
                    "Ocurrió un error al inicializar los reportes."
                );
            } finally {
                setCargando(false);
            }
        };

        inicializar();
    }, []);

    useEffect(() => {
        const inicio = normalizarFechaInput(
            fechaInicio
        );

        const fin = normalizarFechaInput(
            fechaFin
        );

        const hoy =
            obtenerFechaLocalInput();

        if (
            !usuario?.negocio_id ||
            !inicio ||
            !fin
        ) {
            return;
        }

        if (
            inicio > fin ||
            inicio > hoy ||
            fin > hoy
        ) {
            return;
        }

        cargarReporte(inicio, fin);
    }, [
        usuario?.negocio_id,
        fechaInicio,
        fechaFin,
        sucursalFiltro,
    ]);

    const cargarReporte = async (
        fechaInicioParam?: string,
        fechaFinParam?: string
    ) => {
        if (!usuario?.negocio_id) {
            return;
        }

        const inicio = normalizarFechaInput(
            fechaInicioParam || fechaInicio
        );

        const fin = normalizarFechaInput(
            fechaFinParam || fechaFin
        );

        if (!inicio || !fin) {
            return;
        }

        const hoy =
            obtenerFechaLocalInput();

        if (inicio > fin) {
            return;
        }

        if (
            inicio > hoy ||
            fin > hoy
        ) {
            abrirModal(
                "info",
                "No puedes consultar fechas futuras. Selecciona una fecha igual o anterior a hoy."
            );

            return;
        }

        try {
            setCargandoReporte(true);

            const inicioISO =
                convertirFechaLocalAISO(
                    inicio
                );

            const finISO =
                convertirFechaLocalAISO(
                    fin,
                    true
                );

            let ventasQuery = supabase
                .from("ventas")
                .select(
                    `
id,
folio,
sucursal_id,
usuario_id,
subtotal,
descuento,
impuesto,
total,
metodo_pago,
estado,
created_at
`
                )
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .eq(
                    "estado",
                    "completada"
                )
                .gte(
                    "created_at",
                    inicioISO
                )
                .lt(
                    "created_at",
                    finISO
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (sucursalFiltro) {
                ventasQuery =
                    ventasQuery.eq(
                        "sucursal_id",
                        sucursalFiltro
                    );
            }

            const {
                data: ventasData,
                error: ventasError,
            } = await ventasQuery;

            if (ventasError) {
                console.error(
                    "Error ventas:",
                    ventasError
                );

                abrirModal(
                    "error",
                    "No se pudieron cargar las ventas."
                );

                return;
            }

            const ventasCargadas =
                (ventasData || []) as Venta[];

            setVentas(ventasCargadas);

            const ventaIds =
                ventasCargadas.map(
                    (venta) => venta.id
                );

            let devolucionesQuery =
                supabase
                    .from("devoluciones")
                    .select(
                        `
id,
sucursal_id,
venta_id,
monto_total,
estado,
created_at
`
                    )
                    .eq(
                        "negocio_id",
                        usuario.negocio_id
                    )
                    .eq(
                        "estado",
                        "completada"
                    )
                    .gte(
                        "created_at",
                        inicioISO
                    )
                    .lt(
                        "created_at",
                        finISO
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false,
                        }
                    );

            if (sucursalFiltro) {
                devolucionesQuery =
                    devolucionesQuery.eq(
                        "sucursal_id",
                        sucursalFiltro
                    );
            }

            const {
                data: devolucionesData,
                error: devolucionesError,
            } =
                await devolucionesQuery;

            if (devolucionesError) {
                console.error(
                    "Error devoluciones:",
                    devolucionesError
                );

                abrirModal(
                    "error",
                    "No se pudieron cargar las devoluciones."
                );

                return;
            }

            setDevoluciones(
                (devolucionesData ||
                    []) as Devolucion[]
            );

            if (ventaIds.length === 0) {
                setPagos([]);
                setDetallesVenta([]);
                setProductos([]);
                return;
            }

            const {
                data: pagosData,
                error: pagosError,
            } = await supabase
                .from("pagos")
                .select(
                    `
id,
venta_id,
metodo_pago,
monto,
monto_recibido,
cambio,
referencia,
created_at
`
                )
                .in(
                    "venta_id",
                    ventaIds
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (pagosError) {
                console.error(
                    "Error pagos:",
                    pagosError
                );

                abrirModal(
                    "error",
                    "No se pudieron cargar los pagos registrados."
                );

                return;
            }

            setPagos(
                (pagosData || []) as Pago[]
            );

            const {
                data: detallesData,
                error: detallesError,
            } = await supabase
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
total
`
                )
                .in(
                    "venta_id",
                    ventaIds
                );

            if (detallesError) {
                console.error(
                    "Error detalle ventas:",
                    detallesError
                );

                abrirModal(
                    "error",
                    "No se pudo cargar el detalle de productos vendidos."
                );

                return;
            }

            const detallesCargados =
                (detallesData ||
                    []) as DetalleVenta[];

            setDetallesVenta(
                detallesCargados
            );

            const productoIds = [
                ...new Set(
                    detallesCargados.map(
                        (detalle) =>
                            detalle.producto_id
                    )
                ),
            ];

            if (productoIds.length === 0) {
                setProductos([]);
                return;
            }

            const {
                data: productosData,
                error: productosError,
            } = await supabase
                .from("productos")
                .select(
                    "id, nombre"
                )
                .in(
                    "id",
                    productoIds
                );

            if (productosError) {
                console.error(
                    "Error productos:",
                    productosError
                );

                abrirModal(
                    "error",
                    "No se pudieron cargar los nombres de los productos."
                );

                return;
            }

            setProductos(
                (productosData ||
                    []) as Producto[]
            );
        } catch (error) {
            console.error(error);

            abrirModal(
                "error",
                "Ocurrió un error al cargar el reporte."
            );
        } finally {
            setCargandoReporte(false);
        }
    };

    const nombreSucursal = (
        sucursalId: string
    ) => {
        return (
            sucursales.find(
                (sucursal) =>
                    sucursal.id ===
                    sucursalId
            )?.nombre ||
            "Sin sucursal"
        );
    };

    const nombreUsuario = (
        usuarioId: string
    ) => {
        return (
            usuariosReporte.find(
                (item) =>
                    item.id ===
                    usuarioId
            )?.nombre ||
            (usuarioId === usuario?.id
                ? usuario.nombre
                : usuarioId.slice(0, 8))
        );
    };

    const nombreProducto = (
        productoId: string
    ) => {
        return (
            productos.find(
                (producto) =>
                    producto.id ===
                    productoId
            )?.nombre ||
            "Producto no encontrado"
        );
    };

    const resumen = useMemo(() => {
        const ventasTotales =
            ventas.reduce(
                (acumulado, venta) =>
                    acumulado +
                    Number(
                        venta.total || 0
                    ),
                0
            );

        const descuentos =
            ventas.reduce(
                (acumulado, venta) =>
                    acumulado +
                    Number(
                        venta.descuento || 0
                    ),
                0
            );

        const impuestos =
            ventas.reduce(
                (acumulado, venta) =>
                    acumulado +
                    Number(
                        venta.impuesto || 0
                    ),
                0
            );

        const totalDevoluciones =
            devoluciones.reduce(
                (
                    acumulado,
                    devolucion
                ) =>
                    acumulado +
                    Number(
                        devolucion.monto_total || 0
                    ),
                0
            );

        const ventaNeta =
            ventasTotales -
            totalDevoluciones;

        const numeroVentas =
            ventas.length;

        const numeroDevoluciones =
            devoluciones.length;

        const pagosPorMetodo: Record<
            string,
            number
        > = {};

        pagos.forEach((pago) => {
            const metodo =
                normalizarMetodoPago(
                    pago.metodo_pago
                );

            pagosPorMetodo[metodo] =
                (pagosPorMetodo[metodo] || 0) +
                Number(pago.monto || 0);
        });

        const efectivo =
            pagosPorMetodo.efectivo || 0;

        const tarjeta =
            pagosPorMetodo.tarjeta || 0;

        const transferencia =
            pagosPorMetodo.transferencia || 0;

        const mixto =
            pagosPorMetodo.mixto || 0;

        const credito =
            pagosPorMetodo.credito || 0;

        const otros = Object.entries(
            pagosPorMetodo
        )
            .filter(
                ([metodo]) =>
                    ![
                        "efectivo",
                        "tarjeta",
                        "transferencia",
                        "mixto",
                        "credito",
                    ].includes(metodo)
            )
            .reduce(
                (
                    acumulado,
                    [, monto]
                ) =>
                    acumulado + monto,
                0
            );

        const totalPagos =
            pagos.reduce(
                (
                    acumulado,
                    pago
                ) =>
                    acumulado +
                    Number(
                        pago.monto || 0
                    ),
                0
            );

        const diferenciaPagosVentas =
            ventasTotales -
            totalPagos;

        const ticketPromedio =
            numeroVentas > 0
                ? ventasTotales /
                numeroVentas
                : 0;

        const porcentajeDevoluciones =
            ventasTotales > 0
                ? (totalDevoluciones /
                    ventasTotales) *
                100
                : 0;

        return {
            ventasTotales,
            descuentos,
            impuestos,
            totalDevoluciones,
            ventaNeta,
            numeroVentas,
            numeroDevoluciones,
            efectivo,
            tarjeta,
            transferencia,
            mixto,
            credito,
            otros,
            totalPagos,
            diferenciaPagosVentas,
            ticketPromedio,
            porcentajeDevoluciones,
        };
    }, [
        ventas,
        devoluciones,
        pagos,
    ]);

    const totalMetodosPago =
        resumen.efectivo +
        resumen.tarjeta +
        resumen.transferencia +
        resumen.mixto +
        resumen.credito +
        resumen.otros;

    const pagosVisuales = [
        {
            id: "efectivo",
            nombre: "Efectivo",
            monto: resumen.efectivo,
            icono: "💵",
        },
        {
            id: "tarjeta",
            nombre: "Tarjeta",
            monto: resumen.tarjeta,
            icono: "💳",
        },
        {
            id: "transferencia",
            nombre: "Transferencia",
            monto: resumen.transferencia,
            icono: "🏦",
        },
        {
            id: "mixto",
            nombre: "Mixto",
            monto: resumen.mixto,
            icono: "🔀",
        },
        {
            id: "credito",
            nombre: "Crédito",
            monto: resumen.credito,
            icono: "🧾",
        },
    ];

    const rendimientoSucursales =
        useMemo(() => {
            const mapa: Record<
                string,
                {
                    sucursal_id: string;
                    sucursal: string;
                    numeroVentas: number;
                    totalVendido: number;
                    ticketPromedio: number;
                    porcentaje: number;
                }
            > = {};

            ventas.forEach((venta) => {
                if (
                    !mapa[
                    venta.sucursal_id
                    ]
                ) {
                    mapa[
                        venta.sucursal_id
                    ] = {
                        sucursal_id:
                            venta.sucursal_id,
                        sucursal:
                            nombreSucursal(
                                venta.sucursal_id
                            ),
                        numeroVentas: 0,
                        totalVendido: 0,
                        ticketPromedio: 0,
                        porcentaje: 0,
                    };
                }

                mapa[
                    venta.sucursal_id
                ].numeroVentas += 1;

                mapa[
                    venta.sucursal_id
                ].totalVendido += Number(
                    venta.total || 0
                );
            });

            return Object.values(
                mapa
            )
                .map((item) => ({
                    ...item,
                    ticketPromedio:
                        item.numeroVentas > 0
                            ? item.totalVendido /
                            item.numeroVentas
                            : 0,
                    porcentaje:
                        resumen.ventasTotales > 0
                            ? (item.totalVendido /
                                resumen.ventasTotales) *
                            100
                            : 0,
                }))
                .sort(
                    (a, b) =>
                        b.totalVendido -
                        a.totalVendido
                );
        }, [
            ventas,
            sucursales,
            resumen.ventasTotales,
        ]);

    const rendimientoUsuarios =
        useMemo(() => {
            const mapa: Record<
                string,
                {
                    usuario_id: string;
                    usuario: string;
                    rol: string;
                    numeroVentas: number;
                    totalVendido: number;
                    ticketPromedio: number;
                    porcentaje: number;
                }
            > = {};

            ventas.forEach((venta) => {
                if (
                    !mapa[
                    venta.usuario_id
                    ]
                ) {
                    const usuarioInfo =
                        usuariosReporte.find(
                            (item) =>
                                item.id ===
                                venta.usuario_id
                        );

                    mapa[
                        venta.usuario_id
                    ] = {
                        usuario_id:
                            venta.usuario_id,
                        usuario:
                            nombreUsuario(
                                venta.usuario_id
                            ),
                        rol:
                            usuarioInfo?.rol ||
                            "—",
                        numeroVentas: 0,
                        totalVendido: 0,
                        ticketPromedio: 0,
                        porcentaje: 0,
                    };
                }

                mapa[
                    venta.usuario_id
                ].numeroVentas += 1;

                mapa[
                    venta.usuario_id
                ].totalVendido += Number(
                    venta.total || 0
                );
            });

            return Object.values(
                mapa
            )
                .map((item) => ({
                    ...item,
                    ticketPromedio:
                        item.numeroVentas > 0
                            ? item.totalVendido /
                            item.numeroVentas
                            : 0,
                    porcentaje:
                        resumen.ventasTotales > 0
                            ? (item.totalVendido /
                                resumen.ventasTotales) *
                            100
                            : 0,
                }))
                .sort(
                    (a, b) =>
                        b.totalVendido -
                        a.totalVendido
                );
        }, [
            ventas,
            usuariosReporte,
            usuario,
            resumen.ventasTotales,
        ]);

    const productosMasVendidos =
        useMemo(() => {
            const mapa: Record<
                string,
                {
                    producto_id: string;
                    producto: string;
                    unidadesVendidas: number;
                    importeVendido: number;
                }
            > = {};

            detallesVenta.forEach(
                (detalle) => {
                    if (
                        !mapa[
                        detalle.producto_id
                        ]
                    ) {
                        mapa[
                            detalle.producto_id
                        ] = {
                            producto_id:
                                detalle.producto_id,
                            producto:
                                nombreProducto(
                                    detalle.producto_id
                                ),
                            unidadesVendidas: 0,
                            importeVendido: 0,
                        };
                    }

                    mapa[
                        detalle.producto_id
                    ].unidadesVendidas +=
                        Number(
                            detalle.cantidad || 0
                        );

                    mapa[
                        detalle.producto_id
                    ].importeVendido +=
                        Number(
                            detalle.total || 0
                        );
                }
            );

            return Object.values(
                mapa
            )
                .sort(
                    (a, b) =>
                        b.unidadesVendidas -
                        a.unidadesVendidas
                )
                .slice(0, 10);
        }, [
            detallesVenta,
            productos,
        ]);

    const devolucionesPorSucursal =
        useMemo(() => {
            const mapa: Record<
                string,
                {
                    sucursal_id: string;
                    sucursal: string;
                    numeroDevoluciones: number;
                    totalDevoluciones: number;
                    promedioDevolucion: number;
                }
            > = {};

            devoluciones.forEach(
                (devolucion) => {
                    if (
                        !mapa[
                        devolucion.sucursal_id
                        ]
                    ) {
                        mapa[
                            devolucion.sucursal_id
                        ] = {
                            sucursal_id:
                                devolucion.sucursal_id,
                            sucursal:
                                nombreSucursal(
                                    devolucion.sucursal_id
                                ),
                            numeroDevoluciones: 0,
                            totalDevoluciones: 0,
                            promedioDevolucion: 0,
                        };
                    }

                    mapa[
                        devolucion.sucursal_id
                    ].numeroDevoluciones += 1;

                    mapa[
                        devolucion.sucursal_id
                    ].totalDevoluciones +=
                        Number(
                            devolucion.monto_total || 0
                        );
                }
            );

            return Object.values(
                mapa
            )
                .map((item) => ({
                    ...item,
                    promedioDevolucion:
                        item.numeroDevoluciones > 0
                            ? item.totalDevoluciones /
                            item.numeroDevoluciones
                            : 0,
                }))
                .sort(
                    (a, b) =>
                        b.totalDevoluciones -
                        a.totalDevoluciones
                );
        }, [
            devoluciones,
            sucursales,
        ]);

    const obtenerPagosVenta = (
        ventaId: string
    ) => {
        return pagos.filter(
            (pago) =>
                pago.venta_id ===
                ventaId
        );
    };

    // =========================================================
    // EXPORTACIÓN PROFESIONAL A EXCEL
    // =========================================================

    const exportarExcel = async () => {
        try {
            const inicio =
                normalizarFechaInput(
                    fechaInicio
                );

            const fin =
                normalizarFechaInput(
                    fechaFin
                );

            const hoy =
                obtenerFechaLocalInput();

            if (!inicio || !fin) {
                abrirModal(
                    "info",
                    "Selecciona un periodo válido antes de exportar el reporte."
                );
                return;
            }

            if (inicio > fin) {
                abrirModal(
                    "info",
                    "La fecha inicial no puede ser posterior a la fecha final."
                );
                return;
            }

            if (
                inicio > hoy ||
                fin > hoy
            ) {
                abrirModal(
                    "info",
                    "No puedes exportar fechas futuras."
                );
                return;
            }

            if (cargandoReporte) {
                abrirModal(
                    "info",
                    "Espera a que termine de actualizarse el reporte antes de exportarlo."
                );
                return;
            }

            if (
                !ventas.length &&
                !devoluciones.length
            ) {
                abrirModal(
                    "info",
                    "No hay información para exportar con los filtros seleccionados."
                );
                return;
            }

            const workbook =
                new ExcelJS.Workbook();

            workbook.creator =
                "Punto de Venta — Soporte TI";

            workbook.lastModifiedBy =
                negocio?.nombre ||
                "Punto de Venta";

            workbook.created =
                new Date();

            workbook.modified =
                new Date();

            workbook.subject =
                `Reporte de ventas ${inicio} — ${fin}`;

            workbook.title =
                `Reporte ${negocio?.nombre ||
                "negocio"
                }`;

            workbook.company =
                negocio?.nombre || "";

            workbook.category =
                "Reportes de ventas";

            workbook.description =
                "Reporte generado desde el módulo de Reportes.";

            const primary =
                "2563EB";

            const secondary =
                "1E3A8A";

            const text =
                "0F172A";

            const muted =
                "64748B";

            const border =
                "E2E8F0";

            const background =
                "F8FAFC";

            const success =
                "16A34A";

            const danger =
                "DC2626";

            const warning =
                "D97706";

            const moneyFormat =
                "$#,##0.00";

            const percentFormat =
                "0.0%";

            const thinBorder = {
                top: {
                    style: "thin" as const,
                    color: {
                        argb: border,
                    },
                },
                left: {
                    style: "thin" as const,
                    color: {
                        argb: border,
                    },
                },
                bottom: {
                    style: "thin" as const,
                    color: {
                        argb: border,
                    },
                },
                right: {
                    style: "thin" as const,
                    color: {
                        argb: border,
                    },
                },
            };

            const applyHeader = (
                sheet: ExcelJS.Worksheet,
                rowNumber: number
            ) => {
                const row =
                    sheet.getRow(
                        rowNumber
                    );

                row.height = 24;

                row.eachCell(
                    (cell) => {
                        cell.font = {
                            name: "Aptos",
                            size: 10,
                            bold: true,
                            color: {
                                argb: "FFFFFF",
                            },
                        };

                        cell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: {
                                argb: primary,
                            },
                        };

                        cell.alignment = {
                            vertical:
                                "middle",
                            horizontal:
                                "center",
                            wrapText: true,
                        };

                        cell.border =
                            thinBorder;
                    }
                );
            };

            const applyBody = (
                sheet: ExcelJS.Worksheet,
                startRow: number,
                endRow: number
            ) => {
                for (
                    let rowNumber =
                        startRow;
                    rowNumber <=
                    endRow;
                    rowNumber++
                ) {
                    const row =
                        sheet.getRow(
                            rowNumber
                        );

                    row.eachCell(
                        (cell) => {
                            cell.font = {
                                name: "Aptos",
                                size: 10,
                                color: {
                                    argb: text,
                                },
                            };

                            cell.border =
                                thinBorder;

                            cell.alignment = {
                                vertical:
                                    "middle",
                                wrapText: true,
                            };

                            if (
                                rowNumber %
                                2 ===
                                0
                            ) {
                                cell.fill = {
                                    type: "pattern",
                                    pattern:
                                        "solid",
                                    fgColor: {
                                        argb: background,
                                    },
                                };
                            }
                        }
                    );
                }
            };

            const addFooter = (
                sheet: ExcelJS.Worksheet
            ) => {
                sheet.headerFooter.oddFooter =
                    `&L${negocio?.nombre ||
                    "Negocio"
                    }&CReporte generado por Punto de Venta — Soporte TI&R&P`;

                sheet.pageSetup.orientation =
                    "landscape";

                sheet.pageSetup.fitToPage =
                    true;

                sheet.pageSetup.fitToWidth =
                    1;

                sheet.pageSetup.fitToHeight =
                    0;

                sheet.pageSetup.horizontalCentered =
                    false;
            };

            const addTableSheet = (
                name: string,
                columns: {
                    header: string;
                    key: string;
                    width?: number;
                }[],
                rows: Record<
                    string,
                    unknown
                >[],
                options?: {
                    currencyKeys?: string[];
                    percentKeys?: string[];
                    landscape?: boolean;
                }
            ) => {
                const sheet =
                    workbook.addWorksheet(
                        name
                    );

                sheet.properties.defaultRowHeight =
                    20;

                sheet.columns =
                    columns.map(
                        (column) => ({
                            header:
                                column.header,
                            key: column.key,
                            width:
                                column.width ||
                                18,
                        })
                    );

                rows.forEach(
                    (row) =>
                        sheet.addRow(row)
                );

                applyHeader(
                    sheet,
                    1
                );

                if (rows.length) {
                    applyBody(
                        sheet,
                        2,
                        rows.length + 1
                    );
                }

                const currencyKeys =
                    options?.currencyKeys ||
                    [];

                const percentKeys =
                    options?.percentKeys ||
                    [];

                rows.forEach(
                    (_, index) => {
                        const rowNumber =
                            index + 2;

                        currencyKeys.forEach(
                            (key) => {
                                const columnIndex =
                                    columns.findIndex(
                                        (column) =>
                                            column.key ===
                                            key
                                    );

                                if (
                                    columnIndex >=
                                    0
                                ) {
                                    sheet
                                        .getRow(
                                            rowNumber
                                        )
                                        .getCell(
                                            columnIndex +
                                            1
                                        )
                                        .numFmt =
                                        moneyFormat;
                                }
                            }
                        );

                        percentKeys.forEach(
                            (key) => {
                                const columnIndex =
                                    columns.findIndex(
                                        (column) =>
                                            column.key ===
                                            key
                                    );

                                if (
                                    columnIndex >=
                                    0
                                ) {
                                    sheet
                                        .getRow(
                                            rowNumber
                                        )
                                        .getCell(
                                            columnIndex +
                                            1
                                        )
                                        .numFmt =
                                        percentFormat;
                                }
                            }
                        );
                    }
                );

                sheet.autoFilter = {
                    from: {
                        row: 1,
                        column: 1,
                    },
                    to: {
                        row: Math.max(
                            1,
                            rows.length + 1
                        ),
                        column:
                            columns.length,
                    },
                };

                sheet.views = [
                    {
                        state:
                            "frozen",
                        ySplit: 1,
                    },
                ];

                sheet.pageSetup.orientation =
                    options?.landscape ===
                        false
                        ? "portrait"
                        : "landscape";

                addFooter(sheet);

                return sheet;
            };

            // =====================================================
            // RESUMEN
            // =====================================================

            const wsResumen =
                workbook.addWorksheet(
                    "Resumen"
                );

            wsResumen.properties.defaultRowHeight =
                21;

            wsResumen.columns = [
                { width: 3 },   // A - margen izquierdo
                { width: 28 },  // B - etiquetas indicadores
                { width: 20 },  // C - valores indicadores
                { width: 5 },   // D - separación central
                { width: 28 },  // E - etiquetas medios de pago
                { width: 20 },  // F - valores medios de pago
            ];

            wsResumen.mergeCells(
                "B2:F2"
            );

            wsResumen.getCell(
                "B2"
            ).value =
                "REPORTE GENERAL DE VENTAS";

            wsResumen.getCell(
                "B2"
            ).font = {
                name: "Aptos Display",
                size: 20,
                bold: true,
                color: {
                    argb: "FFFFFF",
                },
            };

            wsResumen.getCell(
                "B2"
            ).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: secondary,
                },
            };

            wsResumen.getCell(
                "B2"
            ).alignment = {
                vertical: "middle",
                horizontal: "left",
            };

            wsResumen.getRow(
                2
            ).height = 36;

            wsResumen.mergeCells(
                "B3:F3"
            );

            wsResumen.getCell(
                "B3"
            ).value =
                negocio?.nombre ||
                "Negocio";

            wsResumen.getCell(
                "B3"
            ).font = {
                name: "Aptos",
                size: 13,
                bold: true,
                color: {
                    argb: primary,
                },
            };

            wsResumen.getCell("B5").value = "Periodo";
            wsResumen.getCell("C5").value = fechaFormateada;

            wsResumen.getCell("E5").value = "Sucursal";
            wsResumen.getCell("F5").value = sucursalSeleccionada;

            wsResumen.getCell("B5").alignment = {
                vertical: "middle",
                horizontal: "left",
            };

            wsResumen.getCell("C5").alignment = {
                vertical: "middle",
                horizontal: "left",
                wrapText: true,
            };

            wsResumen.getCell("E5").alignment = {
                vertical: "middle",
                horizontal: "left",
            };

            wsResumen.getCell("F5").alignment = {
                vertical: "middle",
                horizontal: "left",
                wrapText: true,
            };

            wsResumen.getRow(5).height = 30;

            wsResumen.getCell(
                "B6"
            ).value =
                "Generado";

            wsResumen.getCell(
                "C6"
            ).value =
                new Date();

            wsResumen.getCell(
                "C6"
            ).numFmt =
                "dd/mm/yyyy hh:mm";

            [
                "B5",
                "E5",
                "B6",
            ].forEach(
                (address) => {
                    const cell =
                        wsResumen.getCell(
                            address
                        );

                    cell.font = {
                        name: "Aptos",
                        size: 10,
                        bold: true,
                        color: {
                            argb: muted,
                        },
                    };
                }
            );

            [
                "C5",
                "F5",
                "C6",
            ].forEach(
                (address) => {
                    const cell =
                        wsResumen.getCell(
                            address
                        );

                    cell.font = {
                        name: "Aptos",
                        size: 10,
                        bold: true,
                        color: {
                            argb: text,
                        },
                    };
                }
            );

            wsResumen.mergeCells(
                "B8:C8"
            );

            wsResumen.getCell(
                "B8"
            ).value =
                "INDICADORES PRINCIPALES";

            wsResumen.getCell(
                "B8"
            ).font = {
                name: "Aptos",
                size: 11,
                bold: true,
                color: {
                    argb: "FFFFFF",
                },
            };

            wsResumen.getCell(
                "B8"
            ).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: primary,
                },
            };

            const indicadores = [
                [
                    "Ventas brutas",
                    resumen.ventasTotales,
                    moneyFormat,
                ],
                [
                    "Venta neta",
                    resumen.ventaNeta,
                    moneyFormat,
                ],
                [
                    "Descuentos",
                    resumen.descuentos,
                    moneyFormat,
                ],
                [
                    "Impuestos",
                    resumen.impuestos,
                    moneyFormat,
                ],
                [
                    "Devoluciones",
                    resumen.totalDevoluciones,
                    moneyFormat,
                ],
                [
                    "Número de ventas",
                    resumen.numeroVentas,
                    "#,##0",
                ],
                [
                    "Número de devoluciones",
                    resumen.numeroDevoluciones,
                    "#,##0",
                ],
                [
                    "Ticket promedio",
                    resumen.ticketPromedio,
                    moneyFormat,
                ],
                [
                    "Porcentaje devoluciones",
                    resumen.porcentajeDevoluciones /
                    100,
                    percentFormat,
                ],
            ];

            indicadores.forEach(
                (
                    [
                        label,
                        value,
                        format,
                    ],
                    index
                ) => {
                    const row =
                        9 + index;

                    wsResumen.getCell(
                        `B${row}`
                    ).value =
                        label;

                    wsResumen.getCell(
                        `C${row}`
                    ).value =
                        value;

                    wsResumen.getCell(
                        `C${row}`
                    ).numFmt =
                        format as string;

                    wsResumen.getCell(
                        `B${row}`
                    ).font = {
                        name: "Aptos",
                        size: 10,
                        color: {
                            argb: muted,
                        },
                    };

                    wsResumen.getCell(
                        `C${row}`
                    ).font = {
                        name: "Aptos",
                        size: 10,
                        bold: true,
                        color: {
                            argb: text,
                        },
                    };

                    wsResumen.getCell(
                        `B${row}`
                    ).border =
                        thinBorder;

                    wsResumen.getCell(
                        `C${row}`
                    ).border =
                        thinBorder;
                }
            );

            wsResumen.mergeCells(
                "E8:F8"
            );

            wsResumen.getCell(
                "E8"
            ).value =
                "MEDIOS DE PAGO";

            wsResumen.getCell(
                "E8"
            ).font = {
                name: "Aptos",
                size: 11,
                bold: true,
                color: {
                    argb: "FFFFFF",
                },
            };

            wsResumen.getCell(
                "E8"
            ).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: secondary,
                },
            };

            const pagosResumen = [
                [
                    "Efectivo",
                    resumen.efectivo,
                ],
                [
                    "Tarjeta",
                    resumen.tarjeta,
                ],
                [
                    "Transferencia",
                    resumen.transferencia,
                ],
                [
                    "Mixto",
                    resumen.mixto,
                ],
                [
                    "Crédito",
                    resumen.credito,
                ],
                [
                    "Otros",
                    resumen.otros,
                ],
                [
                    "Total pagos",
                    resumen.totalPagos,
                ],
                [
                    "Diferencia ventas vs pagos",
                    resumen.diferenciaPagosVentas,
                ],
            ];

            pagosResumen.forEach(
                (
                    [
                        label,
                        value,
                    ],
                    index
                ) => {
                    const row =
                        9 + index;

                    wsResumen.getCell(
                        `E${row}`
                    ).value =
                        label;

                    wsResumen.getCell(
                        `F${row}`
                    ).value =
                        value;

                    wsResumen.getCell(
                        `F${row}`
                    ).numFmt =
                        moneyFormat;

                    wsResumen.getCell(
                        `E${row}`
                    ).font = {
                        name: "Aptos",
                        size: 10,
                        color: {
                            argb: muted,
                        },
                    };

                    wsResumen.getCell(
                        `F${row}`
                    ).font = {
                        name: "Aptos",
                        size: 10,
                        bold: true,
                        color: {
                            argb: text,
                        },
                    };

                    wsResumen.getCell(
                        `E${row}`
                    ).border =
                        thinBorder;

                    wsResumen.getCell(
                        `F${row}`
                    ).border =
                        thinBorder;

                    if (
                        label ===
                        "Diferencia ventas vs pagos"
                    ) {
                        wsResumen.getCell(
                            `F${row}`
                        ).font = {
                            name: "Aptos",
                            size: 10,
                            bold: true,
                            color: {
                                argb:
                                    Math.abs(
                                        Number(
                                            value
                                        )
                                    ) <
                                        0.01
                                        ? success
                                        : danger,
                            },
                        };
                    }
                }
            );
            wsResumen.mergeCells(
                "B20:F20"
            );

            wsResumen.getCell(
                "B20"
            ).value =
                "DETALLE DEL REPORTE";

            wsResumen.getCell(
                "B20"
            ).font = {
                name: "Aptos",
                size: 11,
                bold: true,
                color: {
                    argb: "FFFFFF",
                },
            };

            wsResumen.getCell(
                "B20"
            ).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: warning,
                },
            };

            const detalleResumen = [
                [
                    "Ventas incluidas",
                    resumen.numeroVentas,
                    "operaciones",
                ],
                [
                    "Devoluciones incluidas",
                    resumen.numeroDevoluciones,
                    "operaciones",
                ],
                [
                    "Unidades vendidas",
                    detallesVenta.reduce(
                        (a, d) =>
                            a +
                            Number(
                                d.cantidad ||
                                0
                            ),
                        0
                    ),
                    "unidades",
                ],
                [
                    "Productos en ranking",
                    productosMasVendidos.length,
                    "productos",
                ],
                [
                    "Sucursales con ventas",
                    rendimientoSucursales.length,
                    "sucursales",
                ],
                [
                    "Usuarios con ventas",
                    rendimientoUsuarios.length,
                    "usuarios",
                ],
            ];

            detalleResumen.forEach(
                (
                    [
                        label,
                        value,
                        unit,
                    ],
                    index
                ) => {
                    const row =
                        21 + index;

                    wsResumen.getCell(
                        `B${row}`
                    ).value =
                        label;

                    wsResumen.getCell(
                        `C${row}`
                    ).value =
                        value;

                    wsResumen.getCell(
                        `D${row}`
                    ).value =
                        unit;

                    wsResumen.getCell(
                        `B${row}`
                    ).font = {
                        name: "Aptos",
                        size: 10,
                        color: {
                            argb: muted,
                        },
                    };

                    wsResumen.getCell(
                        `C${row}`
                    ).font = {
                        name: "Aptos",
                        size: 10,
                        bold: true,
                        color: {
                            argb: text,
                        },
                    };

                    wsResumen.getCell(
                        `D${row}`
                    ).font = {
                        name: "Aptos",
                        size: 9,
                        color: {
                            argb: muted,
                        },
                    };
                }
            );

            // Marca Soporte TI en la parte superior derecha
            wsResumen.mergeCells("F1:H1");

            wsResumen.getCell("F1").value = "Punto de Venta —";
            wsResumen.getCell("F1").font = {
                name: "Aptos",
                size: 9,
                italic: true,
                color: { argb: muted },
            };

            wsResumen.getCell("F1").alignment = {
                horizontal: "right",
                vertical: "middle",
            };

            wsResumen.getRow(1).height = 30;

            // =====================================================
            // LOGO DEL NEGOCIO
            // =====================================================

            if (negocio?.logo_url) {
                try {
                    const response =
                        await fetch(
                            negocio.logo_url
                        );

                    if (response.ok) {
                        const blob =
                            await response.blob();

                        const tipo =
                            blob.type.toLowerCase();

                        if (
                            tipo.includes(
                                "png"
                            ) ||
                            tipo.includes(
                                "jpeg"
                            ) ||
                            tipo.includes(
                                "jpg"
                            )
                        ) {

                            const buffer =
                                await blob.arrayBuffer();

                            const bytes =
                                new Uint8Array(
                                    buffer
                                );

                            let binary = "";

                            const chunkSize =
                                0x8000;

                            for (
                                let i = 0;
                                i < bytes.length;
                                i += chunkSize
                            ) {
                                binary +=
                                    String.fromCharCode(
                                        ...bytes.subarray(
                                            i,
                                            i + chunkSize
                                        )
                                    );
                            }

                            const base64 =
                                btoa(
                                    binary
                                );

                            const extension =
                                tipo.includes(
                                    "png"
                                )
                                    ? "png"
                                    : "jpeg";

                            const imageId =
                                workbook.addImage(
                                    {
                                        base64,
                                        extension,
                                    }
                                );

                            // Altura del encabezado
                            wsResumen.getRow(2).height = 58;
                            wsResumen.getRow(3).height = 24;
                            wsResumen.getRow(4).height = 24;
                            wsResumen.getRow(5).height = 24;

                            // Tamaño máximo permitido para el logo
                            const maxWidth = 120;
                            const maxHeight = 58;
                            // Crear una imagen temporal para conocer
                            // sus dimensiones originales
                            const img =
                                new Image();

                            img.src =
                                `data:${tipo}; base64, ${base64} `;

                            await new Promise<void>(
                                (resolve) => {
                                    img.onload = () =>
                                        resolve();

                                    img.onerror = () =>
                                        resolve();
                                }
                            );

                            const originalWidth =
                                img.naturalWidth || 1;

                            const originalHeight =
                                img.naturalHeight || 1;

                            // Mantener proporción original
                            const scale =
                                Math.min(
                                    maxWidth /
                                    originalWidth,
                                    maxHeight /
                                    originalHeight
                                );

                            const logoWidth =
                                originalWidth * scale;

                            const logoHeight =
                                originalHeight * scale;

                            // Colocar el logo en la esquina derecha
                            // del encabezado, sin deformarlo
                            wsResumen.addImage(
                                imageId,
                                {
                                    tl: {
                                        col: 5.85,
                                        row: 1.15,
                                    },
                                    ext: {
                                        width: logoWidth,
                                        height: logoHeight,
                                    },
                                }
                            );

                        }
                    }
                } catch (
                logoError
                ) {
                    console.warn(
                        "No se pudo insertar el logo en Excel:",
                        logoError
                    );
                }
            }

            wsResumen.views = [
                {
                    state: "frozen",
                    ySplit: 7,
                },
            ];

            wsResumen.pageSetup.orientation =
                "portrait";

            addFooter(
                wsResumen
            );

            // ============================================================
            // LOGO SOPORTE TI
            // ============================================================

            const soporteTIResponse = await fetch("/logo.png");

            if (soporteTIResponse.ok) {
                const soporteTIBuffer = await soporteTIResponse.arrayBuffer();
                const soporteTIBytes = new Uint8Array(soporteTIBuffer);

                let soporteTIBinary = "";
                const chunkSize = 0x8000;

                for (let i = 0; i < soporteTIBytes.length; i += chunkSize) {
                    soporteTIBinary += String.fromCharCode(
                        ...soporteTIBytes.subarray(i, i + chunkSize)
                    );
                }

                const soporteTIBase64 = btoa(soporteTIBinary);

                const soporteTIImageId = workbook.addImage({
                    base64: soporteTIBase64,
                    extension: "png",
                });

                // Detectar dimensiones reales del logo
                const imgSoporteTI = new Image();
                imgSoporteTI.src = `data:image/png;base64,${soporteTIBase64}`;

                await new Promise<void>((resolve) => {
                    imgSoporteTI.onload = () => resolve();
                    imgSoporteTI.onerror = () => resolve();
                });

                const originalWidth = imgSoporteTI.naturalWidth || 1;
                const originalHeight = imgSoporteTI.naturalHeight || 1;

                // Logo de Soporte TI centrado y más grande
                const maxWidth = 130;
                const maxHeight = 52;

                const scale = Math.min(
                    maxWidth / originalWidth,
                    maxHeight / originalHeight
                );

                const logoWidth = originalWidth * scale;
                const logoHeight = originalHeight * scale;

                // Centrado aproximado dentro de B29:F29
                const centerCol = 4.5;
                const leftCol = centerCol - (logoWidth / 64);

                wsResumen.addImage(soporteTIImageId, {
                    tl: {
                        col: 8.08,
                        row: 0.013
                    },
                    ext: {
                        width: logoWidth,
                        height: logoHeight,
                    },
                });
                wsResumen.getRow(29).height = 36;
            }

            // =====================================================
            // PAGOS
            // =====================================================

            const pagosExcel =
                pagos.map((pago) => {
                    const venta =
                        ventas.find(
                            (item) =>
                                item.id ===
                                pago.venta_id
                        );

                    return {
                        venta: venta
                            ? `#${venta.folio}`
                            : pago.venta_id.slice(
                                0,
                                8
                            ),

                        fecha:
                            formatearFecha(
                                pago.created_at
                            ),

                        sucursal: venta
                            ? nombreSucursal(
                                venta.sucursal_id
                            )
                            : "Sin sucursal",

                        usuario: venta
                            ? nombreUsuario(
                                venta.usuario_id
                            )
                            : "Sin usuario",

                        metodo:
                            nombreMetodoPago(
                                normalizarMetodoPago(
                                    pago.metodo_pago
                                )
                            ),

                        monto: Number(
                            pago.monto || 0
                        ),

                        montoRecibido:
                            pago.monto_recibido ===
                                null
                                ? null
                                : Number(
                                    pago.monto_recibido
                                ),

                        cambio:
                            pago.cambio ===
                                null
                                ? null
                                : Number(
                                    pago.cambio
                                ),

                        referencia:
                            pago.referencia ||
                            "",
                    };
                });

            addTableSheet(
                "Pagos",
                [
                    {
                        header: "Venta",
                        key: "venta",
                        width: 12,
                    },
                    {
                        header: "Fecha",
                        key: "fecha",
                        width: 21,
                    },
                    {
                        header: "Sucursal",
                        key: "sucursal",
                        width: 25,
                    },
                    {
                        header: "Usuario",
                        key: "usuario",
                        width: 25,
                    },
                    {
                        header:
                            "Método de pago",
                        key: "metodo",
                        width: 20,
                    },
                    {
                        header: "Monto",
                        key: "monto",
                        width: 16,
                    },
                    {
                        header:
                            "Monto recibido",
                        key: "montoRecibido",
                        width: 18,
                    },
                    {
                        header: "Cambio",
                        key: "cambio",
                        width: 16,
                    },
                    {
                        header:
                            "Referencia",
                        key: "referencia",
                        width: 30,
                    },
                ],
                pagosExcel,
                {
                    currencyKeys: [
                        "monto",
                        "montoRecibido",
                        "cambio",
                    ],
                }
            );

            // =====================================================
            // VENTAS
            // =====================================================

            const ventasExcel =
                ventas.map((venta) => {
                    const pagosVenta =
                        obtenerPagosVenta(
                            venta.id
                        );

                    return {
                        folio: venta.folio,

                        fecha:
                            formatearFecha(
                                venta.created_at
                            ),

                        sucursal:
                            nombreSucursal(
                                venta.sucursal_id
                            ),

                        usuario:
                            nombreUsuario(
                                venta.usuario_id
                            ),

                        metodo:
                            nombreMetodoPago(
                                normalizarMetodoPago(
                                    venta.metodo_pago
                                )
                            ),

                        subtotal: Number(
                            venta.subtotal || 0
                        ),

                        descuento: Number(
                            venta.descuento || 0
                        ),

                        impuesto: Number(
                            venta.impuesto || 0
                        ),

                        total: Number(
                            venta.total || 0
                        ),

                        estado:
                            venta.estado,

                        detallePagos:
                            pagosVenta
                                .map(
                                    (
                                        pago
                                    ) =>
                                        `${nombreMetodoPago(
                                            normalizarMetodoPago(
                                                pago.metodo_pago
                                            )
                                        )}: ${formatearMoneda(
                                            Number(
                                                pago.monto ||
                                                0
                                            )
                                        )}`
                                )
                                .join(
                                    " | "
                                ),
                    };
                });

            addTableSheet(
                "Ventas",
                [
                    {
                        header: "Folio",
                        key: "folio",
                        width: 10,
                    },
                    {
                        header: "Fecha",
                        key: "fecha",
                        width: 21,
                    },
                    {
                        header: "Sucursal",
                        key: "sucursal",
                        width: 25,
                    },
                    {
                        header: "Usuario",
                        key: "usuario",
                        width: 25,
                    },
                    {
                        header:
                            "Método de pago",
                        key: "metodo",
                        width: 20,
                    },
                    {
                        header:
                            "Subtotal",
                        key: "subtotal",
                        width: 16,
                    },
                    {
                        header:
                            "Descuento",
                        key: "descuento",
                        width: 16,
                    },
                    {
                        header:
                            "Impuesto",
                        key: "impuesto",
                        width: 16,
                    },
                    {
                        header: "Total",
                        key: "total",
                        width: 16,
                    },
                    {
                        header: "Estado",
                        key: "estado",
                        width: 16,
                    },
                    {
                        header:
                            "Detalle de pagos",
                        key: "detallePagos",
                        width: 55,
                    },
                ],
                ventasExcel,
                {
                    currencyKeys: [
                        "subtotal",
                        "descuento",
                        "impuesto",
                        "total",
                    ],
                }
            );

            // =====================================================
            // DETALLE DE VENTAS
            // =====================================================

            const detallesExcel =
                detallesVenta.map(
                    (detalle) => {
                        const venta =
                            ventas.find(
                                (item) =>
                                    item.id ===
                                    detalle.venta_id
                            );

                        return {
                            venta: venta
                                ? `#${venta.folio}`
                                : detalle.venta_id.slice(
                                    0,
                                    8
                                ),

                            fecha: venta
                                ? formatearFecha(
                                    venta.created_at
                                )
                                : "",

                            sucursal:
                                venta
                                    ? nombreSucursal(
                                        venta.sucursal_id
                                    )
                                    : "",

                            usuario:
                                venta
                                    ? nombreUsuario(
                                        venta.usuario_id
                                    )
                                    : "",

                            producto:
                                nombreProducto(
                                    detalle.producto_id
                                ),

                            cantidad:
                                Number(
                                    detalle.cantidad ||
                                    0
                                ),

                            precioUnitario:
                                Number(
                                    detalle.precio_unitario ||
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
                        };
                    }
                );

            addTableSheet(
                "Detalle_Ventas",
                [
                    {
                        header: "Venta",
                        key: "venta",
                        width: 12,
                    },
                    {
                        header: "Fecha",
                        key: "fecha",
                        width: 21,
                    },
                    {
                        header: "Sucursal",
                        key: "sucursal",
                        width: 25,
                    },
                    {
                        header: "Usuario",
                        key: "usuario",
                        width: 25,
                    },
                    {
                        header: "Producto",
                        key: "producto",
                        width: 45,
                    },
                    {
                        header: "Cantidad",
                        key: "cantidad",
                        width: 15,
                    },
                    {
                        header:
                            "Precio unitario",
                        key: "precioUnitario",
                        width: 20,
                    },
                    {
                        header:
                            "Descuento",
                        key: "descuento",
                        width: 16,
                    },
                    {
                        header:
                            "Impuesto",
                        key: "impuesto",
                        width: 16,
                    },
                    {
                        header:
                            "Subtotal",
                        key: "subtotal",
                        width: 16,
                    },
                    {
                        header: "Total",
                        key: "total",
                        width: 16,
                    },
                ],
                detallesExcel,
                {
                    currencyKeys: [
                        "precioUnitario",
                        "descuento",
                        "impuesto",
                        "subtotal",
                        "total",
                    ],
                }
            );

            // =====================================================
            // DEVOLUCIONES
            // =====================================================

            const devolucionesExcel =
                devoluciones.map(
                    (
                        devolucion
                    ) => {
                        const ventaRelacionada =
                            ventas.find(
                                (venta) =>
                                    venta.id ===
                                    devolucion.venta_id
                            );

                        return {
                            venta:
                                ventaRelacionada
                                    ? `#${ventaRelacionada.folio}`
                                    : devolucion.venta_id.slice(
                                        0,
                                        8
                                    ),

                            fecha:
                                formatearFecha(
                                    devolucion.created_at
                                ),

                            sucursal:
                                nombreSucursal(
                                    devolucion.sucursal_id
                                ),

                            monto:
                                Number(
                                    devolucion.monto_total ||
                                    0
                                ),

                            estado:
                                devolucion.estado,
                        };
                    }
                );

            addTableSheet(
                "Devoluciones",
                [
                    {
                        header: "Venta",
                        key: "venta",
                        width: 15,
                    },
                    {
                        header: "Fecha",
                        key: "fecha",
                        width: 21,
                    },
                    {
                        header: "Sucursal",
                        key: "sucursal",
                        width: 28,
                    },
                    {
                        header: "Monto",
                        key: "monto",
                        width: 18,
                    },
                    {
                        header: "Estado",
                        key: "estado",
                        width: 18,
                    },
                ],
                devolucionesExcel,
                {
                    currencyKeys: [
                        "monto",
                    ],
                    landscape: false,
                }
            );
            // =====================================================
            // PRODUCTOS
            // =====================================================

            const productosExcel =
                productosMasVendidos.map(
                    (
                        producto,
                        index
                    ) => ({
                        posicion:
                            index + 1,

                        producto:
                            producto.producto,

                        unidades:
                            Number(
                                producto.unidadesVendidas ||
                                0
                            ),

                        importe:
                            Number(
                                producto.importeVendido ||
                                0
                            ),
                    })
                );

            addTableSheet(
                "Productos",
                [
                    {
                        header:
                            "Posición",
                        key: "posicion",
                        width: 12,
                    },
                    {
                        header:
                            "Producto",
                        key: "producto",
                        width: 48,
                    },
                    {
                        header:
                            "Unidades vendidas",
                        key: "unidades",
                        width: 20,
                    },
                    {
                        header:
                            "Importe vendido",
                        key: "importe",
                        width: 20,
                    },
                ],
                productosExcel,
                {
                    currencyKeys: [
                        "importe",
                    ],
                    landscape: false,
                }
            );

            // =====================================================
            // SUCURSALES
            // =====================================================

            const sucursalesExcel =
                rendimientoSucursales.map(
                    (item) => ({
                        sucursal:
                            item.sucursal,

                        numeroVentas:
                            item.numeroVentas,

                        totalVendido:
                            Number(
                                item.totalVendido ||
                                0
                            ),

                        ticketPromedio:
                            Number(
                                item.ticketPromedio ||
                                0
                            ),

                        participacion:
                            Number(
                                item.porcentaje ||
                                0
                            ) / 100,
                    })
                );

            addTableSheet(
                "Sucursales",
                [
                    {
                        header:
                            "Sucursal",
                        key: "sucursal",
                        width: 30,
                    },
                    {
                        header:
                            "Número de ventas",
                        key: "numeroVentas",
                        width: 20,
                    },
                    {
                        header:
                            "Total vendido",
                        key: "totalVendido",
                        width: 20,
                    },
                    {
                        header:
                            "Ticket promedio",
                        key: "ticketPromedio",
                        width: 20,
                    },
                    {
                        header:
                            "Participación",
                        key: "participacion",
                        width: 18,
                    },
                ],
                sucursalesExcel,
                {
                    currencyKeys: [
                        "totalVendido",
                        "ticketPromedio",
                    ],
                    percentKeys: [
                        "participacion",
                    ],
                }
            );

            // =====================================================
            // USUARIOS
            // =====================================================

            const usuariosExcel =
                rendimientoUsuarios.map(
                    (item) => ({
                        usuario:
                            item.usuario,

                        rol:
                            item.rol,

                        numeroVentas:
                            item.numeroVentas,

                        totalVendido:
                            Number(
                                item.totalVendido ||
                                0
                            ),

                        ticketPromedio:
                            Number(
                                item.ticketPromedio ||
                                0
                            ),

                        participacion:
                            Number(
                                item.porcentaje ||
                                0
                            ) / 100,
                    })
                );

            addTableSheet(
                "Usuarios",
                [
                    {
                        header:
                            "Usuario",
                        key: "usuario",
                        width: 30,
                    },
                    {
                        header: "Rol",
                        key: "rol",
                        width: 18,
                    },
                    {
                        header:
                            "Número de ventas",
                        key: "numeroVentas",
                        width: 20,
                    },
                    {
                        header:
                            "Total vendido",
                        key: "totalVendido",
                        width: 20,
                    },
                    {
                        header:
                            "Ticket promedio",
                        key: "ticketPromedio",
                        width: 20,
                    },
                    {
                        header:
                            "Participación",
                        key: "participacion",
                        width: 18,
                    },
                ],
                usuariosExcel,
                {
                    currencyKeys: [
                        "totalVendido",
                        "ticketPromedio",
                    ],
                    percentKeys: [
                        "participacion",
                    ],
                }
            );

            // =====================================================
            // NOMBRE DEL ARCHIVO
            // =====================================================

            const nombreSucursalArchivo =
                sucursalFiltro
                    ? nombreSucursal(
                        sucursalFiltro
                    )
                        .replace(
                            /[\\/:*?"<>|]/g,
                            ""
                        )
                        .replace(
                            /\s+/g,
                            "_"
                        )
                    : "Todas";

            const nombreArchivo =
                `Reporte_${inicio}_${fin}_${nombreSucursalArchivo}.xlsx`;

            // =====================================================
            // DESCARGA DEL ARCHIVO
            // =====================================================

            const buffer =
                await workbook.xlsx.writeBuffer();

            const blob = new Blob(
                [buffer],
                {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                }
            );

            const url =
                URL.createObjectURL(
                    blob
                );

            const enlace =
                document.createElement(
                    "a"
                );

            enlace.href = url;
            enlace.download =
                nombreArchivo;

            document.body.appendChild(
                enlace
            );

            enlace.click();

            enlace.remove();

            setTimeout(
                () =>
                    URL.revokeObjectURL(
                        url
                    ),
                1000
            );

            abrirModal(
                "exito",
                `El reporte se exportó correctamente a Excel: ${nombreArchivo}`
            );
        } catch (error) {
            console.error(
                "Error exportando Excel:",
                error
            );

            abrirModal(
                "error",
                "No se pudo generar el archivo de Excel. Revisa la consola para obtener más información."
            );
        }
    };

    const fechaFormateada = useMemo(() => {
        const inicioSegura =
            normalizarFechaInput(
                fechaInicio
            );

        const finSegura =
            normalizarFechaInput(
                fechaFin
            );

        if (
            !inicioSegura ||
            !finSegura
        ) {
            return "Periodo no seleccionado";
        }

        const inicio =
            convertirInputAFechaLocal(
                inicioSegura
            );

        const fin =
            convertirInputAFechaLocal(
                finSegura
            );

        const opciones: Intl.DateTimeFormatOptions =
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        };

        return `${inicio.toLocaleDateString(
            "es-MX",
            opciones
        )} — ${fin.toLocaleDateString(
            "es-MX",
            opciones
        )}`;
    }, [
        fechaInicio,
        fechaFin,
    ]);

    const sucursalSeleccionada =
        sucursalFiltro
            ? nombreSucursal(
                sucursalFiltro
            )
            : "Todas las sucursales";

    if (cargando) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-6">
                <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-8 text-center">
                    <div className="mx-auto mb-4 w-12 h-12 rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin" />

                    <h2 className="font-semibold text-[var(--color-text)]">
                        Cargando reportes
                    </h2>

                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        Preparando la información del negocio...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* ENCABEZADO */}

                <div className="bg-[var(--color-secondary)] rounded-3xl p-6 md:p-8 text-white shadow-[var(--shadow-md)]">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

                        <div>
                            <div className="flex items-center gap-3 mb-2">

                                <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">
                                    📊
                                </div>

                                <div>
                                    <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">
                                        Administración
                                    </p>

                                    <h1 className="text-2xl md:text-3xl font-bold">
                                        Reportes
                                    </h1>
                                </div>

                            </div>

                            <p className="text-white/70 max-w-2xl">
                                Analiza ventas, pagos,
                                rendimiento de usuarios,
                                productos y devoluciones.
                            </p>
                        </div>

                        <div className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3 min-w-0 lg:min-w-[280px]">
                            <p className="text-white/70 text-xs uppercase tracking-wide">
                                Periodo
                            </p>

                            <p className="font-semibold mt-1">
                                {fechaFormateada}
                            </p>

                            <p className="text-xs text-white/70 mt-1">
                                {sucursalSeleccionada}
                            </p>
                        </div>

                    </div>
                </div>

                {/* FILTROS */}

                <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-5">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">

                        <div>
                            <h2 className="font-bold text-[var(--color-text)]">
                                Filtros del reporte
                            </h2>

                            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                                Selecciona el periodo y la sucursal que deseas analizar.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-sm">

                            <span
                                className={`w-2.5 h-2.5 rounded-full ${cargandoReporte
                                    ? "bg-[var(--color-warning)] animate-pulse"
                                    : "bg-[var(--color-success)]"
                                    }`}
                            />

                            <span className="text-[var(--color-text-secondary)]">
                                {cargandoReporte
                                    ? "Actualizando..."
                                    : "Reporte actualizado"}
                            </span>

                        </div>

                    </div>

                    {/* BOTÓN EXCEL */}

                    <div className="mb-4 flex justify-end">

                        <button
                            type="button"
                            onClick={
                                exportarExcel
                            }
                            disabled={
                                cargandoReporte ||
                                (!ventas.length &&
                                    !devoluciones.length)
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-border)] disabled:cursor-not-allowed text-white font-semibold px-4 py-3 shadow-sm transition"
                        >
                            📊
                            Exportar a Excel
                        </button>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                                Fecha inicial
                            </label>

                            <input
                                type="date"
                                value={normalizarFechaInput(
                                    fechaInicio
                                )}
                                max={obtenerFechaLocalInput()}
                                onChange={(e) =>
                                    setFechaInicio(
                                        normalizarFechaInput(
                                            e.target.value
                                        )
                                    )
                                }
                                className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 bg-[var(--color-background)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                                Fecha final
                            </label>

                            <input
                                type="date"
                                value={normalizarFechaInput(
                                    fechaFin
                                )}
                                max={obtenerFechaLocalInput()}
                                onChange={(e) =>
                                    setFechaFin(
                                        normalizarFechaInput(
                                            e.target.value
                                        )
                                    )
                                }
                                className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 bg-[var(--color-background)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                                Sucursal
                            </label>

                            <select
                                value={
                                    sucursalFiltro
                                }
                                onChange={(e) =>
                                    setSucursalFiltro(
                                        e.target.value
                                    )
                                }
                                className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 bg-[var(--color-background)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] transition"
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

                    </div>
                </div>

                {/* INDICADORES PRINCIPALES */}

                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

                    {[
                        {
                            label: "Ventas brutas",
                            value:
                                resumen.ventasTotales,
                            icon: "💰",
                        },
                        {
                            label: "Venta neta",
                            value:
                                resumen.ventaNeta,
                            icon: "📈",
                        },
                        {
                            label: "Ticket promedio",
                            value:
                                resumen.ticketPromedio,
                            icon: "🧾",
                        },
                        {
                            label: "Devoluciones",
                            value:
                                resumen.totalDevoluciones,
                            icon: "↩️",
                        },
                        {
                            label: "Total pagos",
                            value:
                                resumen.totalPagos,
                            icon: "💳",
                        },
                    ].map(
                        (item) => (
                            <div
                                key={
                                    item.label
                                }
                                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]"
                            >
                                <div className="flex items-start justify-between gap-3">

                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            {
                                                item.label
                                            }
                                        </p>

                                        <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                                            {formatearMoneda(
                                                item.value
                                            )}
                                        </p>
                                    </div>

                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-background)] text-xl">
                                        {
                                            item.icon
                                        }
                                    </span>

                                </div>

                                <div className="mt-4 h-1 rounded-full bg-[var(--color-primary)]" />
                            </div>
                        )
                    )}

                </section>

                {/* PAGOS Y CONCILIACIÓN */}

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">

                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">

                        <div className="border-b border-[var(--color-border)] p-5 md:p-6">

                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                                Distribución
                            </p>

                            <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">
                                Métodos de pago
                            </h2>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Importe registrado por cada método utilizado en las ventas.
                            </p>

                        </div>

                        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">

                            {pagosVisuales.map(
                                (pago) => {
                                    const porcentaje =
                                        totalMetodosPago >
                                            0
                                            ? (pago.monto /
                                                totalMetodosPago) *
                                            100
                                            : 0;

                                    return (
                                        <div
                                            key={
                                                pago.id
                                            }
                                            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4"
                                        >
                                            <div className="flex items-center justify-between gap-3">

                                                <span className="text-lg">
                                                    {
                                                        pago.icono
                                                    }
                                                </span>

                                                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                                                    {porcentaje.toFixed(
                                                        1
                                                    )}
                                                    %
                                                </span>

                                            </div>

                                            <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">
                                                {
                                                    pago.nombre
                                                }
                                            </p>

                                            <p className="mt-1 text-lg font-bold text-[var(--color-text)]">
                                                {formatearMoneda(
                                                    pago.monto
                                                )}
                                            </p>

                                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface)]">

                                                <div
                                                    className="h-full rounded-full bg-[var(--color-primary)]"
                                                    style={{
                                                        width: `${Math.min(
                                                            porcentaje,
                                                            100
                                                        )}%`,
                                                    }}
                                                />

                                            </div>
                                        </div>
                                    );
                                }
                            )}

                        </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] md:p-6">

                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-success)]">
                            Control financiero
                        </p>

                        <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">
                            Conciliación
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Comparación entre ventas registradas y pagos asociados.
                        </p>

                        <div className="mt-5 space-y-3">

                            <div className="flex items-center justify-between rounded-xl bg-[var(--color-background)] p-4">
                                <span className="text-sm text-[var(--color-text-secondary)]">
                                    Ventas brutas
                                </span>

                                <strong className="text-[var(--color-text)]">
                                    {formatearMoneda(
                                        resumen.ventasTotales
                                    )}
                                </strong>
                            </div>

                            <div className="flex items-center justify-between rounded-xl bg-[var(--color-background)] p-4">
                                <span className="text-sm text-[var(--color-text-secondary)]">
                                    Pagos registrados
                                </span>

                                <strong className="text-[var(--color-text)]">
                                    {formatearMoneda(
                                        resumen.totalPagos
                                    )}
                                </strong>
                            </div>

                            <div
                                className={`flex items-center justify-between rounded-xl border p-4 ${Math.abs(
                                    resumen.diferenciaPagosVentas
                                ) < 0.01
                                    ? "border-[var(--color-success)]/20 bg-[var(--color-success)]/10"
                                    : "border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10"
                                    }`}
                            >
                                <span className="text-sm font-semibold text-[var(--color-text)]">
                                    Diferencia
                                </span>

                                <strong
                                    className={
                                        Math.abs(
                                            resumen.diferenciaPagosVentas
                                        ) < 0.01
                                            ? "text-[var(--color-success)]"
                                            : "text-[var(--color-danger)]"
                                    }
                                >
                                    {formatearMoneda(
                                        resumen.diferenciaPagosVentas
                                    )}
                                </strong>
                            </div>

                        </div>
                    </div>

                </section>

                {/* RENDIMIENTO */}

                <section className="space-y-4">

                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                            Desempeño
                        </p>

                        <h2 className="mt-1 text-2xl font-bold text-[var(--color-text)]">
                            Rendimiento
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Compara la participación de sucursales y usuarios durante el periodo.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

                        {[
                            {
                                titulo:
                                    "🏪 Sucursales",
                                subtitulo:
                                    "Ventas por sucursal",
                                items:
                                    rendimientoSucursales,
                                tipo:
                                    "sucursal" as const,
                            },
                            {
                                titulo:
                                    "👤 Usuarios / Cajeros",
                                subtitulo:
                                    "Rendimiento por usuario",
                                items:
                                    rendimientoUsuarios,
                                tipo:
                                    "usuario" as const,
                            },
                        ].map(
                            (grupo) => (
                                <div
                                    key={
                                        grupo.tipo
                                    }
                                    className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
                                >

                                    <div className="border-b border-[var(--color-border)] p-5">

                                        <div className="flex items-center justify-between gap-3">

                                            <div>
                                                <h3 className="font-bold text-[var(--color-text)]">
                                                    {
                                                        grupo.titulo
                                                    }
                                                </h3>

                                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                                    {
                                                        grupo.subtitulo
                                                    }
                                                </p>
                                            </div>

                                            <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]">
                                                {
                                                    grupo
                                                        .items
                                                        .length
                                                }
                                            </span>

                                        </div>

                                    </div>

                                    <div className="space-y-5 p-5">

                                        {grupo.items.map(
                                            (
                                                item: any,
                                                index
                                            ) => (
                                                <div
                                                    key={
                                                        grupo.tipo ===
                                                            "sucursal"
                                                            ? item.sucursal_id
                                                            : item.usuario_id
                                                    }
                                                >

                                                    <div className="mb-2 flex items-center justify-between gap-3">

                                                        <div className="flex min-w-0 items-center gap-3">

                                                            {grupo.tipo ===
                                                                "usuario" ? (
                                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]">
                                                                    {obtenerIniciales(
                                                                        item.usuario
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-background)] text-xs font-bold text-[var(--color-text-secondary)]">
                                                                    {
                                                                        index +
                                                                        1
                                                                    }
                                                                </span>
                                                            )}

                                                            <div className="min-w-0">

                                                                <div className="flex items-center gap-2">

                                                                    <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                                                                        {grupo.tipo ===
                                                                            "sucursal"
                                                                            ? item.sucursal
                                                                            : item.usuario}
                                                                    </p>

                                                                    {grupo.tipo ===
                                                                        "usuario" && (
                                                                            <span className="rounded bg-[var(--color-background)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-text-secondary)]">
                                                                                {
                                                                                    item.rol
                                                                                }
                                                                            </span>
                                                                        )}

                                                                </div>

                                                                <p className="text-xs text-[var(--color-text-secondary)]">
                                                                    {
                                                                        item.numeroVentas
                                                                    }{" "}
                                                                    ventas · Ticket{" "}
                                                                    {formatearMoneda(
                                                                        item.ticketPromedio
                                                                    )}
                                                                </p>

                                                            </div>

                                                        </div>

                                                        <div className="text-right">

                                                            <p className="whitespace-nowrap text-sm font-bold text-[var(--color-text)]">
                                                                {formatearMoneda(
                                                                    item.totalVendido
                                                                )}
                                                            </p>

                                                            <p className="text-[11px] text-[var(--color-text-secondary)]">
                                                                {item.porcentaje.toFixed(
                                                                    1
                                                                )}
                                                                %
                                                            </p>

                                                        </div>

                                                    </div>

                                                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-background)]">

                                                        <div
                                                            className="h-full rounded-full bg-[var(--color-primary)]"
                                                            style={{
                                                                width: `${Math.min(
                                                                    item.porcentaje,
                                                                    100
                                                                )}%`,
                                                            }}
                                                        />

                                                    </div>

                                                </div>
                                            )
                                        )}

                                        {grupo.items.length ===
                                            0 && (
                                                <div className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
                                                    No hay datos en este periodo.
                                                </div>
                                            )}

                                    </div>

                                </div>
                            )
                        )}

                    </div>
                </section>

                {/* PRODUCTOS */}

                <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">

                    <div className="border-b border-[var(--color-border)] p-5 md:p-6">

                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-warning)]">
                            Ranking
                        </p>

                        <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">
                            🏆 Productos más vendidos
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Top 10 por cantidad de unidades vendidas.
                        </p>

                    </div>

                    <div className="p-5 md:p-6">

                        <div className="space-y-4">

                            {productosMasVendidos.map(
                                (
                                    p,
                                    index
                                ) => {
                                    const max =
                                        productosMasVendidos[0]
                                            ?.unidadesVendidas ||
                                        1;

                                    const porcentaje =
                                        (p.unidadesVendidas /
                                            max) *
                                        100;

                                    return (
                                        <div
                                            key={
                                                p.producto_id
                                            }
                                        >

                                            <div className="flex items-center gap-3">

                                                <div
                                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${index ===
                                                        0
                                                        ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                                                        : "bg-[var(--color-background)] text-[var(--color-text-secondary)]"
                                                        }`}
                                                >
                                                    {index ===
                                                        0
                                                        ? "🥇"
                                                        : index ===
                                                            1
                                                            ? "🥈"
                                                            : index ===
                                                                2
                                                                ? "🥉"
                                                                : index +
                                                                1}
                                                </div>

                                                <div className="min-w-0 flex-1">

                                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                                                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                                                            {
                                                                p.producto
                                                            }
                                                        </p>

                                                        <div className="flex shrink-0 items-center gap-3 text-xs">

                                                            <span className="text-[var(--color-text-secondary)]">
                                                                {formatearNumero(
                                                                    p.unidadesVendidas
                                                                )}{" "}
                                                                unidades
                                                            </span>

                                                            <span className="font-bold text-[var(--color-text)]">
                                                                {formatearMoneda(
                                                                    p.importeVendido
                                                                )}
                                                            </span>

                                                        </div>

                                                    </div>

                                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-background)]">

                                                        <div
                                                            className="h-full rounded-full bg-[var(--color-warning)]"
                                                            style={{
                                                                width: `${Math.min(
                                                                    porcentaje,
                                                                    100
                                                                )}%`,
                                                            }}
                                                        />

                                                    </div>

                                                </div>

                                            </div>

                                        </div>
                                    );
                                }
                            )}

                        </div>

                        {!productosMasVendidos.length && (
                            <div className="py-12 text-center">

                                <div className="mb-3 text-4xl">
                                    📦
                                </div>

                                <p className="font-semibold text-[var(--color-text)]">
                                    No hay productos vendidos
                                </p>

                                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                    Prueba seleccionando otro periodo.
                                </p>

                            </div>
                        )}

                    </div>

                </section>

                {/* DEVOLUCIONES + RESUMEN */}

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">

                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">

                        <div className="border-b border-[var(--color-border)] p-5">

                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-danger)]">
                                Control
                            </p>

                            <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">
                                ↩️ Devoluciones
                            </h2>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Impacto de devoluciones por sucursal.
                            </p>

                        </div>

                        <div className="overflow-x-auto">

                            <table className="w-full min-w-[520px] text-sm">

                                <thead className="bg-[var(--color-background)] text-[var(--color-text-secondary)]">

                                    <tr>

                                        <th className="px-5 py-3 text-left font-semibold">
                                            Sucursal
                                        </th>

                                        <th className="px-5 py-3 text-right font-semibold">
                                            Cantidad
                                        </th>

                                        <th className="px-5 py-3 text-right font-semibold">
                                            Importe
                                        </th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {devolucionesPorSucursal.map(
                                        (i) => (
                                            <tr
                                                key={
                                                    i.sucursal_id
                                                }
                                                className="border-t border-[var(--color-border)]"
                                            >

                                                <td className="px-5 py-4 font-semibold text-[var(--color-text)]">
                                                    {
                                                        i.sucursal
                                                    }
                                                </td>

                                                <td className="px-5 py-4 text-right text-[var(--color-text-secondary)]">
                                                    {
                                                        i.numeroDevoluciones
                                                    }
                                                </td>

                                                <td className="px-5 py-4 text-right">

                                                    <span className="font-bold text-[var(--color-danger)]">
                                                        {formatearMoneda(
                                                            i.totalDevoluciones
                                                        )}
                                                    </span>

                                                    <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                                                        Promedio{" "}
                                                        {formatearMoneda(
                                                            i.promedioDevolucion
                                                        )}
                                                    </p>

                                                </td>

                                            </tr>
                                        )
                                    )}

                                    {!devolucionesPorSucursal.length && (
                                        <tr>

                                            <td
                                                colSpan={
                                                    3
                                                }
                                                className="px-5 py-10 text-center text-sm text-[var(--color-text-secondary)]"
                                            >
                                                No hay devoluciones en este periodo.
                                            </td>

                                        </tr>
                                    )}

                                </tbody>

                            </table>

                        </div>

                    </div>

                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">

                        <div className="border-b border-[var(--color-border)] p-5">

                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                                Información
                            </p>

                            <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">
                                Resumen del periodo
                            </h2>

                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                Indicadores rápidos para toma de decisiones.
                            </p>

                        </div>

                        <div className="grid grid-cols-2 gap-4 p-5">

                            {[
                                [
                                    "Ventas",
                                    resumen.numeroVentas,
                                    "operaciones",
                                ],
                                [
                                    "Sucursales activas",
                                    sucursales.length,
                                    "disponibles",
                                ],
                                [
                                    "Usuarios con ventas",
                                    rendimientoUsuarios.length,
                                    "participantes",
                                ],
                                [
                                    "Productos vendidos",
                                    detallesVenta.reduce(
                                        (
                                            a,
                                            d
                                        ) =>
                                            a +
                                            Number(
                                                d.cantidad ||
                                                0
                                            ),
                                        0
                                    ),
                                    "unidades",
                                ],
                            ].map(
                                ([
                                    label,
                                    value,
                                    unit,
                                ]) => (
                                    <div
                                        key={
                                            String(
                                                label
                                            )
                                        }
                                        className="rounded-2xl bg-[var(--color-background)] p-4"
                                    >

                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                            {
                                                label
                                            }
                                        </p>

                                        <p className="mt-1 text-xl font-bold text-[var(--color-text)]">
                                            {formatearNumero(
                                                Number(
                                                    value
                                                )
                                            )}
                                        </p>

                                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                            {
                                                unit
                                            }
                                        </p>

                                    </div>
                                )
                            )}

                        </div>

                    </div>

                </section>

                {/* VENTAS */}

                <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">

                    <div className="border-b border-[var(--color-border)] p-5 md:p-6">

                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                            Detalle
                        </p>

                        <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">
                            Ventas
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Operaciones completadas en el periodo.
                        </p>

                    </div>

                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[1050px] text-sm">

                            <thead className="bg-[var(--color-background)] text-[var(--color-text-secondary)]">

                                <tr>

                                    {[
                                        "Folio",
                                        "Fecha",
                                        "Sucursal",
                                        "Usuario",
                                        "Método",
                                        "Total",
                                    ].map(
                                        (
                                            h,
                                            i
                                        ) => (
                                            <th
                                                key={
                                                    h
                                                }
                                                className={`px-5 py-3 font-semibold ${i ===
                                                    5
                                                    ? "text-right"
                                                    : "text-left"
                                                    }`}
                                            >
                                                {
                                                    h
                                                }
                                            </th>
                                        )
                                    )}

                                </tr>

                            </thead>

                            <tbody>

                                {ventas.map(
                                    (v) => {
                                        const pagosVenta =
                                            obtenerPagosVenta(
                                                v.id
                                            );

                                        const metodo =
                                            normalizarMetodoPago(
                                                v.metodo_pago
                                            );

                                        return (
                                            <tr
                                                key={
                                                    v.id
                                                }
                                                className="border-t border-[var(--color-border)] transition hover:bg-[var(--color-background)]"
                                            >

                                                <td className="px-5 py-4 font-bold text-[var(--color-text)]">
                                                    #
                                                    {
                                                        v.folio
                                                    }
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-[var(--color-text-secondary)]">
                                                    {formatearFecha(
                                                        v.created_at
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-[var(--color-text-secondary)]">
                                                    {nombreSucursal(
                                                        v.sucursal_id
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">

                                                    <div className="flex items-center gap-2">

                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-background)] text-[10px] font-bold text-[var(--color-text-secondary)]">
                                                            {obtenerIniciales(
                                                                nombreUsuario(
                                                                    v.usuario_id
                                                                )
                                                            )}
                                                        </div>

                                                        <span className="font-medium text-[var(--color-text)]">
                                                            {nombreUsuario(
                                                                v.usuario_id
                                                            )}
                                                        </span>

                                                    </div>

                                                </td>

                                                <td className="px-5 py-4">

                                                    <div className="min-w-[180px]">

                                                        <span
                                                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${obtenerColorMetodo(
                                                                metodo
                                                            )}`}
                                                        >
                                                            {nombreMetodoPago(
                                                                metodo
                                                            )}
                                                        </span>

                                                        {pagosVenta.length >
                                                            0 && (
                                                                <div className="mt-2 space-y-0.5 text-xs text-[var(--color-text-secondary)]">

                                                                    {pagosVenta.map(
                                                                        (
                                                                            p
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    p.id
                                                                                }
                                                                                className="flex justify-between gap-3"
                                                                            >

                                                                                <span>
                                                                                    {nombreMetodoPago(
                                                                                        normalizarMetodoPago(
                                                                                            p.metodo_pago
                                                                                        )
                                                                                    )}
                                                                                </span>

                                                                                <span className="font-medium">
                                                                                    {formatearMoneda(
                                                                                        Number(
                                                                                            p.monto ||
                                                                                            0
                                                                                        )
                                                                                    )}
                                                                                </span>

                                                                            </div>
                                                                        )
                                                                    )}

                                                                </div>
                                                            )}

                                                    </div>

                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-right">

                                                    <span className="font-bold text-[var(--color-text)]">
                                                        {formatearMoneda(
                                                            Number(
                                                                v.total ||
                                                                0
                                                            )
                                                        )}
                                                    </span>

                                                </td>

                                            </tr>
                                        );
                                    }
                                )}

                                {!ventas.length && (
                                    <tr>

                                        <td
                                            colSpan={
                                                6
                                            }
                                            className="px-5 py-12 text-center"
                                        >

                                            <div className="mb-3 text-4xl">
                                                🧾
                                            </div>

                                            <p className="font-semibold text-[var(--color-text)]">
                                                No hay ventas
                                            </p>

                                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                                No existen ventas completadas con los filtros seleccionados.
                                            </p>

                                        </td>

                                    </tr>
                                )}

                            </tbody>

                        </table>

                    </div>

                </section>

                {/* DEVOLUCIONES DETALLADAS */}

                <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">

                    <div className="border-b border-[var(--color-border)] p-5 md:p-6">

                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-danger)]">
                            Detalle
                        </p>

                        <h2 className="mt-1 text-xl font-bold text-[var(--color-text)]">
                            Devoluciones realizadas
                        </h2>

                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Devoluciones completadas en el periodo.
                        </p>

                    </div>

                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[760px] text-sm">

                            <thead className="bg-[var(--color-background)] text-[var(--color-text-secondary)]">

                                <tr>

                                    <th className="px-5 py-3 text-left font-semibold">
                                        Venta
                                    </th>

                                    <th className="px-5 py-3 text-left font-semibold">
                                        Fecha
                                    </th>

                                    <th className="px-5 py-3 text-left font-semibold">
                                        Sucursal
                                    </th>

                                    <th className="px-5 py-3 text-right font-semibold">
                                        Monto
                                    </th>

                                    <th className="px-5 py-3 text-left font-semibold">
                                        Estado
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                {devoluciones.map(
                                    (d) => {
                                        const ventaRelacionada =
                                            ventas.find(
                                                (
                                                    v
                                                ) =>
                                                    v.id ===
                                                    d.venta_id
                                            );

                                        return (
                                            <tr
                                                key={
                                                    d.id
                                                }
                                                className="border-t border-[var(--color-border)] transition hover:bg-[var(--color-danger)]/5"
                                            >

                                                <td className="px-5 py-4 font-semibold text-[var(--color-text)]">
                                                    {ventaRelacionada
                                                        ? `#${ventaRelacionada.folio}`
                                                        : d.venta_id.slice(
                                                            0,
                                                            8
                                                        )}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 text-[var(--color-text-secondary)]">
                                                    {formatearFecha(
                                                        d.created_at
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-[var(--color-text-secondary)]">
                                                    {nombreSucursal(
                                                        d.sucursal_id
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-right">

                                                    <span className="font-bold text-[var(--color-danger)]">
                                                        -
                                                        {formatearMoneda(
                                                            Number(
                                                                d.monto_total ||
                                                                0
                                                            )
                                                        )}
                                                    </span>

                                                </td>

                                                <td className="px-5 py-4">

                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]">

                                                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />

                                                        Completada

                                                    </span>

                                                </td>

                                            </tr>
                                        );
                                    }
                                )}

                                {!devoluciones.length && (
                                    <tr>

                                        <td
                                            colSpan={
                                                5
                                            }
                                            className="px-5 py-12 text-center"
                                        >

                                            <div className="mb-3 text-4xl">
                                                ↩️
                                            </div>

                                            <p className="font-semibold text-[var(--color-text)]">
                                                No hay devoluciones
                                            </p>

                                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                                No existen devoluciones completadas con los filtros seleccionados.
                                            </p>

                                        </td>

                                    </tr>
                                )}

                            </tbody>

                        </table>

                    </div>

                </section>

            </div>

            <ModalMensaje
                abierto={
                    modal.abierto
                }
                tipo={
                    modal.tipo
                }
                titulo={
                    modal.tipo ===
                        "error"
                        ? "Error"
                        : modal.tipo ===
                            "exito"
                            ? "Éxito"
                            : modal.tipo ===
                                "confirmacion"
                                ? "Aviso"
                                : "Información"
                }
                mensaje={
                    modal.mensaje
                }
                onCerrar={
                    cerrarModal
                }
            />

        </div>
    );
}