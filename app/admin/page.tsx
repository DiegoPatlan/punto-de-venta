"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    verificarRol,
    type UsuarioActual,
} from "../../lib/auth/roleGuard";
import Card from "../components/Card";
import ModalMensaje from "../components/ModalMensaje";
import { supabase } from "../../lib/supabase";

/* =========================================================
   TIPOS
========================================================= */

interface Venta {
    id: string;
    folio?: number | null;
    total: number;
    metodo_pago: string;
    created_at: string;
    sucursal_id?: string | null;
    cliente_id?: string | null;
}

interface Devolucion {
    id: string;
    venta_id: string;
    monto_total: number;
    metodo_reembolso: string;
    created_at: string;
    estado: string;
}

interface Pago {
    venta_id: string;
    metodo_pago: string;
    monto: number;
}

interface ProductoStock {
    id: string;
    nombre: string;
    stock: number;
    stock_minimo: number;
    sucursal: string;
}

interface ClienteSaldo {
    id: string;
    nombre: string;
    saldo: number;
}

interface SucursalResumen {
    id: string;
    nombre: string;
    ventas: number;
}

interface ActividadProducto {
    nombre: string;
    cantidad: number;
}

interface Actividad {
    id: string;
    tipo: "venta" | "devolucion";
    fecha: string;
    monto: number;
    folio?: number | string | null;
    metodo?: string | null;
    cliente?: string | null;
    sucursal?: string | null;
    productos: ActividadProducto[];
}

interface DashboardData {
    ventasBrutas: number;
    devoluciones: number;
    ventasNetas: number;
    numeroVentas: number;
    ticketPromedio: number;

    efectivo: number;
    tarjeta: number;
    transferencia: number;
    credito: number;

    productos: number;
    clientes: number;
    stockBajo: number;
    cajasAbiertas: number;

    cuentasPorCobrar: number;
    cuentasPorPagar: number;

    gastosHoy: number;
    costoVentas: number;
    resultadoOperativo: number;

    ventasAyer: number;
    variacionVentas: number;
}

interface VentaDia {
    fecha: string;
    total: number;
}

interface ProductoTop {
    id: string;
    nombre: string;
    cantidad: number;
}

/* =========================================================
   AUXILIARES
========================================================= */

function formatearMoneda(cantidad: number) {
    return Number(cantidad || 0).toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
    });
}

function formatearNumero(cantidad: number) {
    return Number(cantidad || 0).toLocaleString("es-MX");
}

function formatearHora(fecha: string) {
    return new Date(fecha).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatearFechaCorta(fecha: string) {
    return new Date(fecha).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
    });
}

function obtenerMetodoPago(metodo?: string | null) {
    switch ((metodo ?? "").toLowerCase()) {
        case "efectivo":
            return "Efectivo";

        case "tarjeta":
            return "Tarjeta";

        case "transferencia":
            return "Transferencia";

        case "mixto":
            return "Pago mixto";

        case "credito":
            return "Crédito";

        default:
            return metodo || "No especificado";
    }
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function AdminDashboardPage() {
    const router = useRouter();

    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [datos, setDatos] =
        useState<DashboardData | null>(null);

    const [ventasSemana, setVentasSemana] =
        useState<VentaDia[]>([]);

    const [productosTop, setProductosTop] =
        useState<ProductoTop[]>([]);

    const [productosStockBajo, setProductosStockBajo] =
        useState<ProductoStock[]>([]);

    const [clientesSaldo, setClientesSaldo] =
        useState<ClienteSaldo[]>([]);

    const [sucursalesResumen, setSucursalesResumen] =
        useState<SucursalResumen[]>([]);

    const [actividadReciente, setActividadReciente] =
        useState<Actividad[]>([]);

    const [cargando, setCargando] =
        useState(true);

    const [error, setError] =
        useState("");

    const [modalMensajeAbierto, setModalMensajeAbierto] =
        useState(false);

    const [tipoMensaje, setTipoMensaje] =
        useState<"info" | "error" | "exito" | "confirmacion">("info");

    const [tituloMensaje, setTituloMensaje] =
        useState("");

    const [textoMensaje, setTextoMensaje] =
        useState("");

    const [metodoPagoActivo, setMetodoPagoActivo] =
        useState<string | null>(null);

    const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] =
        useState<string | null>(null);

    const [actualizando, setActualizando] =
        useState(false);

    const [puntoActivo, setPuntoActivo] =
        useState<number | null>(null);

    const [puntoSeleccionado, setPuntoSeleccionado] =
        useState<number | null>(null);

    const puntoGrafica =
        puntoActivo ?? puntoSeleccionado;

    const mostrarMensaje = (
        tipo: "info" | "error" | "exito" | "confirmacion",
        titulo: string,
        mensaje: string
    ) => {
        setTipoMensaje(tipo);
        setTituloMensaje(titulo);
        setTextoMensaje(mensaje);
        setModalMensajeAbierto(true);
    };

    const cerrarModalMensaje = () => {
        setModalMensajeAbierto(false);
    };

    /* =====================================================
       CARGAR DASHBOARD
    ===================================================== */

    const cargarDashboard = useCallback(
        async () => {
            setCargando(true);
            setActualizando(true);
            setError("");

            try {
                /* =============================================
                   SEGURIDAD
                ============================================= */

                const resultado =
                    await verificarRol(["admin"]);

                if (!resultado.autorizado) {
                    router.replace(
                        resultado.motivo === "no_autenticado"
                            ? "/admin/login"
                            : "/pos/login"
                    );

                    return;
                }

                const usuarioActual =
                    resultado.usuario;

                if (!usuarioActual?.negocio_id) {
                    throw new Error(
                        "No se encontró el negocio asociado al usuario."
                    );
                }

                setUsuario(usuarioActual);

                const negocioId =
                    usuarioActual.negocio_id;

                /* =============================================
                   FECHAS
                ============================================= */

                const ahora = new Date();

                const inicioHoy =
                    new Date(
                        ahora.getFullYear(),
                        ahora.getMonth(),
                        ahora.getDate()
                    );

                const finHoy =
                    new Date(
                        ahora.getFullYear(),
                        ahora.getMonth(),
                        ahora.getDate() + 1
                    );

                const inicioAyer =
                    new Date(
                        ahora.getFullYear(),
                        ahora.getMonth(),
                        ahora.getDate() - 1
                    );

                const inicioSemana =
                    new Date(
                        ahora.getFullYear(),
                        ahora.getMonth(),
                        ahora.getDate() - 6
                    );

                inicioSemana.setHours(
                    0,
                    0,
                    0,
                    0
                );

                /* =============================================
                   VENTAS
                ============================================= */

                const {
                    data: ventasData,
                    error: ventasError,
                } = await supabase
                    .from("ventas")
                    .select(
                        `
                        id,
                        folio,
                        total,
                        metodo_pago,
                        created_at,
                        sucursal_id,
                        cliente_id
                        `
                    )
                    .eq(
                        "negocio_id",
                        negocioId
                    )
                    .eq(
                        "estado",
                        "completada"
                    )
                    .gte(
                        "created_at",
                        inicioSemana.toISOString()
                    )
                    .lt(
                        "created_at",
                        finHoy.toISOString()
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false,
                        }
                    );

                if (ventasError) {
                    throw ventasError;
                }

                const ventas =
                    (ventasData as Venta[]) ?? [];

                /* =============================================
                   DEVOLUCIONES
                ============================================= */

                const {
                    data: devolucionesData,
                    error: devolucionesError,
                } = await supabase
                    .from("devoluciones")
                    .select(
                        `
                        id,
                        venta_id,
                        monto_total,
                        metodo_reembolso,
                        created_at,
                        estado
                        `
                    )
                    .eq(
                        "negocio_id",
                        negocioId
                    )
                    .eq(
                        "estado",
                        "completada"
                    )
                    .gte(
                        "created_at",
                        inicioSemana.toISOString()
                    )
                    .lt(
                        "created_at",
                        finHoy.toISOString()
                    )
                    .order(
                        "created_at",
                        {
                            ascending: false,
                        }
                    );

                if (devolucionesError) {
                    throw devolucionesError;
                }

                const devoluciones =
                    (devolucionesData as Devolucion[]) ?? [];

                /* =============================================
                   FILTROS DEL DÍA
                ============================================= */

                const ventasHoy =
                    ventas.filter(
                        (venta) => {
                            const fecha =
                                new Date(
                                    venta.created_at
                                );

                            return (
                                fecha >= inicioHoy &&
                                fecha < finHoy
                            );
                        }
                    );

                const ventasAyerLista =
                    ventas.filter(
                        (venta) => {
                            const fecha =
                                new Date(
                                    venta.created_at
                                );

                            return (
                                fecha >= inicioAyer &&
                                fecha < inicioHoy
                            );
                        }
                    );

                const devolucionesHoy =
                    devoluciones.filter(
                        (devolucion) => {
                            const fecha =
                                new Date(
                                    devolucion.created_at
                                );

                            return (
                                fecha >= inicioHoy &&
                                fecha < finHoy
                            );
                        }
                    );

                const devolucionesAyer =
                    devoluciones.filter(
                        (devolucion) => {
                            const fecha =
                                new Date(
                                    devolucion.created_at
                                );

                            return (
                                fecha >= inicioAyer &&
                                fecha < inicioHoy
                            );
                        }
                    );

                /* =============================================
                   VENTAS NETAS
                ============================================= */

                const sumarCampo =
                    (
                        items: any[],
                        campo: string
                    ) =>
                        items.reduce(
                            (
                                total,
                                item
                            ) =>
                                total +
                                Number(
                                    item[campo] ??
                                    0
                                ),
                            0
                        );

                const ventasBrutas =
                    sumarCampo(
                        ventasHoy,
                        "total"
                    );

                const devolucionesTotal =
                    sumarCampo(
                        devolucionesHoy,
                        "monto_total"
                    );

                const ventasNetas =
                    Math.max(
                        0,
                        ventasBrutas -
                        devolucionesTotal
                    );

                const ventasAyer =
                    Math.max(
                        0,
                        sumarCampo(
                            ventasAyerLista,
                            "total"
                        ) -
                        sumarCampo(
                            devolucionesAyer,
                            "monto_total"
                        )
                    );

                const variacionVentas =
                    ventasAyer === 0
                        ? ventasNetas > 0
                            ? 100
                            : 0
                        : ((ventasNetas -
                            ventasAyer) /
                            ventasAyer) *
                        100;

                const ticketPromedio =
                    ventasHoy.length > 0
                        ? ventasNetas /
                        ventasHoy.length
                        : 0;

                /* =============================================
                   PAGOS
                   IMPORTANTE:
                   Se usa pagos.monto.
                   Incluye crédito y pagos mixtos.
                ============================================= */

                const ventaIdsHoy =
                    ventasHoy.map(
                        (venta) =>
                            venta.id
                    );

                let efectivo = 0;
                let tarjeta = 0;
                let transferencia = 0;
                let credito = 0;

                const pagosPorVenta =
                    new Map<
                        string,
                        Pago[]
                    >();

                if (
                    ventaIdsHoy.length >
                    0
                ) {
                    const {
                        data: pagosData,
                        error: pagosError,
                    } = await supabase
                        .from("pagos")
                        .select(
                            `
                            venta_id,
                            metodo_pago,
                            monto
                            `
                        )
                        .in(
                            "venta_id",
                            ventaIdsHoy
                        );

                    if (pagosError) {
                        throw pagosError;
                    }

                    for (
                        const pago of
                        (pagosData as Pago[]) ??
                        []
                    ) {
                        const monto =
                            Number(
                                pago.monto ??
                                0
                            );

                        const lista =
                            pagosPorVenta.get(
                                pago.venta_id
                            ) ?? [];

                        lista.push(
                            pago
                        );

                        pagosPorVenta.set(
                            pago.venta_id,
                            lista
                        );

                        switch (
                        pago.metodo_pago
                        ) {
                            case "efectivo":
                                efectivo +=
                                    monto;
                                break;

                            case "tarjeta":
                                tarjeta +=
                                    monto;
                                break;

                            case "transferencia":
                                transferencia +=
                                    monto;
                                break;

                            case "credito":
                                credito +=
                                    monto;
                                break;
                        }
                    }
                }

                /* =============================================
                   PRODUCTOS
                ============================================= */

                const {
                    count:
                    productosCount,
                    error:
                    productosError,
                } = await supabase
                    .from("productos")
                    .select(
                        "id",
                        {
                            count: "exact",
                            head: true,
                        }
                    )
                    .eq(
                        "negocio_id",
                        negocioId
                    )
                    .eq(
                        "activo",
                        true
                    );

                if (productosError) {
                    throw productosError;
                }

                /* =============================================
                   CLIENTES
                ============================================= */

                const {
                    count:
                    clientesCount,
                    error:
                    clientesError,
                } = await supabase
                    .from("clientes")
                    .select(
                        "id",
                        {
                            count: "exact",
                            head: true,
                        }
                    )
                    .eq(
                        "negocio_id",
                        negocioId
                    )
                    .eq(
                        "activo",
                        true
                    );

                if (clientesError) {
                    throw clientesError;
                }

                /* =============================================
                   INVENTARIO

                   stock <= stock_minimo

                   Se cuentan productos distintos,
                   aunque existan en varias sucursales.
                ============================================= */

                const {
                    data:
                    inventarioData,
                    error:
                    inventarioError,
                } = await supabase
                    .from("inventario")
                    .select(
                        `
                        id,
                        stock,
                        producto_id,
                        sucursal_id,
                        productos (
                            id,
                            nombre,
                            stock_minimo
                        ),
                        sucursales (
                            id,
                            nombre,
                            negocio_id
                        )
                        `
                    );

                if (inventarioError) {
                    throw inventarioError;
                }

                const stockBajoMap =
                    new Map<
                        string,
                        ProductoStock
                    >();

                for (
                    const item of
                    (inventarioData as any[]) ??
                    []
                ) {
                    const producto =
                        item.productos;

                    const sucursal =
                        item.sucursales;

                    if (
                        !producto ||
                        sucursal?.negocio_id !==
                        negocioId
                    ) {
                        continue;
                    }

                    const stock =
                        Number(
                            item.stock ??
                            0
                        );

                    const minimo =
                        Number(
                            producto.stock_minimo ??
                            0
                        );

                    if (
                        stock <=
                        minimo
                    ) {
                        const anterior =
                            stockBajoMap.get(
                                producto.id
                            );

                        if (
                            !anterior ||
                            stock <
                            anterior.stock
                        ) {
                            stockBajoMap.set(
                                producto.id,
                                {
                                    id:
                                        producto.id,
                                    nombre:
                                        producto.nombre ??
                                        "Producto sin nombre",
                                    stock,
                                    stock_minimo:
                                        minimo,
                                    sucursal:
                                        sucursal.nombre ??
                                        "Sucursal",
                                }
                            );
                        }
                    }
                }

                const productosStock =
                    Array.from(
                        stockBajoMap.values()
                    )
                        .sort(
                            (a, b) =>
                                a.stock -
                                b.stock
                        )
                        .slice(0, 8);

                /* =============================================
                   CAJAS ABIERTAS
                ============================================= */

                const {
                    data:
                    sesionesData,
                    error:
                    sesionesError,
                } = await supabase
                    .from("sesiones_caja")
                    .select(
                        `
                        id,
                        estado,
                        cajas (
                            sucursal_id,
                            sucursales (
                                negocio_id
                            )
                        )
                        `
                    )
                    .eq(
                        "estado",
                        "abierta"
                    );

                if (sesionesError) {
                    throw sesionesError;
                }

                const cajasAbiertas =
                    (
                        sesionesData ??
                        []
                    ).filter(
                        (
                            sesion: any
                        ) =>
                            sesion.cajas
                                ?.sucursales
                                ?.negocio_id ===
                            negocioId
                    ).length;

                /* =============================================
                   CUENTAS POR COBRAR
                ============================================= */

                const {
                    data:
                    clientesData,
                    error:
                    clientesSaldoError,
                } = await supabase
                    .from("clientes")
                    .select(
                        `
                        id,
                        nombre,
                        saldo_credito
                        `
                    )
                    .eq(
                        "negocio_id",
                        negocioId
                    )
                    .eq(
                        "activo",
                        true
                    );

                if (
                    clientesSaldoError
                ) {
                    throw clientesSaldoError;
                }

                const clientesConSaldo =
                    (
                        (clientesData as any[]) ??
                        []
                    )
                        .map(
                            (
                                cliente
                            ) => ({
                                id:
                                    cliente.id,
                                nombre:
                                    cliente.nombre ??
                                    "Cliente",
                                saldo:
                                    Number(
                                        cliente.saldo_credito ??
                                        0
                                    ),
                            })
                        )
                        .filter(
                            (cliente) =>
                                cliente.saldo >
                                0
                        )
                        .sort(
                            (a, b) =>
                                b.saldo -
                                a.saldo
                        );

                const cuentasPorCobrar =
                    clientesConSaldo.reduce(
                        (
                            total,
                            cliente
                        ) =>
                            total +
                            cliente.saldo,
                        0
                    );

                /* =============================================
                   CUENTAS POR PAGAR
                   NO CONTAR CANCELADAS
                ============================================= */

                const {
                    data:
                    cuentasData,
                    error:
                    cuentasError,
                } = await supabase
                    .from(
                        "cuentas_por_pagar"
                    )
                    .select(
                        `
                        monto_pendiente,
                        estado
                        `
                    )
                    .eq(
                        "negocio_id",
                        negocioId
                    )
                    .neq(
                        "estado",
                        "cancelada"
                    );

                if (cuentasError) {
                    throw cuentasError;
                }

                const cuentasPorPagar =
                    (
                        (cuentasData as any[]) ??
                        []
                    ).reduce(
                        (
                            total,
                            cuenta
                        ) =>
                            total +
                            Number(
                                cuenta.monto_pendiente ??
                                0
                            ),
                        0
                    );

                /* =============================================
                   GASTOS
                ============================================= */

                const {
                    data:
                    gastosData,
                    error:
                    gastosError,
                } = await supabase
                    .from("gastos")
                    .select(
                        `
                        monto,
                        created_at
                        `
                    )
                    .eq(
                        "negocio_id",
                        negocioId
                    )
                    .gte(
                        "created_at",
                        inicioHoy.toISOString()
                    )
                    .lt(
                        "created_at",
                        finHoy.toISOString()
                    );

                if (gastosError) {
                    throw gastosError;
                }

                const gastosHoy =
                    (
                        (gastosData as any[]) ??
                        []
                    ).reduce(
                        (
                            total,
                            gasto
                        ) =>
                            total +
                            Number(
                                gasto.monto ??
                                0
                            ),
                        0
                    );

                /* =============================================
                   COSTO DE VENTAS

                   Se calcula con precio_compra actual.
                   Es una estimación mientras no exista
                   snapshot histórico de costo.
                ============================================= */

                let costoVentas = 0;

                if (
                    ventaIdsHoy.length >
                    0
                ) {
                    const {
                        data:
                        detallesCosto,
                        error:
                        costoError,
                    } = await supabase
                        .from(
                            "detalle_ventas"
                        )
                        .select(
                            `
                            venta_id,
                            producto_id,
                            cantidad,
                            productos (
                                precio_compra
                            )
                            `
                        )
                        .in(
                            "venta_id",
                            ventaIdsHoy
                        );

                    if (costoError) {
                        throw costoError;
                    }

                    costoVentas =
                        (
                            (detallesCosto as any[]) ??
                            []
                        ).reduce(
                            (
                                total,
                                detalle
                            ) =>
                                total +
                                Number(
                                    detalle.cantidad ??
                                    0
                                ) *
                                Number(
                                    detalle
                                        .productos
                                        ?.precio_compra ??
                                    0
                                ),
                            0
                        );

                    /* =========================================
                       RESTAR COSTO DE PRODUCTOS DEVUELTOS
                    ========================================= */

                    const devolucionIds =
                        devolucionesHoy.map(
                            (d) => d.id
                        );

                    if (
                        devolucionIds.length >
                        0
                    ) {
                        const {
                            data:
                            detallesDev,
                            error:
                            devCostoError,
                        } = await supabase
                            .from(
                                "detalle_devoluciones"
                            )
                            .select(
                                `
                                cantidad,
                                detalle_ventas (
                                    productos (
                                        precio_compra
                                    )
                                )
                                `
                            )
                            .in(
                                "devolucion_id",
                                devolucionIds
                            );

                        if (
                            devCostoError
                        ) {
                            throw devCostoError;
                        }

                        const costoDevuelto =
                            (
                                (detallesDev as any[]) ??
                                []
                            ).reduce(
                                (
                                    total,
                                    detalle
                                ) =>
                                    total +
                                    Number(
                                        detalle.cantidad ??
                                        0
                                    ) *
                                    Number(
                                        detalle
                                            .detalle_ventas
                                            ?.productos
                                            ?.precio_compra ??
                                        0
                                    ),
                                0
                            );

                        costoVentas =
                            Math.max(
                                0,
                                costoVentas -
                                costoDevuelto
                            );
                    }
                }

                const resultadoOperativo =
                    ventasNetas -
                    costoVentas -
                    gastosHoy;

                /* =============================================
                   VENTAS DE LOS ÚLTIMOS 7 DÍAS
                ============================================= */

                const ventasSemanaResultado:
                    VentaDia[] = [];

                for (
                    let i = 6;
                    i >= 0;
                    i--
                ) {
                    const fecha =
                        new Date(
                            ahora.getFullYear(),
                            ahora.getMonth(),
                            ahora.getDate() -
                            i
                        );

                    const inicio =
                        new Date(
                            fecha.getFullYear(),
                            fecha.getMonth(),
                            fecha.getDate()
                        );

                    const fin =
                        new Date(
                            fecha.getFullYear(),
                            fecha.getMonth(),
                            fecha.getDate() +
                            1
                        );

                    const bruto =
                        ventas
                            .filter(
                                (venta) => {
                                    const fechaVenta =
                                        new Date(
                                            venta.created_at
                                        );

                                    return (
                                        fechaVenta >=
                                        inicio &&
                                        fechaVenta <
                                        fin
                                    );
                                }
                            )
                            .reduce(
                                (
                                    total,
                                    venta
                                ) =>
                                    total +
                                    Number(
                                        venta.total ??
                                        0
                                    ),
                                0
                            );

                    const devuelto =
                        devoluciones
                            .filter(
                                (
                                    devolucion
                                ) => {
                                    const fechaDev =
                                        new Date(
                                            devolucion.created_at
                                        );

                                    return (
                                        fechaDev >=
                                        inicio &&
                                        fechaDev <
                                        fin
                                    );
                                }
                            )
                            .reduce(
                                (
                                    total,
                                    devolucion
                                ) =>
                                    total +
                                    Number(
                                        devolucion.monto_total ??
                                        0
                                    ),
                                0
                            );

                    ventasSemanaResultado.push(
                        {
                            fecha:
                                fecha.toLocaleDateString(
                                    "es-MX",
                                    {
                                        weekday:
                                            "short",
                                        day: "2-digit",
                                    }
                                ),
                            total:
                                Math.max(
                                    0,
                                    bruto -
                                    devuelto
                                ),
                        }
                    );
                }

                /* =============================================
                   PRODUCTOS MÁS VENDIDOS
                ============================================= */

                let productosTopResultado:
                    ProductoTop[] = [];

                if (
                    ventaIdsHoy.length >
                    0
                ) {
                    const {
                        data:
                        detallesData,
                        error:
                        detallesError,
                    } = await supabase
                        .from(
                            "detalle_ventas"
                        )
                        .select(
                            `
                            producto_id,
                            cantidad,
                            venta_id,
                            productos (
                                nombre
                            )
                            `
                        )
                        .in(
                            "venta_id",
                            ventaIdsHoy
                        );

                    if (
                        detallesError
                    ) {
                        throw detallesError;
                    }

                    const mapa =
                        new Map<
                            string,
                            ProductoTop
                        >();

                    for (
                        const detalle of
                        (detallesData as any[]) ??
                        []
                    ) {
                        const cantidad =
                            Number(
                                detalle.cantidad ??
                                0
                            );

                        const existente =
                            mapa.get(
                                detalle.producto_id
                            );

                        if (
                            existente
                        ) {
                            existente.cantidad +=
                                cantidad;
                        } else {
                            mapa.set(
                                detalle.producto_id,
                                {
                                    id:
                                        detalle.producto_id,
                                    nombre:
                                        detalle
                                            .productos
                                            ?.nombre ??
                                        "Producto sin nombre",
                                    cantidad,
                                }
                            );
                        }
                    }

                    productosTopResultado =
                        Array.from(
                            mapa.values()
                        )
                            .sort(
                                (a, b) =>
                                    b.cantidad -
                                    a.cantidad
                            )
                            .slice(
                                0,
                                5
                            );
                }

                /* =============================================
                   SUCURSALES
                   VENTAS NETAS
                ============================================= */

                const {
                    data:
                    sucursalesData,
                    error:
                    sucursalesError,
                } = await supabase
                    .from(
                        "sucursales"
                    )
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
                    );

                if (
                    sucursalesError
                ) {
                    throw sucursalesError;
                }

                const sucursales =
                    (sucursalesData as any[]) ??
                    [];

                const ventasPorId =
                    new Map(
                        ventas.map(
                            (venta) => [
                                venta.id,
                                venta,
                            ]
                        )
                    );

                const sucursalesResultado =
                    sucursales.map(
                        (sucursal) => {
                            const bruto =
                                ventasHoy
                                    .filter(
                                        (
                                            venta
                                        ) =>
                                            venta.sucursal_id ===
                                            sucursal.id
                                    )
                                    .reduce(
                                        (
                                            total,
                                            venta
                                        ) =>
                                            total +
                                            Number(
                                                venta.total ??
                                                0
                                            ),
                                        0
                                    );

                            const devolucionesSucursal =
                                devolucionesHoy.reduce(
                                    (
                                        total,
                                        devolucion
                                    ) => {
                                        const venta =
                                            ventasPorId.get(
                                                devolucion.venta_id
                                            );

                                        return (
                                            total +
                                            (venta
                                                ?.sucursal_id ===
                                                sucursal.id
                                                ? Number(
                                                    devolucion.monto_total ??
                                                    0
                                                )
                                                : 0)
                                        );
                                    },
                                    0
                                );

                            return {
                                id:
                                    sucursal.id,
                                nombre:
                                    sucursal.nombre ??
                                    "Sucursal",
                                ventas:
                                    Math.max(
                                        0,
                                        bruto -
                                        devolucionesSucursal
                                    ),
                            };
                        }
                    );

                /* =============================================
                   ACTIVIDAD RECIENTE
                ============================================= */

                const ventasRecientes =
                    ventasHoy.slice(
                        0,
                        8
                    );

                const ventaIdsRecientes =
                    ventasRecientes.map(
                        (venta) =>
                            venta.id
                    );

                const {
                    data:
                    detallesRecientesData,
                    error:
                    detallesRecientesError,
                } =
                    ventaIdsRecientes.length
                        ? await supabase
                            .from(
                                "detalle_ventas"
                            )
                            .select(
                                `
                                  venta_id,
                                  cantidad,
                                  productos (
                                      nombre
                                  )
                                  `
                            )
                            .in(
                                "venta_id",
                                ventaIdsRecientes
                            )
                        : {
                            data: [],
                            error: null,
                        };

                if (
                    detallesRecientesError
                ) {
                    throw detallesRecientesError;
                }

                const detallesRecientes =
                    (detallesRecientesData as any[]) ??
                    [];

                const clienteIds =
                    Array.from(
                        new Set(
                            ventasRecientes
                                .map(
                                    (venta) =>
                                        venta.cliente_id
                                )
                                .filter(
                                    Boolean
                                )
                        )
                    ) as string[];

                const {
                    data:
                    clientesVentaData,
                    error:
                    clientesVentaError,
                } = clienteIds.length
                        ? await supabase
                            .from(
                                "clientes"
                            )
                            .select(
                                `
                              id,
                              nombre
                              `
                            )
                            .in(
                                "id",
                                clienteIds
                            )
                        : {
                            data: [],
                            error: null,
                        };

                if (
                    clientesVentaError
                ) {
                    throw clientesVentaError;
                }

                const clientesMap =
                    new Map(
                        (
                            (clientesVentaData as any[]) ??
                            []
                        ).map(
                            (cliente) => [
                                cliente.id,
                                cliente.nombre,
                            ]
                        )
                    );

                const sucursalesMap =
                    new Map(
                        sucursales.map(
                            (sucursal) => [
                                sucursal.id,
                                sucursal.nombre,
                            ]
                        )
                    );

                const actividadesVentas:
                    Actividad[] =
                    ventasRecientes.map(
                        (venta) => {
                            const pagos =
                                pagosPorVenta.get(
                                    venta.id
                                ) ?? [];

                            const metodos =
                                Array.from(
                                    new Set(
                                        pagos.map(
                                            (
                                                pago
                                            ) =>
                                                pago.metodo_pago
                                        )
                                    )
                                );

                            const metodo =
                                metodos.length >
                                    1
                                    ? "mixto"
                                    : metodos[0] ??
                                    venta.metodo_pago;

                            return {
                                id: `venta-${venta.id}`,
                                tipo: "venta",
                                fecha:
                                    venta.created_at,
                                monto:
                                    Number(
                                        venta.total ??
                                        0
                                    ),
                                folio:
                                    venta.folio,
                                metodo,
                                cliente:
                                    venta.cliente_id
                                        ? clientesMap.get(
                                            venta.cliente_id
                                        ) ??
                                        null
                                        : null,
                                sucursal:
                                    venta.sucursal_id
                                        ? sucursalesMap.get(
                                            venta.sucursal_id
                                        ) ??
                                        null
                                        : null,
                                productos:
                                    detallesRecientes
                                        .filter(
                                            (
                                                detalle
                                            ) =>
                                                detalle.venta_id ===
                                                venta.id
                                        )
                                        .map(
                                            (
                                                detalle
                                            ) => ({
                                                nombre:
                                                    detalle
                                                        .productos
                                                        ?.nombre ??
                                                    "Producto sin nombre",
                                                cantidad:
                                                    Number(
                                                        detalle.cantidad ??
                                                        0
                                                    ),
                                            })
                                        ),
                            };
                        }
                    );

                const devolucionesRecientes =
                    devolucionesHoy.slice(
                        0,
                        8
                    );

                const devolucionIds =
                    devolucionesRecientes.map(
                        (devolucion) =>
                            devolucion.id
                    );

                const {
                    data:
                    detallesDevData,
                    error:
                    detallesDevError,
                } =
                    devolucionIds.length
                        ? await supabase
                            .from(
                                "detalle_devoluciones"
                            )
                            .select(
                                `
                                  devolucion_id,
                                  cantidad,
                                  detalle_ventas (
                                      productos (
                                          nombre
                                      )
                                  )
                                  `
                            )
                            .in(
                                "devolucion_id",
                                devolucionIds
                            )
                        : {
                            data: [],
                            error: null,
                        };

                if (
                    detallesDevError
                ) {
                    throw detallesDevError;
                }

                const detallesDev =
                    (detallesDevData as any[]) ??
                    [];

                const actividadesDevoluciones:
                    Actividad[] =
                    devolucionesRecientes.map(
                        (
                            devolucion
                        ) => {
                            const venta =
                                ventasPorId.get(
                                    devolucion.venta_id
                                );

                            return {
                                id: `devolucion-${devolucion.id}`,
                                tipo: "devolucion",
                                fecha:
                                    devolucion.created_at,
                                monto:
                                    Number(
                                        devolucion.monto_total ??
                                        0
                                    ),
                                folio:
                                    venta?.folio ??
                                    null,
                                metodo:
                                    devolucion.metodo_reembolso,
                                cliente:
                                    venta?.cliente_id
                                        ? clientesMap.get(
                                            venta.cliente_id
                                        ) ??
                                        null
                                        : null,
                                sucursal:
                                    venta?.sucursal_id
                                        ? sucursalesMap.get(
                                            venta.sucursal_id
                                        ) ??
                                        null
                                        : null,
                                productos:
                                    detallesDev
                                        .filter(
                                            (
                                                detalle
                                            ) =>
                                                detalle.devolucion_id ===
                                                devolucion.id
                                        )
                                        .map(
                                            (
                                                detalle
                                            ) => ({
                                                nombre:
                                                    detalle
                                                        .detalle_ventas
                                                        ?.productos
                                                        ?.nombre ??
                                                    "Producto sin nombre",
                                                cantidad:
                                                    Number(
                                                        detalle.cantidad ??
                                                        0
                                                    ),
                                            })
                                        ),
                            };
                        }
                    );

                /* =============================================
                   GUARDAR
                ============================================= */

                setDatos({
                    ventasBrutas,
                    devoluciones:
                        devolucionesTotal,
                    ventasNetas,
                    numeroVentas:
                        ventasHoy.length,
                    ticketPromedio,

                    efectivo,
                    tarjeta,
                    transferencia,
                    credito,

                    productos:
                        productosCount ??
                        0,

                    clientes:
                        clientesCount ??
                        0,

                    stockBajo:
                        stockBajoMap.size,

                    cajasAbiertas,

                    cuentasPorCobrar,
                    cuentasPorPagar,

                    gastosHoy,
                    costoVentas,
                    resultadoOperativo,

                    ventasAyer,
                    variacionVentas,
                });

                setVentasSemana(
                    ventasSemanaResultado
                );

                setProductosTop(
                    productosTopResultado
                );

                setProductosStockBajo(
                    productosStock
                );

                setClientesSaldo(
                    clientesConSaldo.slice(
                        0,
                        5
                    )
                );

                setSucursalesResumen(
                    sucursalesResultado
                );

                setActividadReciente(
                    [
                        ...actividadesVentas,
                        ...actividadesDevoluciones,
                    ]
                        .sort(
                            (a, b) =>
                                new Date(
                                    b.fecha
                                ).getTime() -
                                new Date(
                                    a.fecha
                                ).getTime()
                        )
                        .slice(
                            0,
                            8
                        )
                );

                setPuntoActivo(null);
                setPuntoSeleccionado(null);
                setMetodoPagoActivo(null);
                setMetodoPagoSeleccionado(null);
            } catch (err) {
                const mensaje =
                    err instanceof Error
                        ? err.message
                        : "No se pudo cargar el Dashboard. Intenta nuevamente.";

                setError(mensaje);
                mostrarMensaje(
                    "error",
                    "No se pudo cargar el dashboard",
                    mensaje
                );
            } finally {
                setCargando(false);
                setActualizando(false);
            }
        },
        [router]
    );

    useEffect(() => {
        cargarDashboard();
    }, [cargarDashboard]);

    /* =========================================================
       DATOS DE GRÁFICAS
    ========================================================= */

    const maxVentaSemana =
        useMemo(
            () =>
                Math.max(
                    ...ventasSemana.map(
                        (venta) =>
                            venta.total
                    ),
                    1
                ),
            [ventasSemana]
        );

    const maxSucursal =
        useMemo(
            () =>
                Math.max(
                    ...sucursalesResumen.map(
                        (sucursal) =>
                            sucursal.ventas
                    ),
                    1
                ),
            [sucursalesResumen]
        );

    const totalPagos =
        (datos?.efectivo ?? 0) +
        (datos?.tarjeta ?? 0) +
        (datos?.transferencia ?? 0) +
        (datos?.credito ?? 0);

    const metodosPago =
        useMemo(
            () =>
                [
                    {
                        nombre: "Efectivo",
                        valor:
                            datos?.efectivo ??
                            0,
                    },
                    {
                        nombre: "Tarjeta",
                        valor:
                            datos?.tarjeta ??
                            0,
                    },
                    {
                        nombre:
                            "Transferencia",
                        valor:
                            datos?.transferencia ??
                            0,
                    },
                    {
                        nombre: "Crédito",
                        valor:
                            datos?.credito ??
                            0,
                    },
                ].map(
                    (metodo) => ({
                        ...metodo,
                        porcentaje:
                            totalPagos >
                                0
                                ? (metodo.valor /
                                    totalPagos) *
                                100
                                : 0,
                    })
                ),
            [datos, totalPagos]
        );

    /* =========================================================
       GRÁFICA DE VENTAS
    ========================================================= */

    const chartWidth = 760;
    const chartHeight = 310;

    const chartLeft = 48;
    const chartRight = 720;
    const chartTop = 35;
    const chartBottom = 250;

    const chartInnerWidth =
        chartRight -
        chartLeft;

    const chartInnerHeight =
        chartBottom -
        chartTop;

    const puntosGrafica =
        ventasSemana.map(
            (venta, index) => {
                const x =
                    chartLeft +
                    (index /
                        Math.max(
                            ventasSemana.length -
                            1,
                            1
                        )) *
                    chartInnerWidth;

                const y =
                    chartBottom -
                    (venta.total /
                        maxVentaSemana) *
                    chartInnerHeight;

                return {
                    x,
                    y,
                    venta,
                };
            }
        );

    const lineaGrafica =
        puntosGrafica
            .map(
                (punto) =>
                    `${punto.x},${punto.y}`
            )
            .join(" ");

    const areaGrafica =
        puntosGrafica.length
            ? `${chartLeft},${chartBottom} ${lineaGrafica} ${chartRight},${chartBottom}`
            : "";

    const ventaSeleccionada =
        puntoGrafica !== null
            ? ventasSemana[
            puntoGrafica
            ]
            : null;

    const valorVentaSeleccionada =
        ventaSeleccionada?.total ??
        0;

    const variacionPositiva =
        (datos?.variacionVentas ??
            0) >= 0;

    /* =========================================================
       CARGANDO
    ========================================================= */

    if (cargando) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center px-5">
                <div className="w-full max-w-md overflow-hidden rounded-[30px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl shadow-[var(--color-primary)]/10">
                    <div className="h-2 bg-gradient-to-r from-[var(--color-secondary)] via-[var(--color-primary)] to-[var(--color-primary-hover)]" />

                    <div className="px-8 py-10 text-center">
                        <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-secondary)] via-[var(--color-primary)] to-[var(--color-primary-hover)] text-2xl text-white shadow-lg shadow-[var(--color-primary)]/20">
                            📊
                        </div>

                        <p className="mt-5 text-lg font-black text-[var(--color-text)]">
                            Cargando dashboard
                        </p>

                        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                            Estamos preparando
                            la información de
                            tu negocio...
                        </p>

                        <div className="mx-auto mt-6 h-2 max-w-xs overflow-hidden rounded-full bg-[var(--color-primary)]/10">
                            <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-[var(--color-secondary)] via-[var(--color-primary)] to-[var(--color-primary-hover)]" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* =========================================================
       ERROR
    ========================================================= */

    if (error || !datos) {
        return (
            <div className="space-y-5 pb-8">
                <div className="overflow-hidden rounded-[30px] border border-[var(--color-danger)]/20 bg-[var(--color-surface)] shadow-lg shadow-red-100/40">
                    <div className="h-2 bg-gradient-to-r from-red-700 via-red-500 to-orange-400" />

                    <div className="p-6 sm:p-8">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-danger)]/10 text-2xl">
                                ⚠️
                            </div>

                            <div className="flex-1">
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-danger)]">
                                    Dashboard
                                </p>

                                <h2 className="mt-1 text-xl font-black text-[var(--color-text)]">
                                    No se pudo
                                    cargar el
                                    resumen
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                                    No fue posible obtener los datos del dashboard.
                                    Puedes intentar cargarlo nuevamente.
                                </p>

                                <button
                                    type="button"
                                    onClick={
                                        cargarDashboard
                                    }
                                    className="mt-5 rounded-xl bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary-hover)] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[var(--color-secondary)]/20 transition hover:-translate-y-0.5 hover:shadow-xl"
                                >
                                    Intentar
                                    nuevamente
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* =========================================================
       RENDER
    ========================================================= */

    return (
        <div className="space-y-6 pb-10">

            {/* =================================================
                HERO
            ================================================= */}

            <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[var(--color-secondary)] via-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-2xl shadow-[var(--color-secondary)]/20">

                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--color-primary-hover)]/20 blur-3xl" />

                <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-[var(--color-primary)]/20 blur-3xl" />

                <div className="relative px-5 py-7 sm:px-8 sm:py-9">

                    <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">

                        <div className="min-w-0">

                            <div className="flex items-center gap-3">

                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-[var(--color-surface)]/10 text-xl shadow-inner backdrop-blur">
                                    📊
                                </div>

                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/70">
                                        PANEL
                                        ADMINISTRATIVO
                                    </p>

                                    <p className="text-xs font-semibold text-white/80">
                                        Resumen
                                        ejecutivo
                                    </p>
                                </div>

                            </div>

                            <h1 className="mt-5 truncate text-3xl font-black tracking-tight sm:text-4xl">
                                {usuario?.negocios?.nombre ??
                                    "Tienda Demo"}
                            </h1>

                            <p className="mt-2 text-sm font-medium text-white/80">
                                {usuario?.negocios
                                    ?.tipo_negocio ??
                                    "Abarrotes"}{" "}
                                · Operación
                                general del
                                negocio
                            </p>

                        </div>

                        <div className="flex items-center gap-3">

                            <div className="hidden rounded-2xl border border-white/10 bg-[var(--color-surface)]/10 px-4 py-3 backdrop-blur sm:block">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                    ESTADO
                                </p>

                                <p className="mt-1 text-sm font-black text-white">
                                    ● Sistema
                                    operativo
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    cargarDashboard
                                }
                                disabled={
                                    actualizando
                                }
                                title="Actualizar dashboard"
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-[var(--color-surface)]/10 text-xl font-bold backdrop-blur transition hover:bg-[var(--color-surface)]/20 disabled:cursor-wait disabled:opacity-60"
                            >
                                <span
                                    className={
                                        actualizando
                                            ? "animate-spin"
                                            : ""
                                    }
                                >
                                    ↻
                                </span>
                            </button>

                        </div>

                    </div>

                    <div className="mt-7 flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">

                        <div>
                            <p className="text-sm font-bold">
                                Hola,{" "}
                                {usuario?.nombre ??
                                    "Administrador"}{" "}
                                👋
                            </p>

                            <p className="mt-0.5 text-xs text-white/70">
                                Aquí tienes el
                                estado actual
                                de tu negocio.
                            </p>
                        </div>

                        <span className="w-fit rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
                            ● Datos
                            actualizados
                        </span>

                    </div>

                </div>
            </section>

            {/* =================================================
                KPI PRINCIPALES
            ================================================= */}

            <section>

                <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-primary)]">
                        HOY
                    </p>

                    <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-text)]">
                        Resumen de operación
                    </h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                    {/* Ventas */}
                    <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[var(--color-secondary)] via-[var(--color-primary)] to-[var(--color-primary-hover)] p-5 text-white shadow-xl shadow-[var(--color-secondary)]/20">

                        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--color-surface)]/10 blur-2xl" />

                        <div className="relative">

                            <div className="flex items-start justify-between">

                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                                        Ventas netas
                                    </p>

                                    <p className="mt-3 text-3xl font-black tracking-tight">
                                        {formatearMoneda(
                                            datos.ventasNetas
                                        )}
                                    </p>
                                </div>

                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-surface)]/10 text-xl">
                                    $
                                </span>

                            </div>

                            <div className="mt-5 flex items-center gap-2">

                                <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-black ${variacionPositiva
                                        ? "bg-emerald-400/15 text-emerald-100"
                                        : "bg-red-400/15 text-red-100"
                                        }`}
                                >
                                    {variacionPositiva
                                        ? "↑"
                                        : "↓"}{" "}
                                    {Math.abs(
                                        datos.variacionVentas
                                    ).toFixed(
                                        1
                                    )}
                                    %
                                </span>

                                <span className="text-[11px] text-white/60">
                                    vs. ayer
                                </span>

                            </div>

                        </div>
                    </div>

                    {/* Ventas realizadas */}
                    <Card className="group overflow-hidden border-[var(--color-border)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">

                        <div className="flex items-start justify-between">

                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                    Ventas
                                    realizadas
                                </p>

                                <p className="mt-3 text-3xl font-black tracking-tight text-[var(--color-text)]">
                                    {formatearNumero(
                                        datos.numeroVentas
                                    )}
                                </p>

                                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                    Ticket promedio{" "}
                                    <strong className="text-[var(--color-text)]">
                                        {formatearMoneda(
                                            datos.ticketPromedio
                                        )}
                                    </strong>
                                </p>
                            </div>

                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-xl transition group-hover:scale-105">
                                🧾
                            </span>

                        </div>

                    </Card>

                    {/* Por cobrar */}
                    <Card className="group overflow-hidden border-[var(--color-warning)]/20 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">

                        <div className="flex items-start justify-between">

                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                    Por cobrar
                                </p>

                                <p className="mt-3 text-3xl font-black tracking-tight text-[var(--color-warning)]">
                                    {formatearMoneda(
                                        datos.cuentasPorCobrar
                                    )}
                                </p>

                                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                    Saldos de clientes
                                </p>
                            </div>

                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-warning)]/10 text-xl">
                                💳
                            </span>

                        </div>

                    </Card>
                    {/* Stock */}
                    <Card className="group overflow-hidden border-[var(--color-warning)]/20 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">

                        <div className="flex items-start justify-between">

                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                    Reposición
                                </p>

                                <p className="mt-3 text-3xl font-black tracking-tight text-[var(--color-text)]">
                                    {formatearNumero(
                                        datos.stockBajo
                                    )}
                                </p>

                                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                    Productos en
                                    mínimo o menos
                                </p>
                            </div>

                            <span
                                className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${datos.stockBajo
                                    ? "bg-[var(--color-warning)]/10"
                                    : "bg-[var(--color-success)]/10"
                                    }`}
                            >
                                {datos.stockBajo
                                    ? "⚠️"
                                    : "✓"}
                            </span>

                        </div>

                    </Card>

                </div>
            </section>

            {/* =================================================
                FINANZAS
            ================================================= */}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                <Card className="border-[var(--color-border)] p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Devoluciones
                    </p>

                    <p className="mt-2 text-2xl font-black text-[var(--color-danger)]">
                        -{formatearMoneda(
                            datos.devoluciones
                        )}
                    </p>

                    <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                        Descontadas de ventas
                    </p>
                </Card>

                <Card className="border-[var(--color-border)] p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Cajas abiertas
                    </p>

                    <p className="mt-2 text-2xl font-black text-[var(--color-text)]">
                        {formatearNumero(
                            datos.cajasAbiertas
                        )}
                    </p>

                    <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                        Sesiones activas
                    </p>
                </Card>

                <Card className="border-[var(--color-danger)]/20 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Por pagar
                    </p>

                    <p className="mt-2 text-2xl font-black text-[var(--color-danger)]">
                        {formatearMoneda(
                            datos.cuentasPorPagar
                        )}
                    </p>

                    <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                        Proveedores pendientes
                    </p>
                </Card>

                <Card className="border-[var(--color-warning)]/20 p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Gastos de hoy
                    </p>

                    <p className="mt-2 text-2xl font-black text-[var(--color-warning)]">
                        {formatearMoneda(
                            datos.gastosHoy
                        )}
                    </p>

                    <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                        Gastos registrados
                    </p>
                </Card>

            </section>

            {/* =================================================
                RESULTADO OPERATIVO
            ================================================= */}

            <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[var(--color-secondary)] via-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-xl shadow-[var(--color-secondary)]/20">

                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[var(--color-primary)]/20 blur-3xl" />

                <div className="relative p-6 sm:p-7">

                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
                                RENTABILIDAD
                                DEL DÍA
                            </p>

                            <h2 className="mt-2 text-2xl font-black">
                                Resultado operativo
                            </h2>

                            <p className="mt-2 max-w-xl text-sm text-white/65">
                                Ventas netas −
                                costo de ventas
                                − gastos de hoy.
                            </p>
                        </div>

                        <div className="lg:text-right">

                            <p
                                className={`text-4xl font-black tracking-tight ${datos.resultadoOperativo >=
                                    0
                                    ? "text-emerald-300"
                                    : "text-red-300"
                                    }`}
                            >
                                {formatearMoneda(
                                    datos.resultadoOperativo
                                )}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-white/50">
                                Resultado estimado
                            </p>

                        </div>

                    </div>

                    <div className="mt-7 grid gap-3 md:grid-cols-3">

                        <div className="rounded-2xl border border-white/10 bg-[var(--color-surface)]/5 p-4">
                            <p className="text-xs text-white/50">
                                Ventas netas
                            </p>

                            <p className="mt-2 text-lg font-black">
                                {formatearMoneda(
                                    datos.ventasNetas
                                )}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[var(--color-surface)]/5 p-4">
                            <p className="text-xs text-white/50">
                                Costo de ventas
                                estimado
                            </p>

                            <p className="mt-2 text-lg font-black text-[var(--color-danger)]">
                                -
                                {formatearMoneda(
                                    datos.costoVentas
                                )}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[var(--color-surface)]/5 p-4">
                            <p className="text-xs text-white/50">
                                Gastos de hoy
                            </p>

                            <p className="mt-2 text-lg font-black text-orange-200">
                                -
                                {formatearMoneda(
                                    datos.gastosHoy
                                )}
                            </p>
                        </div>

                    </div>

                </div>
            </section>

            {/* =================================================
                GRÁFICA + PAGOS
            ================================================= */}

            <section className="grid gap-5 xl:grid-cols-3">

                {/* GRÁFICA */}

                <Card className="overflow-hidden border-[var(--color-border)] xl:col-span-2">

                    <div className="border-b border-[var(--color-border)] px-5 py-5 sm:px-7">

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-primary)]">
                                    RENDIMIENTO
                                </p>

                                <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--color-text)]">
                                    Ventas de los
                                    últimos 7 días
                                </h2>

                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    Ventas netas
                                    después de
                                    devoluciones.
                                </p>
                            </div>

                            {ventaSeleccionada && (
                                <div className="rounded-2xl bg-[var(--color-primary)]/10 px-4 py-3 text-left sm:text-right">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-primary-hover)]">
                                        {ventaSeleccionada.fecha}
                                    </p>

                                    <p className="mt-1 text-lg font-black text-[var(--color-secondary)]">
                                        {formatearMoneda(
                                            valorVentaSeleccionada
                                        )}
                                    </p>
                                </div>
                            )}

                        </div>
                    </div>

                    <div className="p-4 sm:p-7">

                        {ventasSemana.length ? (
                            <>
                                <div className="overflow-x-auto">

                                    <svg
                                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                                        className="min-w-[620px] overflow-visible"
                                    >

                                        <defs>

                                            <linearGradient
                                                id="ventasAreaGradient"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="0%"
                                                    stopColor="var(--color-primary)"
                                                    stopOpacity="0.32"
                                                />

                                                <stop
                                                    offset="55%"
                                                    stopColor="var(--color-primary-hover)"
                                                    stopOpacity="0.12"
                                                />

                                                <stop
                                                    offset="100%"
                                                    stopColor="var(--color-primary-hover)"
                                                    stopOpacity="0"
                                                />
                                            </linearGradient>

                                            <linearGradient
                                                id="ventasLineGradient"
                                                x1="0"
                                                y1="0"
                                                x2="1"
                                                y2="0"
                                            >
                                                <stop
                                                    offset="0%"
                                                    stopColor="var(--color-secondary)"
                                                />

                                                <stop
                                                    offset="50%"
                                                    stopColor="var(--color-primary)"
                                                />

                                                <stop
                                                    offset="100%"
                                                    stopColor="var(--color-primary-hover)"
                                                />
                                            </linearGradient>

                                            <filter
                                                id="lineShadow"
                                                x="-20%"
                                                y="-20%"
                                                width="140%"
                                                height="160%"
                                            >
                                                <feDropShadow
                                                    dx="0"
                                                    dy="5"
                                                    stdDeviation="5"
                                                    floodColor="var(--color-primary)"
                                                    floodOpacity="0.22"
                                                />
                                            </filter>
                                        </defs>

                                        {/* Líneas de referencia */}

                                        {[0, 1, 2, 3].map(
                                            (
                                                fila
                                            ) => {
                                                const y =
                                                    chartTop +
                                                    (fila /
                                                        3) *
                                                    chartInnerHeight;

                                                const valor =
                                                    maxVentaSemana -
                                                    (maxVentaSemana /
                                                        3) *
                                                    fila;

                                                return (
                                                    <g
                                                        key={
                                                            fila
                                                        }
                                                    >
                                                        <line
                                                            x1={
                                                                chartLeft
                                                            }
                                                            x2={
                                                                chartRight
                                                            }
                                                            y1={
                                                                y
                                                            }
                                                            y2={
                                                                y
                                                            }
                                                            stroke="var(--color-border)"
                                                            strokeWidth="1"
                                                            strokeDasharray="5 7"
                                                        />

                                                        <text
                                                            x="4"
                                                            y={
                                                                y +
                                                                4
                                                            }
                                                            fontSize="10"
                                                            fontWeight="600"
                                                            fill="var(--color-text-secondary)"
                                                        >
                                                            {formatearMoneda(
                                                                valor
                                                            )}
                                                        </text>
                                                    </g>
                                                );
                                            }
                                        )}

                                        {/* Área */}

                                        <polygon
                                            points={
                                                areaGrafica
                                            }
                                            fill="url(#ventasAreaGradient)"
                                        />

                                        {/* Línea principal */}

                                        <polyline
                                            points={
                                                lineaGrafica
                                            }
                                            fill="none"
                                            stroke="url(#ventasLineGradient)"
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            filter="url(#lineShadow)"
                                        />

                                        {/* Puntos */}

                                        {puntosGrafica.map(
                                            (
                                                punto,
                                                index
                                            ) => {
                                                const activo =
                                                    puntoGrafica ===
                                                    index;

                                                return (
                                                    <g
                                                        key={
                                                            index
                                                        }
                                                    >

                                                        {/* Zona táctil */}

                                                        <circle
                                                            cx={
                                                                punto.x
                                                            }
                                                            cy={
                                                                punto.y
                                                            }
                                                            r="24"
                                                            fill="transparent"
                                                            className="cursor-pointer"
                                                            onMouseEnter={() =>
                                                                setPuntoActivo(
                                                                    index
                                                                )
                                                            }
                                                            onMouseLeave={() =>
                                                                setPuntoActivo(
                                                                    null
                                                                )
                                                            }
                                                            onClick={() =>
                                                                setPuntoSeleccionado(
                                                                    puntoSeleccionado ===
                                                                        index
                                                                        ? null
                                                                        : index
                                                                )
                                                            }
                                                        />

                                                        {activo && (
                                                            <line
                                                                x1={
                                                                    punto.x
                                                                }
                                                                x2={
                                                                    punto.x
                                                                }
                                                                y1={
                                                                    chartTop
                                                                }
                                                                y2={
                                                                    chartBottom
                                                                }
                                                                stroke="var(--color-primary-hover)"
                                                                strokeWidth="1"
                                                                strokeDasharray="4 6"
                                                            />
                                                        )}

                                                        <circle
                                                            cx={
                                                                punto.x
                                                            }
                                                            cy={
                                                                punto.y
                                                            }
                                                            r={
                                                                activo
                                                                    ? 9
                                                                    : 6
                                                            }
                                                            fill="white"
                                                            stroke={
                                                                activo
                                                                    ? "var(--color-secondary)"
                                                                    : "var(--color-primary)"
                                                            }
                                                            strokeWidth={
                                                                activo
                                                                    ? 4
                                                                    : 3
                                                            }
                                                            className="cursor-pointer transition-all"
                                                        />

                                                        <text
                                                            x={
                                                                punto.x
                                                            }
                                                            y="284"
                                                            textAnchor="middle"
                                                            fontSize="11"
                                                            fontWeight={
                                                                activo
                                                                    ? "800"
                                                                    : "600"
                                                            }
                                                            fill={
                                                                activo
                                                                    ? "var(--color-secondary)"
                                                                    : "var(--color-text-secondary)"
                                                            }
                                                        >
                                                            {
                                                                punto.venta
                                                                    .fecha
                                                            }
                                                        </text>

                                                        {activo && (
                                                            <g pointerEvents="none">

                                                                <rect
                                                                    x={Math.min(
                                                                        Math.max(
                                                                            punto.x -
                                                                            75,
                                                                            55
                                                                        ),
                                                                        525
                                                                    )}
                                                                    y={Math.max(
                                                                        punto.y -
                                                                        70,
                                                                        8
                                                                    )}
                                                                    width="150"
                                                                    height="55"
                                                                    rx="14"
                                                                    fill="var(--color-secondary)"
                                                                    opacity="0.98"
                                                                />

                                                                <text
                                                                    x={Math.min(
                                                                        Math.max(
                                                                            punto.x -
                                                                            60,
                                                                            70
                                                                        ),
                                                                        540
                                                                    )}
                                                                    y={Math.max(
                                                                        punto.y -
                                                                        45,
                                                                        31
                                                                    )}
                                                                    fontSize="10"
                                                                    fontWeight="700"
                                                                    fill="var(--color-primary-hover)"
                                                                >
                                                                    {
                                                                        punto.venta
                                                                            .fecha
                                                                    }
                                                                </text>

                                                                <text
                                                                    x={Math.min(
                                                                        Math.max(
                                                                            punto.x -
                                                                            60,
                                                                            70
                                                                        ),
                                                                        540
                                                                    )}
                                                                    y={Math.max(
                                                                        punto.y -
                                                                        23,
                                                                        53
                                                                    )}
                                                                    fontSize="14"
                                                                    fontWeight="900"
                                                                    fill="white"
                                                                >
                                                                    {formatearMoneda(
                                                                        punto.venta
                                                                            .total
                                                                    )}
                                                                </text>

                                                            </g>
                                                        )}

                                                    </g>
                                                );
                                            }
                                        )}

                                    </svg>

                                </div>

                                <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-4">

                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />

                                        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                            Ventas
                                            netas
                                        </span>
                                    </div>

                                    <p className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                        Máximo{" "}
                                        {formatearMoneda(
                                            maxVentaSemana
                                        )}
                                    </p>

                                </div>
                            </>
                        ) : (
                            <div className="flex h-[300px] items-center justify-center text-center">
                                <div>
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-2xl">
                                        📈
                                    </div>

                                    <p className="mt-4 text-sm font-bold text-[var(--color-text)]">
                                        Sin datos
                                        suficientes
                                    </p>

                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                        Todavía no hay
                                        ventas para
                                        mostrar.
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>
                </Card>

                {/* MÉTODOS DE PAGO */}

                <Card className="overflow-hidden border-[var(--color-border)]">

                    <div className="border-b border-[var(--color-border)] px-5 py-5">

                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-primary)]">
                            COBROS
                        </p>

                        <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--color-text)]">
                            Métodos de pago
                        </h2>

                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Distribución
                            registrada hoy.
                        </p>

                    </div>

                    <div className="p-5">

                        <div className="relative mx-auto h-56 w-56">

                            <svg
                                viewBox="0 0 200 200"
                                className="h-full w-full -rotate-90"
                            >

                                <circle
                                    cx="100"
                                    cy="100"
                                    r="72"
                                    fill="none"
                                    stroke="var(--color-border)"
                                    strokeWidth="20"
                                />

                                {totalPagos >
                                    0 &&
                                    (() => {
                                        const colores =
                                            [
                                                "var(--color-secondary)",
                                                "var(--color-primary)",
                                                "var(--color-primary-hover)",
                                                "var(--color-primary)",
                                            ];

                                        const radio =
                                            72;

                                        const circ =
                                            2 *
                                            Math.PI *
                                            radio;

                                        let acumulado = 0;

                                        return metodosPago.map(
                                            (
                                                metodo,
                                                index
                                            ) => {
                                                const longitud =
                                                    (metodo.porcentaje /
                                                        100) *
                                                    circ;

                                                const offset =
                                                    acumulado;

                                                acumulado +=
                                                    longitud;

                                                const metodoEnfocado =
                                                    metodoPagoActivo ??
                                                    metodoPagoSeleccionado;

                                                const activo =
                                                    metodoEnfocado === null ||
                                                    metodo.nombre === metodoEnfocado;

                                                return (
                                                    <circle
                                                        key={
                                                            metodo.nombre
                                                        }
                                                        cx="100"
                                                        cy="100"
                                                        r={
                                                            radio
                                                        }
                                                        fill="none"
                                                        stroke={
                                                            colores[
                                                            index
                                                            ]
                                                        }
                                                        strokeWidth="22"
                                                        strokeDasharray={`${longitud} ${circ - longitud}`}
                                                        strokeDashoffset={
                                                            -offset
                                                        }
                                                        strokeLinecap="round"
                                                        opacity={
                                                            activo
                                                                ? 1
                                                                : 0.25
                                                        }
                                                    />
                                                );
                                            }
                                        );
                                    })()}

                            </svg>

                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">

                                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-secondary)]">
                                    Total
                                </span>

                                <span className="mt-1 text-2xl font-black tracking-tight text-[var(--color-text)]">
                                    {formatearMoneda(
                                        totalPagos
                                    )}
                                </span>

                                <span className="mt-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                                    pagos registrados
                                </span>

                            </div>
                        </div>

                        <div className="mt-5 space-y-2">

                            {metodosPago.map(
                                (
                                    metodo,
                                    index
                                ) => {
                                    const colores =
                                        [
                                            "bg-[var(--color-secondary)]",
                                            "bg-[var(--color-primary)]",
                                            "bg-[var(--color-primary-hover)]",
                                            "bg-[var(--color-primary-hover)]",
                                        ];

                                    return (
                                        <div
                                            key={
                                                metodo.nombre
                                            }
                                            className={`cursor-pointer rounded-xl p-2.5 transition hover:bg-[var(--color-primary)]/10 ${metodoPagoSeleccionado === metodo.nombre
                                                ? "bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/20"
                                                : ""
                                                }`}
                                            onMouseEnter={() =>
                                                setMetodoPagoActivo(metodo.nombre)
                                            }
                                            onMouseLeave={() =>
                                                setMetodoPagoActivo(null)
                                            }
                                            onClick={() =>
                                                setMetodoPagoSeleccionado(
                                                    metodoPagoSeleccionado === metodo.nombre
                                                        ? null
                                                        : metodo.nombre
                                                )
                                            }
                                        >

                                            <div className="flex items-center justify-between">

                                                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">

                                                    <span
                                                        className={`h-2.5 w-2.5 rounded-full ${colores[index]}`}
                                                    />

                                                    {
                                                        metodo.nombre
                                                    }

                                                </span>

                                                <span className="text-sm font-black text-[var(--color-text)]">
                                                    {formatearMoneda(
                                                        metodo.valor
                                                    )}
                                                </span>

                                            </div>

                                            <div className="mt-2 flex items-center gap-2">

                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-background)]">

                                                    <div
                                                        className={`h-full rounded-full ${colores[index]} transition-all`}
                                                        style={{
                                                            width: `${metodo.porcentaje}%`,
                                                        }}
                                                    />

                                                </div>

                                                <span className="w-11 text-right text-[10px] font-black text-[var(--color-text-secondary)]">
                                                    {metodo.porcentaje.toFixed(
                                                        1
                                                    )}
                                                    %
                                                </span>

                                            </div>

                                        </div>
                                    );
                                }
                            )}

                        </div>

                    </div>
                </Card>

            </section>

            {/* =================================================
                PRODUCTOS + INVENTARIO
            ================================================= */}

            <section className="grid gap-5 lg:grid-cols-2">

                <Card className="overflow-hidden border-[var(--color-border)]">

                    <div className="border-b border-[var(--color-border)] px-5 py-5">

                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-primary)]">
                            PRODUCTOS
                        </p>

                        <h2 className="mt-1 text-xl font-black text-[var(--color-text)]">
                            Más vendidos hoy
                        </h2>

                    </div>

                    {productosTop.length >
                        0 ? (
                        <div className="divide-y divide-[var(--color-border)]">

                            {productosTop.map(
                                (
                                    producto,
                                    index
                                ) => (
                                    <div
                                        key={
                                            producto.id
                                        }
                                        className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--color-primary)]/10"
                                    >

                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary-hover)] text-sm font-black text-white shadow-md shadow-[var(--color-secondary)]/10">
                                            {index +
                                                1}
                                        </span>

                                        <div className="min-w-0 flex-1">

                                            <p className="truncate text-sm font-bold text-[var(--color-text)]">
                                                {
                                                    producto.nombre
                                                }
                                            </p>

                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                {formatearNumero(
                                                    producto.cantidad
                                                )}{" "}
                                                unidades
                                                vendidas
                                            </p>

                                        </div>

                                        <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-[11px] font-black text-[var(--color-primary)]">
                                            Top{" "}
                                            {index +
                                                1}
                                        </span>

                                    </div>
                                )
                            )}

                        </div>
                    ) : (
                        <div className="px-5 py-12 text-center text-sm text-[var(--color-text-secondary)]">
                            No hay ventas de
                            productos
                            todavía.
                        </div>
                    )}

                </Card>

                <Card className="overflow-hidden border-[var(--color-warning)]/20">

                    <div className="border-b border-[var(--color-border)] px-5 py-5">

                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-warning)]">
                            INVENTARIO
                        </p>

                        <h2 className="mt-1 text-xl font-black text-[var(--color-text)]">
                            Requieren reposición
                        </h2>

                    </div>

                    {productosStockBajo.length >
                        0 ? (
                        <div className="divide-y divide-[var(--color-border)]">

                            {productosStockBajo.map(
                                (
                                    producto
                                ) => (
                                    <div
                                        key={
                                            producto.id
                                        }
                                        className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--color-warning)]/10/40"
                                    >

                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-warning)]/10 text-lg">
                                            ⚠️
                                        </span>

                                        <div className="min-w-0 flex-1">

                                            <p className="truncate text-sm font-bold text-[var(--color-text)]">
                                                {
                                                    producto.nombre
                                                }
                                            </p>

                                            <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                                                {
                                                    producto.sucursal
                                                }{" "}
                                                · mínimo{" "}
                                                {
                                                    producto.stock_minimo
                                                }
                                            </p>

                                        </div>

                                        <div className="text-right">

                                            <p className="text-xl font-black text-[var(--color-warning)]">
                                                {
                                                    producto.stock
                                                }
                                            </p>

                                            <p className="text-[10px] font-semibold text-[var(--color-text-secondary)]">
                                                disponibles
                                            </p>

                                        </div>

                                    </div>
                                )
                            )}

                        </div>
                    ) : (
                        <div className="px-5 py-12 text-center">

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-success)]/10 text-2xl text-[var(--color-success)]">
                                ✓
                            </div>

                            <p className="mt-4 text-sm font-black text-[var(--color-success)]">
                                Inventario en
                                buen estado
                            </p>

                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                No hay productos
                                en o por debajo
                                del mínimo.
                            </p>

                        </div>
                    )}

                </Card>

            </section>

            {/* =================================================
                CLIENTES + SUCURSALES
            ================================================= */}

            <section className="grid gap-5 lg:grid-cols-2">

                <Card className="overflow-hidden border-[var(--color-warning)]/20">

                    <div className="border-b border-[var(--color-border)] px-5 py-5">

                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-warning)]">
                            CLIENTES
                        </p>

                        <h2 className="mt-1 text-xl font-black text-[var(--color-text)]">
                            Saldos pendientes
                        </h2>

                    </div>

                    {clientesSaldo.length >
                        0 ? (
                        <div className="divide-y divide-[var(--color-border)]">

                            {clientesSaldo.map(
                                (
                                    cliente
                                ) => (
                                    <div
                                        key={
                                            cliente.id
                                        }
                                        className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--color-warning)]/10/40"
                                    >

                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning)]/10 text-lg">
                                            👤
                                        </span>

                                        <div className="min-w-0 flex-1">

                                            <p className="truncate text-sm font-bold text-[var(--color-text)]">
                                                {
                                                    cliente.nombre
                                                }
                                            </p>

                                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                                Saldo
                                                pendiente
                                            </p>

                                        </div>

                                        <span className="text-sm font-black text-[var(--color-warning)]">
                                            {formatearMoneda(
                                                cliente.saldo
                                            )}
                                        </span>

                                    </div>
                                )
                            )}

                        </div>
                    ) : (
                        <div className="px-5 py-12 text-center text-sm text-[var(--color-text-secondary)]">
                            No hay clientes
                            con saldo
                            pendiente.
                        </div>
                    )}

                </Card>

                <Card className="overflow-hidden border-[var(--color-border)]">

                    <div className="border-b border-[var(--color-border)] px-5 py-5">

                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-primary)]">
                            SUCURSALES
                        </p>

                        <h2 className="mt-1 text-xl font-black text-[var(--color-text)]">
                            Ventas netas de hoy
                        </h2>

                    </div>

                    {sucursalesResumen.length >
                        0 ? (
                        <div className="space-y-5 px-5 py-6">

                            {sucursalesResumen.map(
                                (
                                    sucursal
                                ) => (
                                    <div
                                        key={
                                            sucursal.id
                                        }
                                    >

                                        <div className="mb-2 flex items-center justify-between gap-4">

                                            <span className="truncate text-sm font-bold text-[var(--color-text)]">
                                                {
                                                    sucursal.nombre
                                                }
                                            </span>

                                            <span className="shrink-0 text-sm font-black text-[var(--color-text)]">
                                                {formatearMoneda(
                                                    sucursal.ventas
                                                )}
                                            </span>

                                        </div>

                                        <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-primary)]/10">

                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-[var(--color-secondary)] via-[var(--color-primary)] to-[var(--color-primary-hover)] transition-all duration-700"
                                                style={{
                                                    width: `${Math.min(
                                                        100,
                                                        (sucursal.ventas /
                                                            maxSucursal) *
                                                        100
                                                    )}%`,
                                                }}
                                            />

                                        </div>

                                    </div>
                                )
                            )}

                        </div>
                    ) : (
                        <div className="px-5 py-12 text-center text-sm text-[var(--color-text-secondary)]">
                            No hay sucursales
                            activas.
                        </div>
                    )}

                </Card>

            </section>

            {/* =================================================
                ACTIVIDAD
            ================================================= */}

            <Card className="overflow-hidden border-[var(--color-border)]">

                <div className="border-b border-[var(--color-border)] px-5 py-5">

                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-primary)]">
                        ACTIVIDAD
                    </p>

                    <h2 className="mt-1 text-xl font-black text-[var(--color-text)]">
                        Actividad reciente
                    </h2>

                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Últimas operaciones
                        registradas hoy.
                    </p>

                </div>

                {actividadReciente.length >
                    0 ? (
                    <div className="divide-y divide-[var(--color-border)]">

                        {actividadReciente.map(
                            (actividad) => {
                                const esVenta =
                                    actividad.tipo ===
                                    "venta";

                                return (
                                    <div
                                        key={
                                            actividad.id
                                        }
                                        className="px-5 py-5 transition hover:bg-[var(--color-primary)]/10 sm:px-6"
                                    >

                                        <div className="flex gap-4">

                                            <div
                                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${esVenta
                                                    ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                                                    : "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                                                    }`}
                                            >
                                                {esVenta
                                                    ? "🧾"
                                                    : "↩️"}
                                            </div>

                                            <div className="min-w-0 flex-1">

                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                                                    <div className="min-w-0">

                                                        <div className="flex flex-wrap items-center gap-2">

                                                            <h3 className="text-sm font-black text-[var(--color-text)]">
                                                                {esVenta
                                                                    ? "Venta registrada"
                                                                    : "Devolución registrada"}
                                                            </h3>

                                                            {actividad.folio !=
                                                                null && (
                                                                    <span className="rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1 text-[10px] font-black text-[var(--color-primary)]">
                                                                        Venta
                                                                        #
                                                                        {
                                                                            actividad.folio
                                                                        }
                                                                    </span>
                                                                )}

                                                        </div>

                                                        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">

                                                            {actividad.productos.length >
                                                                0
                                                                ? actividad.productos
                                                                    .slice(
                                                                        0,
                                                                        3
                                                                    )
                                                                    .map(
                                                                        (
                                                                            producto,
                                                                            index
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    index
                                                                                }
                                                                            >
                                                                                {index >
                                                                                    0 &&
                                                                                    " · "}
                                                                                {
                                                                                    producto.nombre
                                                                                }{" "}
                                                                                ×{" "}
                                                                                {
                                                                                    producto.cantidad
                                                                                }
                                                                            </span>
                                                                        )
                                                                    )
                                                                : "Información de productos no disponible."}

                                                        </p>

                                                        {(actividad.cliente ||
                                                            actividad.sucursal) && (
                                                                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--color-text-secondary)]">

                                                                    {actividad.cliente && (
                                                                        <span>
                                                                            👤{" "}
                                                                            {
                                                                                actividad.cliente
                                                                            }
                                                                        </span>
                                                                    )}

                                                                    {actividad.sucursal && (
                                                                        <span>
                                                                            🏪{" "}
                                                                            {
                                                                                actividad.sucursal
                                                                            }
                                                                        </span>
                                                                    )}

                                                                </div>
                                                            )}

                                                    </div>

                                                    <div className="shrink-0 sm:text-right">

                                                        <p
                                                            className={`text-lg font-black ${esVenta
                                                                ? "text-[var(--color-success)]"
                                                                : "text-[var(--color-danger)]"
                                                                }`}
                                                        >
                                                            {esVenta
                                                                ? ""
                                                                : "-"}
                                                            {formatearMoneda(
                                                                actividad.monto
                                                            )}
                                                        </p>

                                                        <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                                                            {formatearHora(
                                                                actividad.fecha
                                                            )}
                                                        </p>

                                                    </div>

                                                </div>

                                                <div className="mt-3 flex flex-wrap gap-2">

                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-[10px] font-black ${esVenta
                                                            ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                                                            : "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                                                            }`}
                                                    >
                                                        {esVenta
                                                            ? "Venta"
                                                            : "Devolución"}
                                                    </span>

                                                    <span className="rounded-full bg-[var(--color-background)] px-2.5 py-1 text-[10px] font-black text-[var(--color-text-secondary)]">
                                                        {esVenta
                                                            ? obtenerMetodoPago(
                                                                actividad.metodo
                                                            )
                                                            : `Reembolso: ${obtenerMetodoPago(
                                                                actividad.metodo
                                                            )}`}
                                                    </span>

                                                    <span className="rounded-full bg-[var(--color-background)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                                                        {formatearFechaCorta(
                                                            actividad.fecha
                                                        )}
                                                    </span>

                                                </div>

                                            </div>

                                        </div>

                                    </div>
                                );
                            }
                        )}

                    </div>
                ) : (
                    <div className="px-5 py-12 text-center text-sm text-[var(--color-text-secondary)]">
                        Sin actividad
                        registrada hoy.
                    </div>
                )}

            </Card>

            {/* =================================================
                ATENCIÓN REQUERIDA
            ================================================= */}

            <Card className="overflow-hidden border-[var(--color-border)]">

                <div className="border-b border-[var(--color-border)] px-5 py-5">

                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--color-primary)]">
                        ATENCIÓN REQUERIDA
                    </p>

                    <h2 className="mt-1 text-xl font-black text-[var(--color-text)]">
                        Pendientes importantes
                    </h2>

                </div>

                <div className="grid gap-3 p-5 md:grid-cols-3">

                    <div
                        className={`rounded-2xl border p-4 ${datos.stockBajo
                            ? "border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10"
                            : "border-[var(--color-success)]/20 bg-[var(--color-success)]/10"
                            }`}
                    >

                        <div className="flex items-center justify-between gap-3">

                            <p className="text-sm font-black text-[var(--color-text)]">
                                {datos.stockBajo
                                    ? "Revisar inventario"
                                    : "Inventario correcto"}
                            </p>

                            <span>
                                {datos.stockBajo
                                    ? "⚠️"
                                    : "✓"}
                            </span>

                        </div>

                        <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                            {datos.stockBajo
                                ? `${datos.stockBajo} producto${datos.stockBajo ===
                                    1
                                    ? ""
                                    : "s"
                                } en nivel de reposición.`
                                : "No hay productos en o por debajo del mínimo."}
                        </p>

                    </div>

                    <div
                        className={`rounded-2xl border p-4 ${datos.cuentasPorCobrar >
                            0
                            ? "border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10"
                            : "border-[var(--color-success)]/20 bg-[var(--color-success)]/10"
                            }`}
                    >

                        <div className="flex items-center justify-between gap-3">

                            <p className="text-sm font-black text-[var(--color-text)]">
                                {datos.cuentasPorCobrar >
                                    0
                                    ? "Cuentas por cobrar"
                                    : "Sin saldos pendientes"}
                            </p>

                            <span>
                                {datos.cuentasPorCobrar >
                                    0
                                    ? "💳"
                                    : "✓"}
                            </span>

                        </div>

                        <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                            {datos.cuentasPorCobrar >
                                0
                                ? formatearMoneda(
                                    datos.cuentasPorCobrar
                                )
                                : "Todos los clientes están al corriente."}
                        </p>

                    </div>

                    <div
                        className={`rounded-2xl border p-4 ${datos.cuentasPorPagar >
                            0
                            ? "border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10"
                            : "border-[var(--color-success)]/20 bg-[var(--color-success)]/10"
                            }`}
                    >

                        <div className="flex items-center justify-between gap-3">

                            <p className="text-sm font-black text-[var(--color-text)]">
                                {datos.cuentasPorPagar >
                                    0
                                    ? "Cuentas por pagar"
                                    : "Sin cuentas pendientes"}
                            </p>

                            <span>
                                {datos.cuentasPorPagar >
                                    0
                                    ? "📄"
                                    : "✓"}
                            </span>

                        </div>

                        <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                            {datos.cuentasPorPagar >
                                0
                                ? formatearMoneda(
                                    datos.cuentasPorPagar
                                )
                                : "No hay saldos pendientes con proveedores."}
                        </p>

                    </div>

                </div>
            </Card>

            <ModalMensaje
                abierto={modalMensajeAbierto}
                tipo={tipoMensaje}
                titulo={tituloMensaje}
                mensaje={textoMensaje}
                textoBoton="Aceptar"
                onCerrar={cerrarModalMensaje}
            />

        </div>
    );
}
