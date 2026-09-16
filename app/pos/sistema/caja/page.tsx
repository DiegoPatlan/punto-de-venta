"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

import { obtenerUsuarioPOS } from "../../../../lib/usuarioPOS";
import { supabasePOS } from "../../../../lib/supabase";

// ============================================================
// CLIENTE PARA AUTORIZACIÓN
// ============================================================

const supabaseAutorizacion = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    }
);

// ============================================================
// TIPOS
// ============================================================

interface UsuarioActual {
    id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
}

interface Caja {
    id: string;
    sucursal_id: string;
    nombre: string;
    activo: boolean;
    sucursal_nombre: string;
}

interface SesionCaja {
    id: string;
    caja_id: string;
    usuario_apertura_id: string;
    monto_inicial: number;
    monto_esperado: number | null;
    monto_real: number | null;
    diferencia: number | null;
    estado: string;
    fecha_apertura: string;
    fecha_cierre: string | null;
}

interface MovimientoReal {
    id: string;
    sesion_caja_id: string;
    usuario_id: string;
    tipo: string;
    concepto: string | null;
    monto: number;
    referencia_id: string | null;
    created_at: string;
    usuario_autorizacion_id?: string | null;
    usuario_autorizador_id?: string | null;
}

interface PagoProveedorCaja {
    id: string;
    proveedor_id: string;
    proveedor: {
        nombre: string;
    } | null;
}

interface AbonoClienteCaja {
    id: string;
    cliente_id: string;
    cliente: {
        nombre: string;
    } | null;
}

interface GastoCaja {
    id: string;
    concepto: string | null;
    referencia: string | null;
    notas: string | null;
}

interface VentaCaja {
    id: string;
    folio: number | null;
    sesion_caja_id: string | null;
    estado: string;
    created_at: string;
}

interface PagoCaja {
    id: string;
    venta_id: string;
    metodo_pago: string;
    monto: number;
    monto_recibido: number | null;
    cambio: number | null;
    referencia: string | null;
    created_at: string;
}

interface DetalleVentaCaja {
    id: string;
    venta_id: string;
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    descuento: number;
    impuesto: number;
    subtotal: number;
    total: number;
    created_at: string;
}

interface ProductoCaja {
    id: string;
    nombre: string;
}

interface DevolucionCaja {
    id: string;
    venta_id: string;
    sesion_caja_id: string;
    monto_total: number;
    motivo: string | null;
    estado: string;
    created_at: string;
    metodo_reembolso: string | null;
}

interface DetalleDevolucionCaja {
    id: string;
    devolucion_id: string;
    producto_id: string;
    cantidad: number;
    motivo?: string | null;
}

interface DetalleReembolsoCaja {
    id: string;
    devolucion_id: string;
    metodo_pago: string;
    monto: number;
    referencia: string | null;
    created_at: string;
}

interface MovimientoVisual {
    id: string;
    tipo: "entrada" | "salida" | "venta" | "devolucion";
    concepto: string;
    monto: number;
    created_at: string;
    referencia_id: string | null;
    venta_id: string | null;
    folio: number | null;
    metodo_pago: string | null;
    metodo_reembolso: string | null;
    afecta_efectivo: boolean;
    devolucion_id?: string | null;
    motivo_devolucion?: string | null;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function CajaPage() {
    const router = useRouter();

    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [sesion, setSesion] =
        useState<SesionCaja | null>(null);

    const [caja, setCaja] =
        useState<Caja | null>(null);

    const [movimientos, setMovimientos] =
        useState<MovimientoVisual[]>([]);

    const [ventasEfectivo, setVentasEfectivo] =
        useState(0);

    const [devolucionesEfectivo, setDevolucionesEfectivo] =
        useState(0);

    const [cargando, setCargando] =
        useState(true);

    const [error, setError] =
        useState("");

    // ========================================================
    // BUSCADOR / FILTROS
    // ========================================================

    const [busqueda, setBusqueda] =
        useState("");

    const [filtro, setFiltro] = useState<
        "todos" |
        "ventas" |
        "devoluciones" |
        "entradas" |
        "retiros"
    >("todos");

    // ========================================================
    // MODAL MOVIMIENTO
    // ========================================================

    const [modalMovimiento, setModalMovimiento] =
        useState<
            "entrada" |
            "retiro" |
            null
        >(null);

    const [montoMovimiento, setMontoMovimiento] =
        useState("");

    const [conceptoMovimiento, setConceptoMovimiento] =
        useState("");

    const [guardandoMovimiento, setGuardandoMovimiento] =
        useState(false);

    const [errorMovimiento, setErrorMovimiento] =
        useState("");

    // ========================================================
    // MODAL AUTORIZACIÓN
    // ========================================================

    const [modalAutorizacion, setModalAutorizacion] =
        useState(false);

    const [correoAutorizacion, setCorreoAutorizacion] =
        useState("");

    const [passwordAutorizacion, setPasswordAutorizacion] =
        useState("");

    const [autorizandoMovimiento, setAutorizandoMovimiento] =
        useState(false);

    const [errorAutorizacion, setErrorAutorizacion] =
        useState("");

    // ========================================================
    // CARGAR
    // ========================================================

    useEffect(() => {
        cargarCaja();
    }, []);

    // ========================================================
    // CARGAR CAJA
    // ========================================================

    async function cargarCaja() {
        try {
            setCargando(true);
            setError("");

            const usuarioActual =
                (await obtenerUsuarioPOS()) as
                | UsuarioActual
                | null;

            if (
                !usuarioActual?.id ||
                !usuarioActual.negocio_id
            ) {
                router.replace("/pos/login");
                return;
            }

            setUsuario(usuarioActual);

            const {
                data: sesionData,
                error: errorSesion,
            } = await supabasePOS
                .from("sesiones_caja")
                .select(`
id,
    caja_id,
    usuario_apertura_id,
    monto_inicial,
    monto_esperado,
    monto_real,
    diferencia,
    estado,
    fecha_apertura,
    fecha_cierre
        `)
                .eq(
                    "usuario_apertura_id",
                    usuarioActual.id
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

            if (errorSesion) {
                console.error(errorSesion);
                setError(
                    "No se pudo consultar la sesión de caja."
                );
                return;
            }

            if (!sesionData) {
                setError(
                    "No tienes una caja abierta actualmente."
                );
                return;
            }

            const sesionActual =
                sesionData as SesionCaja;

            setSesion(sesionActual);

            const {
                data: cajaData,
                error: errorCaja,
            } = await supabasePOS
                .from("cajas")
                .select(`
id,
    sucursal_id,
    nombre,
    activo,
    sucursal: sucursales(nombre)
        `)
                .eq(
                    "id",
                    sesionActual.caja_id
                )
                .maybeSingle();

            if (errorCaja) {
                console.error(errorCaja);
                setError(
                    "No se pudo obtener la información de la caja."
                );
                return;
            }

            if (!cajaData) {
                setError(
                    "No se encontró la caja."
                );
                return;
            }

            const sucursal =
                Array.isArray(cajaData.sucursal)
                    ? cajaData.sucursal[0]
                    : cajaData.sucursal;

            setCaja({
                id: cajaData.id,
                sucursal_id:
                    cajaData.sucursal_id,
                nombre: cajaData.nombre,
                activo: cajaData.activo,
                sucursal_nombre:
                    sucursal?.nombre ??
                    "Sucursal",
            });

            await cargarMovimientos(
                sesionActual.id
            );
        } catch (e) {
            console.error(e);
            setError(
                "Ocurrió un error al cargar la caja."
            );
        } finally {
            setCargando(false);
        }
    }

    // ============================================================
    // NORMALIZADORES
    // ============================================================

    function normalizarMetodo(valor: unknown): string {
        const texto = String(valor ?? "")
            .trim()
            .toLowerCase();

        if (
            texto === "efectivo" ||
            texto === "cash"
        ) {
            return "efectivo";
        }

        if (
            texto === "tarjeta" ||
            texto === "débito" ||
            texto === "debito"
        ) {
            return "tarjeta";
        }

        if (
            texto === "transferencia" ||
            texto === "transfer"
        ) {
            return "transferencia";
        }

        if (
            texto === "crédito" ||
            texto === "credito"
        ) {
            return "credito";
        }

        if (texto === "mixto") {
            return "mixto";
        }

        return texto;
    }

    function nombreMetodo(
        metodo: string | null | undefined
    ) {
        const valor =
            normalizarMetodo(metodo);

        if (valor === "efectivo")
            return "Efectivo";

        if (valor === "tarjeta")
            return "Tarjeta";

        if (valor === "transferencia")
            return "Transferencia";

        if (valor === "credito")
            return "Crédito";

        if (valor === "mixto")
            return "Mixto";

        if (valor) {
            return (
                valor.charAt(0).toUpperCase() +
                valor.slice(1)
            );
        }

        return "Otro";
    }

    function formatearMoneda(
        monto: number
    ): string {
        return Number(
            monto ?? 0
        ).toLocaleString(
            "es-MX",
            {
                style: "currency",
                currency: "MXN",
            }
        );
    }

    // ============================================================
    // DESGLOSE DE PAGOS
    // ============================================================

    function obtenerDesglosePagos(
        pagos: PagoCaja[]
    ) {
        const efectivo =
            pagos
                .filter(
                    (p) =>
                        normalizarMetodo(
                            p.metodo_pago
                        ) === "efectivo"
                )
                .reduce(
                    (sum, p) =>
                        sum +
                        Number(
                            p.monto ?? 0
                        ),
                    0
                );

        const tarjeta =
            pagos
                .filter(
                    (p) =>
                        normalizarMetodo(
                            p.metodo_pago
                        ) === "tarjeta"
                )
                .reduce(
                    (sum, p) =>
                        sum +
                        Number(
                            p.monto ?? 0
                        ),
                    0
                );

        const transferencia =
            pagos
                .filter(
                    (p) =>
                        normalizarMetodo(
                            p.metodo_pago
                        ) === "transferencia"
                )
                .reduce(
                    (sum, p) =>
                        sum +
                        Number(
                            p.monto ?? 0
                        ),
                    0
                );

        const credito =
            pagos
                .filter(
                    (p) =>
                        normalizarMetodo(
                            p.metodo_pago
                        ) === "credito"
                )
                .reduce(
                    (sum, p) =>
                        sum +
                        Number(
                            p.monto ?? 0
                        ),
                    0
                );

        return {
            efectivo,
            tarjeta,
            transferencia,
            credito,
        };
    }

    // ============================================================
    // CARGAR MOVIMIENTOS
    // ============================================================

    async function cargarMovimientos(
        sesionId: string
    ) {
        try {
            // ========================================================
            // 1. MOVIMIENTOS REALES
            // ========================================================

            const {
                data: movimientosData,
                error: movimientosError,
            } = await supabasePOS
                .from("movimientos_caja")
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
                .eq(
                    "sesion_caja_id",
                    sesionId
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (movimientosError) {
                console.error(
                    "Error consultando movimientos:",
                    movimientosError
                );
            }

            // ========================================================
            // RESOLVER REFERENCIAS DE MOVIMIENTOS
            //
            // No modifica la BD.
            // Solo sustituye visualmente el concepto cuando
            // referencia_id permite identificar el proveedor,
            // cliente o gasto relacionado.
            // ========================================================

            const movimientosBase =
                (movimientosData ??
                    []) as MovimientoReal[];

            const referenciasProveedor =
                movimientosBase
                    .filter((movimiento) => {
                        const concepto =
                            String(
                                movimiento.concepto ?? ""
                            )
                                .trim()
                                .toLowerCase();

                        return (
                            concepto.includes(
                                "pago a proveedor"
                            ) &&
                            !!movimiento.referencia_id
                        );
                    })
                    .map(
                        (movimiento) =>
                            movimiento.referencia_id!
                    );

            const referenciasCliente =
                movimientosBase
                    .filter((movimiento) => {
                        const concepto =
                            String(
                                movimiento.concepto ?? ""
                            )
                                .trim()
                                .toLowerCase();

                        return (
                            concepto.includes(
                                "abono de cliente"
                            ) &&
                            !!movimiento.referencia_id
                        );
                    })
                    .map(
                        (movimiento) =>
                            movimiento.referencia_id!
                    );

            const referenciasGasto =
                movimientosBase
                    .filter((movimiento) => {
                        const concepto =
                            String(
                                movimiento.concepto ?? ""
                            )
                                .trim()
                                .toLowerCase();

                        return (
                            concepto.includes(
                                "gasto"
                            ) &&
                            !!movimiento.referencia_id
                        );
                    })
                    .map(
                        (movimiento) =>
                            movimiento.referencia_id!
                    );

            // ========================================================
            // MAPA DE PAGOS A PROVEEDORES
            // ========================================================

            const mapaPagosProveedor =
                new Map<
                    string,
                    PagoProveedorCaja
                >();

            const proveedorIds =
                new Set<string>();

            if (
                referenciasProveedor.length >
                0
            ) {
                const {
                    data: pagosProveedorData,
                    error: pagosProveedorError,
                } = await supabasePOS
                    .from("pagos_proveedores")
                    .select(`
id,
    proveedor_id
        `)
                    .in(
                        "id",
                        Array.from(
                            new Set(
                                referenciasProveedor
                            )
                        )
                    );

                if (
                    pagosProveedorError
                ) {
                    console.error(
                        "Error consultando pagos a proveedores:",
                        pagosProveedorError
                    );
                } else {
                    (
                        pagosProveedorData ??
                        []
                    ).forEach(
                        (pago) => {
                            const registro =
                                pago as {
                                    id: string;
                                    proveedor_id: string;
                                };

                            mapaPagosProveedor.set(
                                registro.id,
                                {
                                    id:
                                        registro.id,
                                    proveedor_id:
                                        registro.proveedor_id,
                                    proveedor:
                                        null,
                                }
                            );

                            if (
                                registro.proveedor_id
                            ) {
                                proveedorIds.add(
                                    registro.proveedor_id
                                );
                            }
                        }
                    );
                }
            }

            // ========================================================
            // PROVEEDORES
            // ========================================================

            const mapaProveedores =
                new Map<
                    string,
                    string
                >();

            if (
                proveedorIds.size > 0
            ) {
                const {
                    data: proveedoresData,
                    error: proveedoresError,
                } = await supabasePOS
                    .from("proveedores")
                    .select(`
id,
    nombre
        `)
                    .in(
                        "id",
                        Array.from(
                            proveedorIds
                        )
                    );

                if (
                    proveedoresError
                ) {
                    console.error(
                        "Error consultando proveedores:",
                        proveedoresError
                    );
                } else {
                    (
                        proveedoresData ??
                        []
                    ).forEach(
                        (proveedor) => {
                            mapaProveedores.set(
                                proveedor.id,
                                proveedor.nombre
                            );
                        }
                    );
                }
            }

            // ========================================================
            // MAPA DE ABONOS DE CLIENTES
            // ========================================================

            const mapaAbonosCliente =
                new Map<
                    string,
                    AbonoClienteCaja
                >();

            const clienteIds =
                new Set<string>();

            if (
                referenciasCliente.length >
                0
            ) {
                const {
                    data: abonosClienteData,
                    error: abonosClienteError,
                } = await supabasePOS
                    .from("abonos_clientes")
                    .select(`
id,
    cliente_id
        `)
                    .in(
                        "id",
                        Array.from(
                            new Set(
                                referenciasCliente
                            )
                        )
                    );

                if (
                    abonosClienteError
                ) {
                    console.error(
                        "Error consultando abonos de clientes:",
                        abonosClienteError
                    );
                } else {
                    (
                        abonosClienteData ??
                        []
                    ).forEach(
                        (abono) => {
                            const registro =
                                abono as {
                                    id: string;
                                    cliente_id: string;
                                };

                            mapaAbonosCliente.set(
                                registro.id,
                                {
                                    id:
                                        registro.id,
                                    cliente_id:
                                        registro.cliente_id,
                                    cliente:
                                        null,
                                }
                            );

                            if (
                                registro.cliente_id
                            ) {
                                clienteIds.add(
                                    registro.cliente_id
                                );
                            }
                        }
                    );
                }
            }

            // ========================================================
            // CLIENTES
            // ========================================================

            const mapaClientes =
                new Map<
                    string,
                    string
                >();

            if (
                clienteIds.size > 0
            ) {
                const {
                    data: clientesData,
                    error: clientesError,
                } = await supabasePOS
                    .from("clientes")
                    .select(`
id,
    nombre
        `)
                    .in(
                        "id",
                        Array.from(
                            clienteIds
                        )
                    );

                if (
                    clientesError
                ) {
                    console.error(
                        "Error consultando clientes:",
                        clientesError
                    );
                } else {
                    (
                        clientesData ??
                        []
                    ).forEach(
                        (cliente) => {
                            mapaClientes.set(
                                cliente.id,
                                cliente.nombre
                            );
                        }
                    );
                }
            }

            // ========================================================
            // MAPA DE GASTOS
            // ========================================================

            const mapaGastos =
                new Map<
                    string,
                    GastoCaja
                >();

            if (
                referenciasGasto.length >
                0
            ) {
                const {
                    data: gastosData,
                    error: gastosError,
                } = await supabasePOS
                    .from("gastos")
                    .select(`
id,
    concepto,
    referencia,
    notas
        `)
                    .in(
                        "id",
                        Array.from(
                            new Set(
                                referenciasGasto
                            )
                        )
                    );

                if (
                    gastosError
                ) {
                    console.error(
                        "Error consultando gastos:",
                        gastosError
                    );
                } else {
                    (
                        gastosData ??
                        []
                    ).forEach(
                        (gasto) => {
                            mapaGastos.set(
                                gasto.id,
                                gasto as GastoCaja
                            );
                        }
                    );
                }
            }

            // ========================================================
            // REEMBOLSOS AUTOMÁTICOS DE DEVOLUCIÓN
            // se muestran como devolución visual.
            // ========================================================

            const movimientosReales:
                MovimientoVisual[] =
                movimientosBase
                    .filter(
                        (
                            movimiento: MovimientoReal
                        ) => {
                            if (
                                movimiento.tipo !==
                                "entrada" &&
                                movimiento.tipo !==
                                "salida"
                            ) {
                                return false;
                            }

                            const concepto =
                                String(
                                    movimiento.concepto ??
                                    ""
                                )
                                    .trim()
                                    .toLowerCase();

                            if (
                                concepto.includes(
                                    "reembolso por devolución"
                                )
                            ) {
                                return false;
                            }

                            return true;
                        }
                    )
                    .map(
                        (
                            movimiento: MovimientoReal
                        ) => {
                            const conceptoOriginal =
                                String(
                                    movimiento.concepto ??
                                    ""
                                ).trim();

                            const conceptoNormalizado =
                                conceptoOriginal.toLowerCase();

                            let conceptoVisual =
                                conceptoOriginal ||
                                (
                                    movimiento.tipo ===
                                        "entrada"
                                        ? "Entrada de efectivo"
                                        : "Retiro de efectivo"
                                );

                            // ====================================================
                            // PAGO A PROVEEDOR
                            // ====================================================

                            if (
                                conceptoNormalizado.includes(
                                    "pago a proveedor"
                                ) &&
                                movimiento.referencia_id
                            ) {
                                const pagoProveedor =
                                    mapaPagosProveedor.get(
                                        movimiento.referencia_id
                                    );

                                const nombreProveedor =
                                    pagoProveedor
                                        ? mapaProveedores.get(
                                            pagoProveedor.proveedor_id
                                        )
                                        : null;

                                if (
                                    nombreProveedor?.trim()
                                ) {
                                    conceptoVisual =
                                        `Pago a proveedor — ${nombreProveedor.trim()} `;
                                }
                            }

                            // ====================================================
                            // ABONO DE CLIENTE
                            // ====================================================

                            if (
                                conceptoNormalizado.includes(
                                    "abono de cliente"
                                ) &&
                                movimiento.referencia_id
                            ) {
                                const abonoCliente =
                                    mapaAbonosCliente.get(
                                        movimiento.referencia_id
                                    );

                                const nombreCliente =
                                    abonoCliente
                                        ? mapaClientes.get(
                                            abonoCliente.cliente_id
                                        )
                                        : null;

                                if (
                                    nombreCliente?.trim()
                                ) {
                                    conceptoVisual =
                                        `Abono de cliente — ${nombreCliente.trim()} `;
                                }
                            }

                            // ====================================================
                            // GASTO
                            // ====================================================

                            if (
                                conceptoNormalizado.includes(
                                    "gasto"
                                ) &&
                                movimiento.referencia_id
                            ) {
                                const gasto =
                                    mapaGastos.get(
                                        movimiento.referencia_id
                                    );

                                const conceptoGasto =
                                    gasto?.concepto?.trim() ||
                                    gasto?.referencia?.trim() ||
                                    gasto?.notas?.trim() ||
                                    null;

                                if (
                                    conceptoGasto
                                ) {
                                    conceptoVisual =
                                        `Gasto — ${conceptoGasto} `;
                                }
                            }

                            return {
                                id:
                                    movimiento.id,

                                tipo:
                                    movimiento.tipo ===
                                        "entrada"
                                        ? "entrada"
                                        : "salida",

                                concepto:
                                    conceptoVisual,

                                monto:
                                    Number(
                                        movimiento.monto
                                    ),

                                created_at:
                                    movimiento.created_at,

                                referencia_id:
                                    movimiento.referencia_id,

                                venta_id:
                                    null,

                                folio:
                                    null,

                                metodo_pago:
                                    null,

                                metodo_reembolso:
                                    null,

                                afecta_efectivo:
                                    true,
                            };
                        }
                    );

            // ========================================================
            // 2. VENTAS
            // ========================================================

            const {
                data: ventasData,
                error: ventasError,
            } = await supabasePOS
                .from("ventas")
                .select(`
id,
    folio,
    sesion_caja_id,
    estado,
    created_at
        `)
                .eq(
                    "sesion_caja_id",
                    sesionId
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (ventasError) {
                console.error(
                    "Error consultando ventas:",
                    ventasError
                );
            }

            const ventas:
                VentaCaja[] =
                (ventasData ??
                    []) as VentaCaja[];

            const ventaIds =
                ventas.map(
                    (venta) =>
                        venta.id
                );

            // ========================================================
            // 3. PAGOS
            // ========================================================

            let pagos:
                PagoCaja[] = [];

            if (
                ventaIds.length > 0
            ) {
                const {
                    data: pagosData,
                    error: pagosError,
                } = await supabasePOS
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
                    .in(
                        "venta_id",
                        ventaIds
                    );

                if (pagosError) {
                    console.error(
                        "Error consultando pagos:",
                        pagosError
                    );
                } else {
                    pagos =
                        (pagosData ??
                            []) as PagoCaja[];
                }
            }

            // ========================================================
            // 4. DETALLES DE VENTA
            // ========================================================

            let detallesVenta:
                DetalleVentaCaja[] = [];

            if (
                ventaIds.length > 0
            ) {
                const {
                    data: detallesData,
                    error: detallesError,
                } = await supabasePOS
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
    created_at
        `)
                    .in(
                        "venta_id",
                        ventaIds
                    );

                if (detallesError) {
                    console.error(
                        "Error consultando detalle_ventas:",
                        detallesError
                    );
                } else {
                    detallesVenta =
                        (detallesData ??
                            []) as DetalleVentaCaja[];
                }
            }

            // ========================================================
            // 5. PRODUCTOS DE VENTAS
            // ========================================================

            const productoIds =
                Array.from(
                    new Set(
                        detallesVenta
                            .map(
                                (detalle) =>
                                    detalle.producto_id
                            )
                            .filter(Boolean)
                    )
                );

            let productos:
                ProductoCaja[] = [];

            if (
                productoIds.length > 0
            ) {
                const {
                    data: productosData,
                    error: productosError,
                } = await supabasePOS
                    .from("productos")
                    .select(`
id,
    nombre
        `)
                    .in(
                        "id",
                        productoIds
                    );

                if (productosError) {
                    console.error(
                        "Error consultando productos:",
                        productosError
                    );
                } else {
                    productos =
                        (productosData ??
                            []) as ProductoCaja[];
                }
            }

            // ========================================================
            // 6. MAPAS DE VENTAS
            // ========================================================

            const detallesPorVenta =
                new Map<
                    string,
                    DetalleVentaCaja[]
                >();

            detallesVenta.forEach(
                (detalle) => {
                    const existentes =
                        detallesPorVenta.get(
                            detalle.venta_id
                        ) ?? [];

                    existentes.push(
                        detalle
                    );

                    detallesPorVenta.set(
                        detalle.venta_id,
                        existentes
                    );
                }
            );

            const mapaProductos =
                new Map<
                    string,
                    ProductoCaja
                >();

            productos.forEach(
                (producto) => {
                    mapaProductos.set(
                        producto.id,
                        producto
                    );
                }
            );

            // ========================================================
            // 7. MOVIMIENTOS DE VENTA
            // ========================================================

            const movimientosVentas:
                MovimientoVisual[] = [];

            let totalEfectivo = 0;

            const pagosPorVenta =
                new Map<
                    string,
                    PagoCaja[]
                >();

            pagos.forEach(
                (pago) => {
                    const existentes =
                        pagosPorVenta.get(
                            pago.venta_id
                        ) ?? [];

                    existentes.push(
                        pago
                    );

                    pagosPorVenta.set(
                        pago.venta_id,
                        existentes
                    );
                }
            );

            ventas.forEach(
                (venta) => {
                    if (
                        venta.estado !==
                        "completada"
                    ) {
                        return;
                    }

                    const pagosVenta =
                        pagosPorVenta.get(
                            venta.id
                        ) ?? [];

                    const totalVenta =
                        pagosVenta.reduce(
                            (
                                sum,
                                pago
                            ) =>
                                sum +
                                Number(
                                    pago.monto ??
                                    0
                                ),
                            0
                        );

                    const desglose =
                        obtenerDesglosePagos(
                            pagosVenta
                        );

                    // SOLO el efectivo físico afecta la caja.
                    const efectivoVenta =
                        desglose.efectivo;

                    totalEfectivo +=
                        efectivoVenta;

                    const metodoPago =
                        pagosVenta.length > 1
                            ? "mixto"
                            : normalizarMetodo(
                                pagosVenta[0]
                                    ?.metodo_pago
                            );

                    const afectaEfectivo =
                        efectivoVenta > 0;

                    const detalles =
                        detallesPorVenta.get(
                            venta.id
                        ) ?? [];

                    let concepto =
                        "Venta";

                    if (
                        detalles.length ===
                        1
                    ) {
                        const detalle =
                            detalles[0];

                        const producto =
                            mapaProductos.get(
                                detalle.producto_id
                            );

                        if (producto) {
                            const cantidad =
                                Number(
                                    detalle.cantidad
                                );

                            const cantidadTexto =
                                Number.isInteger(
                                    cantidad
                                )
                                    ? cantidad.toString()
                                    : cantidad.toString();

                            concepto =
                                `Venta — ${cantidadTexto} x ${producto.nombre} `;
                        }
                    } else if (
                        detalles.length > 1
                    ) {
                        concepto =
                            `Venta — ${detalles.length} productos`;
                    }

                    const partesPago:
                        string[] = [];

                    if (
                        desglose.efectivo >
                        0
                    ) {
                        partesPago.push(
                            `Efectivo ${formatearMoneda(
                                desglose.efectivo
                            )
                            } `
                        );
                    }

                    if (
                        desglose.tarjeta >
                        0
                    ) {
                        partesPago.push(
                            `Tarjeta ${formatearMoneda(
                                desglose.tarjeta
                            )
                            } `
                        );
                    }

                    if (
                        desglose.transferencia >
                        0
                    ) {
                        partesPago.push(
                            `Transferencia ${formatearMoneda(
                                desglose.transferencia
                            )
                            } `
                        );
                    }

                    if (
                        desglose.credito >
                        0
                    ) {
                        partesPago.push(
                            `Crédito ${formatearMoneda(
                                desglose.credito
                            )
                            } `
                        );
                    }

                    const conceptoVentaVisual =
                        metodoPago ===
                            "mixto" &&
                            partesPago.length >
                            0
                            ? `${concepto} · ${partesPago.join(
                                " · "
                            )
                            } `
                            : concepto;

                    movimientosVentas.push({
                        id:
                            `venta - ${venta.id} `,

                        tipo:
                            "venta",

                        concepto:
                            conceptoVentaVisual,

                        monto:
                            totalVenta,

                        created_at:
                            pagosVenta[0]
                                ?.created_at ??
                            venta.created_at,

                        referencia_id:
                            venta.id,

                        venta_id:
                            venta.id,

                        folio:
                            venta.folio,

                        metodo_pago:
                            metodoPago,

                        metodo_reembolso:
                            null,

                        afecta_efectivo:
                            afectaEfectivo,

                        devolucion_id:
                            null,
                    });
                }
            );

            setVentasEfectivo(
                totalEfectivo
            );

            // ========================================================
            // 8. DEVOLUCIONES
            // ========================================================

            const {
                data: devolucionesData,
                error: devolucionesError,
            } = await supabasePOS
                .from("devoluciones")
                .select(`
id,
    venta_id,
    sesion_caja_id,
    monto_total,
    motivo,
    estado,
    created_at,
    metodo_reembolso
        `)
                .eq(
                    "sesion_caja_id",
                    sesionId
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (devolucionesError) {
                console.error(
                    "Error consultando devoluciones:",
                    devolucionesError
                );
            }

            const {
                data: detallesReembolsosData,
                error: errorDetallesReembolsos,
            } =
                devolucionesData &&
                    devolucionesData.length > 0
                    ? await supabasePOS
                        .from("detalle_reembolsos")
                        .select(
                            "id,devolucion_id,metodo_pago,monto,referencia,created_at"
                        )
                        .in(
                            "devolucion_id",
                            devolucionesData.map(
                                (d) => d.id
                            )
                        )
                    : {
                        data: [],
                        error: null,
                    };

            if (
                errorDetallesReembolsos
            ) {
                throw errorDetallesReembolsos;
            }

            const detallesReembolsos =
                (detallesReembolsosData ??
                    []) as DetalleReembolsoCaja[];

            const detallesReembolsoPorDevolucion =
                new Map<
                    string,
                    DetalleReembolsoCaja[]
                >();

            detallesReembolsos.forEach(
                (detalle) => {
                    const existentes =
                        detallesReembolsoPorDevolucion.get(
                            detalle.devolucion_id
                        ) ?? [];

                    existentes.push(
                        detalle
                    );

                    detallesReembolsoPorDevolucion.set(
                        detalle.devolucion_id,
                        existentes
                    );
                }
            );

            const devoluciones:
                DevolucionCaja[] =
                (devolucionesData ??
                    []) as DevolucionCaja[];

            const devolucionIds =
                devoluciones.map(
                    (devolucion) =>
                        devolucion.id
                );

            // ========================================================
            // 9. DETALLES DE DEVOLUCIONES
            // ========================================================

            let detallesDevolucion:
                DetalleDevolucionCaja[] = [];

            if (
                devolucionIds.length > 0
            ) {
                const {
                    data: detallesDevolucionData,
                    error: detallesDevolucionError,
                } = await supabasePOS
                    .from("detalle_devoluciones")
                    .select(`
id,
    devolucion_id,
    producto_id,
    cantidad
        `)
                    .in(
                        "devolucion_id",
                        devolucionIds
                    );

                if (
                    detallesDevolucionError
                ) {
                    console.error(
                        "Error consultando detalle_devoluciones:",
                        detallesDevolucionError
                    );
                } else {
                    detallesDevolucion =
                        (detallesDevolucionData ??
                            []) as DetalleDevolucionCaja[];
                }
            }

            // ========================================================
            // 10. PRODUCTOS DE DEVOLUCIONES
            // ========================================================

            const productoIdsDevolucion =
                Array.from(
                    new Set(
                        detallesDevolucion
                            .map(
                                (detalle) =>
                                    detalle.producto_id
                            )
                            .filter(Boolean)
                    )
                );

            let productosDevolucion:
                ProductoCaja[] = [];

            if (
                productoIdsDevolucion.length >
                0
            ) {
                const {
                    data: productosDevData,
                    error: productosDevError,
                } = await supabasePOS
                    .from("productos")
                    .select(`
id,
    nombre
        `)
                    .in(
                        "id",
                        productoIdsDevolucion
                    );

                if (
                    productosDevError
                ) {
                    console.error(
                        "Error consultando productos de devoluciones:",
                        productosDevError
                    );
                } else {
                    productosDevolucion =
                        (productosDevData ??
                            []) as ProductoCaja[];
                }
            }

            // ========================================================
            // 11. VENTAS ORIGINALES DE DEVOLUCIONES
            // ========================================================

            const devolucionVentaIds =
                devoluciones
                    .map(
                        (devolucion) =>
                            devolucion.venta_id
                    )
                    .filter(Boolean);

            let ventasDevolucion:
                VentaCaja[] = [];

            if (
                devolucionVentaIds.length >
                0
            ) {
                const {
                    data: ventasDevData,
                    error: ventasDevError,
                } = await supabasePOS
                    .from("ventas")
                    .select(`
id,
    folio,
    sesion_caja_id,
    estado,
    created_at
        `)
                    .in(
                        "id",
                        devolucionVentaIds
                    );

                if (
                    ventasDevError
                ) {
                    console.error(
                        "Error consultando ventas de devoluciones:",
                        ventasDevError
                    );
                } else {
                    ventasDevolucion =
                        (ventasDevData ??
                            []) as VentaCaja[];
                }
            }

            // ========================================================
            // 12. MAPAS DE DEVOLUCIONES
            // ========================================================

            const mapaVentasDevolucion =
                new Map<
                    string,
                    VentaCaja
                >();

            ventasDevolucion.forEach(
                (venta) => {
                    mapaVentasDevolucion.set(
                        venta.id,
                        venta
                    );
                }
            );

            const mapaProductosDevolucion =
                new Map<
                    string,
                    ProductoCaja
                >();

            productosDevolucion.forEach(
                (producto) => {
                    mapaProductosDevolucion.set(
                        producto.id,
                        producto
                    );
                }
            );

            const detallesPorDevolucion =
                new Map<
                    string,
                    DetalleDevolucionCaja[]
                >();

            detallesDevolucion.forEach(
                (detalle) => {
                    const existentes =
                        detallesPorDevolucion.get(
                            detalle.devolucion_id
                        ) ?? [];

                    existentes.push(
                        detalle
                    );

                    detallesPorDevolucion.set(
                        detalle.devolucion_id,
                        existentes
                    );
                }
            );

            // ========================================================
            // 13. DEVOLUCIONES VISUALES
            // ========================================================

            const movimientosDevoluciones:
                MovimientoVisual[] = [];

            let totalDevolucionesEfectivo =
                0;

            devoluciones.forEach(
                (devolucion) => {
                    const estado =
                        String(
                            devolucion.estado ??
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    if (
                        estado &&
                        ![
                            "completada",
                            "completado",
                            "aprobada",
                            "aprobado",
                        ].includes(
                            estado
                        )
                    ) {
                        return;
                    }

                    const metodo =
                        normalizarMetodo(
                            devolucion.metodo_reembolso
                        );

                    const monto =
                        Number(
                            devolucion.monto_total ??
                            0
                        );

                    const detallesReembolso =
                        detallesReembolsoPorDevolucion.get(
                            devolucion.id
                        ) ?? [];

                    // ====================================================
                    // DESGLOSE REAL DEL REEMBOLSO
                    // ====================================================

                    const efectivoReembolso =
                        detallesReembolso
                            .filter(
                                (detalle) =>
                                    normalizarMetodo(
                                        detalle.metodo_pago
                                    ) ===
                                    "efectivo"
                            )
                            .reduce(
                                (
                                    total,
                                    detalle
                                ) =>
                                    total +
                                    Number(
                                        detalle.monto ??
                                        0
                                    ),
                                0
                            );

                    const tarjetaReembolso =
                        detallesReembolso
                            .filter(
                                (detalle) =>
                                    normalizarMetodo(
                                        detalle.metodo_pago
                                    ) ===
                                    "tarjeta"
                            )
                            .reduce(
                                (
                                    total,
                                    detalle
                                ) =>
                                    total +
                                    Number(
                                        detalle.monto ??
                                        0
                                    ),
                                0
                            );

                    const transferenciaReembolso =
                        detallesReembolso
                            .filter(
                                (detalle) =>
                                    normalizarMetodo(
                                        detalle.metodo_pago
                                    ) ===
                                    "transferencia"
                            )
                            .reduce(
                                (
                                    total,
                                    detalle
                                ) =>
                                    total +
                                    Number(
                                        detalle.monto ??
                                        0
                                    ),
                                0
                            );

                    // Compatibilidad con devoluciones antiguas
                    // sin detalle_reembolsos.
                    const montoEfectivoReal =
                        detallesReembolso.length >
                            0
                            ? efectivoReembolso
                            : metodo ===
                                "efectivo"
                                ? monto
                                : 0;

                    const afectaEfectivo =
                        montoEfectivoReal >
                        0;

                    if (
                        afectaEfectivo
                    ) {
                        totalDevolucionesEfectivo +=
                            montoEfectivoReal;
                    }

                    const ventaOriginal =
                        mapaVentasDevolucion.get(
                            devolucion.venta_id
                        );

                    const folio =
                        ventaOriginal
                            ?.folio ??
                        null;

                    const detalles =
                        detallesPorDevolucion.get(
                            devolucion.id
                        ) ?? [];

                    let concepto =
                        "Devolución";

                    if (
                        detalles.length ===
                        1
                    ) {
                        const detalle =
                            detalles[0];

                        const producto =
                            mapaProductosDevolucion.get(
                                detalle.producto_id
                            );

                        if (producto) {
                            const cantidad =
                                Number(
                                    detalle.cantidad
                                );

                            const cantidadTexto =
                                Number.isInteger(
                                    cantidad
                                )
                                    ? cantidad.toString()
                                    : cantidad.toString();

                            concepto =
                                `Devolución — ${cantidadTexto} x ${producto.nombre} `;
                        }
                    } else if (
                        detalles.length > 1
                    ) {
                        concepto =
                            `Devolución — ${detalles.length} productos`;
                    }

                    const partesReembolso:
                        string[] = [];

                    if (
                        efectivoReembolso >
                        0
                    ) {
                        partesReembolso.push(
                            `Efectivo ${formatearMoneda(
                                efectivoReembolso
                            )
                            } `
                        );
                    }

                    if (
                        tarjetaReembolso >
                        0
                    ) {
                        partesReembolso.push(
                            `Tarjeta ${formatearMoneda(
                                tarjetaReembolso
                            )
                            } `
                        );
                    }

                    if (
                        transferenciaReembolso >
                        0
                    ) {
                        partesReembolso.push(
                            `Transferencia ${formatearMoneda(
                                transferenciaReembolso
                            )
                            } `
                        );
                    }

                    const conceptoDevolucionVisual =
                        partesReembolso.length >
                            0
                            ? `${concepto} · ${partesReembolso.join(
                                " · "
                            )
                            } `
                            : concepto;

                    const motivo =
                        devolucion.motivo?.trim() ||
                        null;

                    movimientosDevoluciones.push({
                        id:
                            `devolucion - ${devolucion.id} `,

                        tipo:
                            "devolucion",

                        concepto:
                            conceptoDevolucionVisual,

                        monto,

                        created_at:
                            devolucion.created_at,

                        referencia_id:
                            devolucion.id,

                        venta_id:
                            devolucion.venta_id,

                        folio,

                        metodo_pago:
                            null,

                        metodo_reembolso:
                            metodo || null,

                        afecta_efectivo:
                            afectaEfectivo,

                        devolucion_id:
                            devolucion.id,

                        motivo_devolucion:
                            motivo,
                    });
                }
            );

            setDevolucionesEfectivo(
                totalDevolucionesEfectivo
            );

            // ========================================================
            // 14. UNIR TODO
            // ========================================================

            const todos = [
                ...movimientosReales,
                ...movimientosVentas,
                ...movimientosDevoluciones,
            ];

            todos.sort(
                (a, b) =>
                    new Date(
                        b.created_at
                    ).getTime() -
                    new Date(
                        a.created_at
                    ).getTime()
            );

            // ========================================================
            // 15. ELIMINAR DUPLICADOS
            // ========================================================

            const unicos =
                Array.from(
                    new Map(
                        todos.map(
                            (movimiento) => [
                                movimiento.id,
                                movimiento,
                            ]
                        )
                    ).values()
                );

            setMovimientos(
                unicos
            );
        } catch (e) {
            console.error(
                "Error cargando movimientos:",
                e
            );
        }
    }

    // ============================================================
    // ENTRADAS
    // ============================================================

    const entradas =
        useMemo(() => {
            return movimientos
                .filter(
                    (movimiento) =>
                        movimiento.tipo ===
                        "entrada" &&
                        movimiento.afecta_efectivo
                )
                .reduce(
                    (
                        total,
                        movimiento
                    ) =>
                        total +
                        Number(
                            movimiento.monto
                        ),
                    0
                );
        }, [movimientos]);

    // ============================================================
    // RETIROS
    // ============================================================

    const retiros =
        useMemo(() => {
            return movimientos
                .filter(
                    (movimiento) =>
                        movimiento.tipo ===
                        "salida" &&
                        movimiento.afecta_efectivo
                )
                .reduce(
                    (
                        total,
                        movimiento
                    ) =>
                        total +
                        Number(
                            movimiento.monto
                        ),
                    0
                );
        }, [movimientos]);

    // ============================================================
    // EFECTIVO DISPONIBLE
    // ============================================================

    const efectivoDisponible =
        Number(
            sesion?.monto_inicial ??
            0
        ) +
        ventasEfectivo +
        entradas -
        retiros -
        devolucionesEfectivo;

    // ============================================================
    // FILTROS
    // ============================================================

    const movimientosFiltrados =
        useMemo(() => {
            const texto =
                busqueda
                    .trim()
                    .toLowerCase();

            return movimientos.filter(
                (movimiento) => {
                    let coincideFiltro =
                        true;

                    if (
                        filtro ===
                        "ventas"
                    ) {
                        coincideFiltro =
                            movimiento.tipo ===
                            "venta";
                    }

                    if (
                        filtro ===
                        "devoluciones"
                    ) {
                        coincideFiltro =
                            movimiento.tipo ===
                            "devolucion";
                    }

                    if (
                        filtro ===
                        "entradas"
                    ) {
                        coincideFiltro =
                            movimiento.tipo ===
                            "entrada";
                    }

                    if (
                        filtro ===
                        "retiros"
                    ) {
                        coincideFiltro =
                            movimiento.tipo ===
                            "salida";
                    }

                    if (
                        !coincideFiltro
                    ) {
                        return false;
                    }

                    if (!texto) {
                        return true;
                    }

                    return (
                        movimiento.concepto
                            .toLowerCase()
                            .includes(
                                texto
                            ) ||
                        String(
                            movimiento.folio ??
                            ""
                        ).includes(
                            texto
                        ) ||
                        String(
                            movimiento.monto
                        ).includes(
                            texto
                        ) ||
                        String(
                            movimiento.metodo_pago ??
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                texto
                            ) ||
                        String(
                            movimiento.metodo_reembolso ??
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                texto
                            ) ||
                        String(
                            movimiento.motivo_devolucion ??
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                texto
                            )
                    );
                }
            );
        }, [
            movimientos,
            filtro,
            busqueda,
        ]);

    // ============================================================
    // FORMATO MONEDA
    // ============================================================

    function formatoMoneda(
        cantidad: number
    ) {
        return cantidad.toLocaleString(
            "es-MX",
            {
                style: "currency",
                currency: "MXN",
            }
        );
    }

    // ============================================================
    // FORMATO FECHA
    // ============================================================

    function formatoFecha(
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

    // ============================================================
    // ABRIR MODAL
    // ============================================================

    function abrirModalMovimiento(
        tipo:
            | "entrada"
            | "retiro"
    ) {
        setModalMovimiento(
            tipo
        );

        setMontoMovimiento("");

        setConceptoMovimiento("");

        setErrorMovimiento("");
    }

    // ============================================================
    // CERRAR MODAL
    // ============================================================

    function cerrarModalMovimiento() {
        if (
            guardandoMovimiento
        ) {
            return;
        }

        setModalMovimiento(null);

        setMontoMovimiento("");

        setConceptoMovimiento("");

        setErrorMovimiento("");
    }

    // ============================================================
    // AUTORIZACIÓN
    // ============================================================

    function abrirModalAutorizacion() {
        setErrorAutorizacion("");

        setCorreoAutorizacion("");

        setPasswordAutorizacion("");

        setModalAutorizacion(
            true
        );
    }

    function cerrarModalAutorizacion() {
        if (
            autorizandoMovimiento
        ) {
            return;
        }

        setModalAutorizacion(
            false
        );

        setCorreoAutorizacion("");

        setPasswordAutorizacion("");

        setErrorAutorizacion("");
    }

    // ============================================================
    // SOLICITAR AUTORIZACIÓN
    // ============================================================

    function solicitarAutorizacion() {
        if (
            !usuario ||
            !sesion ||
            !modalMovimiento
        ) {
            return;
        }

        setErrorMovimiento("");

        const monto =
            Number(
                montoMovimiento
            );

        if (
            !montoMovimiento.trim() ||
            Number.isNaN(monto) ||
            monto <= 0
        ) {
            setErrorMovimiento(
                "Ingresa un monto válido mayor a $0.00."
            );
            return;
        }

        if (
            modalMovimiento ===
            "retiro" &&
            monto >
            efectivoDisponible
        ) {
            setErrorMovimiento(
                `El retiro no puede ser mayor al efectivo disponible(${formatoMoneda(
                    efectivoDisponible
                )
                }).`
            );
            return;
        }

        abrirModalAutorizacion();
    }

    // ============================================================
    // AUTORIZAR
    // ============================================================

    async function autorizarMovimiento() {
        if (
            !usuario ||
            !sesion ||
            !modalMovimiento
        ) {
            return;
        }

        setErrorAutorizacion("");

        const correo =
            correoAutorizacion.trim();

        const password =
            passwordAutorizacion;

        const monto =
            Number(
                montoMovimiento
            );

        if (!correo) {
            setErrorAutorizacion(
                "Ingresa el correo del autorizador."
            );
            return;
        }

        if (!password) {
            setErrorAutorizacion(
                "Ingresa la contraseña."
            );
            return;
        }

        if (
            Number.isNaN(monto) ||
            monto <= 0
        ) {
            setErrorAutorizacion(
                "El monto no es válido."
            );
            return;
        }

        if (
            modalMovimiento ===
            "retiro" &&
            monto >
            efectivoDisponible
        ) {
            setErrorAutorizacion(
                `El retiro no puede ser mayor al efectivo disponible(${formatoMoneda(
                    efectivoDisponible
                )
                }).`
            );
            return;
        }

        try {
            setAutorizandoMovimiento(
                true
            );

            const {
                data: authData,
                error: authError,
            } =
                await supabaseAutorizacion.auth.signInWithPassword(
                    {
                        email:
                            correo,
                        password,
                    }
                );

            if (
                authError ||
                !authData.user
            ) {
                setErrorAutorizacion(
                    "Las credenciales no son correctas."
                );
                return;
            }

            const {
                data: usuarioAutorizador,
                error:
                usuarioAutorizadorError,
            } =
                await supabaseAutorizacion
                    .from("usuarios")
                    .select(`
id,
    auth_user_id,
    negocio_id,
    nombre,
    rol,
    activo
        `)
                    .eq(
                        "auth_user_id",
                        authData.user.id
                    )
                    .eq(
                        "activo",
                        true
                    )
                    .maybeSingle();

            if (
                usuarioAutorizadorError
            ) {
                setErrorAutorizacion(
                    "No se pudo verificar el usuario autorizador."
                );

                await supabaseAutorizacion.auth.signOut();

                return;
            }

            if (
                !usuarioAutorizador
            ) {
                setErrorAutorizacion(
                    "El usuario autenticado no está registrado en el sistema."
                );

                await supabaseAutorizacion.auth.signOut();

                return;
            }

            if (
                usuarioAutorizador.rol !==
                "admin" &&
                usuarioAutorizador.rol !==
                "encargado"
            ) {
                setErrorAutorizacion(
                    "Este usuario no tiene permisos para autorizar movimientos de caja."
                );

                await supabaseAutorizacion.auth.signOut();

                return;
            }

            if (
                usuarioAutorizador.negocio_id !==
                usuario.negocio_id
            ) {
                setErrorAutorizacion(
                    "El usuario autorizador no pertenece al mismo negocio."
                );

                await supabaseAutorizacion.auth.signOut();

                return;
            }

            const tipoMovimiento =
                modalMovimiento ===
                    "retiro"
                    ? "salida"
                    : "entrada";

            const concepto =
                conceptoMovimiento.trim() ||
                (
                    modalMovimiento ===
                        "entrada"
                        ? "Entrada de efectivo"
                        : "Retiro de efectivo"
                );

            const {
                error: rpcError,
            } =
                await supabaseAutorizacion.rpc(
                    "registrar_movimiento_caja_autorizado",
                    {
                        p_sesion_caja_id:
                            sesion.id,

                        p_usuario_id:
                            usuario.id,

                        p_tipo:
                            tipoMovimiento,

                        p_monto:
                            monto,

                        p_concepto:
                            concepto,
                    }
                );

            if (rpcError) {
                console.error(
                    rpcError
                );

                setErrorAutorizacion(
                    rpcError.message ||
                    "No se pudo registrar el movimiento."
                );

                await supabaseAutorizacion.auth.signOut();

                return;
            }

            await supabaseAutorizacion.auth.signOut();

            await cargarMovimientos(
                sesion.id
            );

            setModalAutorizacion(
                false
            );

            setCorreoAutorizacion(
                ""
            );

            setPasswordAutorizacion(
                ""
            );

            setErrorAutorizacion(
                ""
            );

            cerrarModalMovimiento();
        } catch (e) {
            console.error(e);

            setErrorAutorizacion(
                "Ocurrió un error al autorizar el movimiento."
            );

            await supabaseAutorizacion.auth.signOut();
        } finally {
            setAutorizandoMovimiento(
                false
            );
        }
    }

    // ============================================================
    // CERRAR CAJA
    // ============================================================

    function cerrarCaja() {
        router.push(
            "/pos/sistema/cerrar"
        );
    }

    // ============================================================
    // LOADING
    // ============================================================

    if (cargando) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl">
                        💰
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                        Cargando caja...
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Consultando el estado actual
                    </p>
                </div>
            </div>
        );
    }

    // ============================================================
    // ERROR
    // ============================================================

    if (
        error ||
        !usuario ||
        !sesion ||
        !caja
    ) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
                <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">
                        ⚠️
                    </div>
                    <h1 className="mt-5 text-xl font-bold text-[var(--color-text)]">
                        No se puede consultar la caja
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                        {error ||
                            "No existe una sesión de caja abierta."}
                    </p>
                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/pos"
                            )
                        }
                        className="mt-6 w-full rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--color-primary-hover)]"
                    >
                        Volver al POS
                    </button>
                </div>
            </div>
        );
    }

    // ============================================================
    // UI
    // ============================================================

    return (
        <div className="min-h-screen bg-[var(--color-background)]">
            {/* HEADER */}
            <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                    <div>
                        <h1 className="text-xl font-bold text-[var(--color-text)]">
                            💰 Caja
                        </h1>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            {caja.nombre} ·{" "}
                            {caja.sucursal_nombre}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        <span className="text-xs font-bold text-green-700">
                            Caja abierta
                        </span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
                {/* ==================================================
                    RESUMEN PRINCIPAL
                ================================================== */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Saldo inicial
                        </p>
                        <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                            {formatoMoneda(
                                Number(
                                    sesion.monto_inicial
                                )
                            )}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Fondo con el que inició la caja
                        </p>
                    </div>

                    <div className="rounded-2xl border border-[var(--color-primary)] bg-[var(--color-surface)] p-5 shadow-sm">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Efectivo disponible
                        </p>
                        <p className="mt-2 text-3xl font-bold text-[var(--color-primary)]">
                            {formatoMoneda(
                                efectivoDisponible
                            )}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Efectivo físico esperado en caja
                        </p>
                    </div>

                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Apertura
                        </p>
                        <p className="mt-2 text-lg font-bold text-[var(--color-text)]">
                            {formatoFecha(
                                sesion.fecha_apertura
                            )}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            {usuario.nombre}
                        </p>
                    </div>
                </div>

                {/* ==================================================
                    RESUMEN
                ================================================== */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                        <p className="text-sm font-semibold text-green-800">
                            ➕ Entradas
                        </p>
                        <p className="mt-2 text-2xl font-bold text-green-700">
                            {formatoMoneda(
                                entradas
                            )}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                        <p className="text-sm font-semibold text-blue-800">
                            🧾 Efectivo recibido por ventas
                        </p>
                        <p className="mt-2 text-2xl font-bold text-blue-700">
                            {formatoMoneda(
                                ventasEfectivo
                            )}
                        </p>
                        <p className="mt-1 text-xs text-blue-700/70">
                            Solo pagos en efectivo
                        </p>
                        <p className="mt-1 text-xs text-blue-700/70">
                            Antes del descuento de devoluciones
                        </p>
                    </div>

                    <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
                        <p className="text-sm font-semibold text-purple-800">
                            ↩️ Devoluciones efectivo
                        </p>
                        <p className="mt-2 text-2xl font-bold text-purple-700">
                            {formatoMoneda(
                                devolucionesEfectivo
                            )}
                        </p>
                        <p className="mt-1 text-xs text-purple-700/70">
                            Solo efectivo reembolsado
                        </p>
                    </div>

                    <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                        <p className="text-sm font-semibold text-red-800">
                            ➖ Retiros
                        </p>
                        <p className="mt-2 text-2xl font-bold text-red-700">
                            {formatoMoneda(
                                retiros
                            )}
                        </p>
                    </div>
                </div>

                {/* ==================================================
                    ACCIONES
                ================================================== */}
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() =>
                            abrirModalMovimiento(
                                "entrada"
                            )
                        }
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-left transition hover:border-green-400 hover:bg-green-50"
                    >
                        <span className="text-xl">
                            ➕
                        </span>
                        <p className="mt-2 text-sm font-bold text-[var(--color-text)]">
                            Registrar entrada
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Agregar efectivo a la caja
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            abrirModalMovimiento(
                                "retiro"
                            )
                        }
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-left transition hover:border-red-400 hover:bg-red-50"
                    >
                        <span className="text-xl">
                            ➖
                        </span>
                        <p className="mt-2 text-sm font-bold text-[var(--color-text)]">
                            Registrar retiro
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            Retirar efectivo de la caja
                        </p>
                    </button>
                </div>

                {/* ==================================================
                    MOVIMIENTOS
                ================================================== */}
                <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
                    {/* CABECERA */}
                    <div className="border-b border-[var(--color-border)] px-5 py-5">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-base font-bold text-[var(--color-text)]">
                                Movimientos de caja
                            </h2>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                                Consulta las operaciones realizadas durante esta sesión.
                            </p>
                        </div>

                        {/* BUSCADOR */}
                        <div className="relative mt-4">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                                🔎
                            </span>
                            <input
                                type="text"
                                value={busqueda}
                                onChange={(e) =>
                                    setBusqueda(
                                        e.target.value
                                    )
                                }
                                placeholder="Buscar por folio, producto, concepto, método o monto..."
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] py-3 pl-11 pr-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                        </div>

                        {/* FILTROS */}
                        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                            {[
                                {
                                    id: "todos",
                                    label: "Todos",
                                },
                                {
                                    id: "ventas",
                                    label: "🧾 Ventas",
                                },
                                {
                                    id: "devoluciones",
                                    label: "↩️ Devoluciones",
                                },
                                {
                                    id: "entradas",
                                    label: "➕ Entradas",
                                },
                                {
                                    id: "retiros",
                                    label: "➖ Retiros",
                                },
                            ].map(
                                (opcion) => (
                                    <button
                                        key={
                                            opcion.id
                                        }
                                        type="button"
                                        onClick={() =>
                                            setFiltro(
                                                opcion.id as
                                                | "todos"
                                                | "ventas"
                                                | "devoluciones"
                                                | "entradas"
                                                | "retiros"
                                            )
                                        }
                                        className={`whitespace - nowrap rounded-full px - 4 py - 2 text - xs font - bold transition ${filtro ===
                                            opcion.id
                                            ? "bg-[var(--color-primary)] text-white"
                                            : "bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                                            } `}
                                    >
                                        {
                                            opcion.label
                                        }
                                    </button>
                                )
                            )}
                        </div>

                        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                            {
                                movimientosFiltrados.length
                            }{" "}
                            movimiento
                            {movimientosFiltrados.length ===
                                1
                                ? ""
                                : "s"}
                        </p>
                    </div>

                    {/* LISTA */}
                    {movimientosFiltrados.length ===
                        0 ? (
                        <div className="px-5 py-12 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-background)] text-2xl">
                                📋
                            </div>
                            <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">
                                No hay movimientos
                            </p>
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                No encontramos movimientos con los filtros seleccionados.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--color-border)]">
                            {movimientosFiltrados.map(
                                (movimiento) => {
                                    const esVenta =
                                        movimiento.tipo ===
                                        "venta";

                                    const esDevolucion =
                                        movimiento.tipo ===
                                        "devolucion";

                                    const esEntrada =
                                        movimiento.tipo ===
                                        "entrada";

                                    const esSalida =
                                        movimiento.tipo ===
                                        "salida";

                                    const metodoVenta =
                                        normalizarMetodo(
                                            movimiento.metodo_pago
                                        );

                                    const metodoReembolso =
                                        normalizarMetodo(
                                            movimiento.metodo_reembolso
                                        );

                                    const afectaEfectivo =
                                        movimiento.afecta_efectivo;

                                    return (
                                        <div
                                            key={
                                                movimiento.id
                                            }
                                            className="px-5 py-4 transition hover:bg-[var(--color-background)]"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                {/* IZQUIERDA */}
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div
                                                        className={`flex h - 10 w - 10 shrink - 0 items - center justify - center rounded - xl ${esVenta
                                                            ? "bg-blue-50"
                                                            : esDevolucion
                                                                ? "bg-purple-50"
                                                                : esEntrada
                                                                    ? "bg-green-50"
                                                                    : "bg-red-50"
                                                            } `}
                                                    >
                                                        {esVenta
                                                            ? "🧾"
                                                            : esDevolucion
                                                                ? "↩️"
                                                                : esEntrada
                                                                    ? "➕"
                                                                    : "➖"}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold leading-5 text-[var(--color-text)]">
                                                            {
                                                                movimiento.concepto
                                                            }
                                                        </p>

                                                        {/* META */}
                                                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            {(esVenta ||
                                                                esDevolucion) &&
                                                                movimiento.folio !==
                                                                null && (
                                                                    <span className="text-xs font-bold text-blue-600">
                                                                        Venta #
                                                                        {
                                                                            movimiento.folio
                                                                        }
                                                                    </span>
                                                                )}

                                                            <span className="text-xs text-[var(--color-text-secondary)]">
                                                                {
                                                                    formatoFecha(
                                                                        movimiento.created_at
                                                                    )
                                                                }
                                                            </span>

                                                            {/* MÉTODO VENTA */}
                                                            {esVenta &&
                                                                movimiento.metodo_pago && (
                                                                    <span
                                                                        className={`rounded-full px - 2 py - 0.5 text - [10px] font - bold ${metodoVenta ===
                                                                            "efectivo"
                                                                            ? "bg-green-50 text-green-700"
                                                                            : metodoVenta ===
                                                                                "tarjeta"
                                                                                ? "bg-orange-50 text-orange-700"
                                                                                : metodoVenta ===
                                                                                    "transferencia"
                                                                                    ? "bg-blue-50 text-blue-700"
                                                                                    : metodoVenta ===
                                                                                        "credito"
                                                                                        ? "bg-amber-50 text-amber-700"
                                                                                        : metodoVenta ===
                                                                                            "mixto"
                                                                                            ? "bg-violet-50 text-violet-700"
                                                                                            : "bg-gray-100 text-gray-700"
                                                                            } `}
                                                                    >
                                                                        {
                                                                            nombreMetodo(
                                                                                movimiento.metodo_pago
                                                                            )
                                                                        }
                                                                    </span>
                                                                )}

                                                            {/* MÉTODO DEVOLUCIÓN */}
                                                            {esDevolucion &&
                                                                metodoReembolso && (
                                                                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                                                                        {
                                                                            nombreMetodo(
                                                                                metodoReembolso
                                                                            )
                                                                        }
                                                                    </span>
                                                                )}

                                                            {/* EFECTIVO */}
                                                            {(esVenta ||
                                                                esDevolucion) && (
                                                                    <span
                                                                        className={` px - 2 py - 0.5 text - [10px] font - semibold ${afectaEfectivo
                                                                            ? "bg-green-50 text-green-700"
                                                                            : "bg-gray-100 text-gray-600"
                                                                            } `}
                                                                    >
                                                                        {afectaEfectivo
                                                                            ? "Afecta efectivo"
                                                                            : "No afecta efectivo"}
                                                                    </span>
                                                                )}
                                                        </div>

                                                        {/* MOTIVO DEVOLUCIÓN */}
                                                        {esDevolucion &&
                                                            movimiento.motivo_devolucion && (
                                                                <div className="mt-2 rounded-lg bg-purple-50/70 px-3 py-2">
                                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-purple-600">
                                                                        Motivo de devolución
                                                                    </p>
                                                                    <p className="mt-0.5 text-xs leading-5 text-purple-900">
                                                                        {
                                                                            movimiento.motivo_devolucion
                                                                        }
                                                                    </p>
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>

                                                {/* MONTO */}
                                                <div className="shrink-0 text-right">
                                                    <p
                                                        className={`text - sm font - bold ${esVenta ||
                                                            esEntrada
                                                            ? "text-green-600"
                                                            : esDevolucion
                                                                ? "text-purple-600"
                                                                : "text-red-600"
                                                            } `}
                                                    >
                                                        {esVenta ||
                                                            esEntrada
                                                            ? "+"
                                                            : "-"}
                                                        {formatoMoneda(
                                                            Number(
                                                                movimiento.monto
                                                            )
                                                        )}
                                                    </p>

                                                    {esSalida && (
                                                        <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                                                            Salida
                                                        </p>
                                                    )}

                                                    {esDevolucion && (
                                                        <p className="mt-1 text-[10px] text-purple-600">
                                                            Reembolso
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}
                </div>

                {/* ==================================================
                    CERRAR CAJA
                ================================================== */}
                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={
                            cerrarCaja
                        }
                        className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
                    >
                        🔒 Ir al cierre de caja
                    </button>
                </div>
            </main>

            {/* ======================================================
                MODAL MOVIMIENTO
            ====================================================== */}
            {modalMovimiento && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">
                        <div
                            className={`border - b px - 6 py - 5 ${modalMovimiento ===
                                "entrada"
                                ? "border-green-200 bg-green-50"
                                : "border-red-200 bg-red-50"
                                } `}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-2xl">
                                        {modalMovimiento ===
                                            "entrada"
                                            ? "➕"
                                            : "➖"}
                                    </div>

                                    <h2 className="mt-2 text-lg font-bold text-[var(--color-text)]">
                                        {modalMovimiento ===
                                            "entrada"
                                            ? "Registrar entrada"
                                            : "Registrar retiro"}
                                    </h2>

                                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                        {modalMovimiento ===
                                            "entrada"
                                            ? "Agrega efectivo a la caja."
                                            : "Retira efectivo de la caja."}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarModalMovimiento
                                    }
                                    disabled={
                                        guardandoMovimiento
                                    }
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[var(--color-text-secondary)] hover:bg-black/5"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="space-y-5 p-6">
                            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                                <p className="text-xs text-[var(--color-text-secondary)]">
                                    Efectivo disponible
                                </p>
                                <p className="mt-1 text-lg font-bold text-[var(--color-text)]">
                                    {formatoMoneda(
                                        efectivoDisponible
                                    )}
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="montoMovimiento"
                                    className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                >
                                    Monto
                                </label>

                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-secondary)]">
                                        $
                                    </span>

                                    <input
                                        id="montoMovimiento"
                                        type="number"
                                        inputMode="decimal"
                                        min="0.01"
                                        step="0.01"
                                        value={
                                            montoMovimiento
                                        }
                                        onChange={(e) =>
                                            setMontoMovimiento(
                                                e.target.value
                                            )
                                        }
                                        placeholder="0.00"
                                        autoFocus
                                        disabled={
                                            guardandoMovimiento
                                        }
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-8 pr-4 text-lg font-bold text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="conceptoMovimiento"
                                    className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                >
                                    Concepto
                                    <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">
                                        (opcional)
                                    </span>
                                </label>

                                <input
                                    id="conceptoMovimiento"
                                    type="text"
                                    value={
                                        conceptoMovimiento
                                    }
                                    onChange={(e) =>
                                        setConceptoMovimiento(
                                            e.target.value
                                        )
                                    }
                                    placeholder={
                                        modalMovimiento ===
                                            "entrada"
                                            ? "Ej. Fondo adicional"
                                            : "Ej. Retiro para depósito"
                                    }
                                    disabled={
                                        guardandoMovimiento
                                    }
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                                />
                            </div>

                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                <p className="text-sm font-semibold text-amber-800">
                                    🔐 Autorización requerida
                                </p>
                                <p className="mt-1 text-xs leading-5 text-amber-700">
                                    Para registrar este movimiento se requiere la autorización de un administrador o encargado.
                                </p>
                            </div>

                            {errorMovimiento && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                    <p className="text-sm font-semibold text-red-700">
                                        ⚠️{" "}
                                        {
                                            errorMovimiento
                                        }
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={
                                        cerrarModalMovimiento
                                    }
                                    disabled={
                                        guardandoMovimiento
                                    }
                                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-bold text-[var(--color-text)] transition hover:bg-[var(--color-background)]"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        solicitarAutorizacion
                                    }
                                    disabled={
                                        guardandoMovimiento
                                    }
                                    className={`rounded - xl px - 4 py - 3 text - sm font - bold text - white transition ${modalMovimiento ===
                                        "entrada"
                                        ? "bg-green-600 hover:bg-green-700"
                                        : "bg-red-600 hover:bg-red-700"
                                        } `}
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================
                MODAL AUTORIZACIÓN
            ====================================================== */}
            {modalAutorizacion && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">
                        <div className="border-b border-[var(--color-border)] bg-[var(--color-background)] px-6 py-5">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
                                        🔐
                                    </div>

                                    <h2 className="mt-4 text-lg font-bold text-[var(--color-text)]">
                                        Autorización requerida
                                    </h2>

                                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                                        Ingresa las credenciales de un administrador o encargado.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarModalAutorizacion
                                    }
                                    disabled={
                                        autorizandoMovimiento
                                    }
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-[var(--color-text-secondary)] hover:bg-black/5"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="space-y-5 p-6">
                            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                            Movimiento
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-[var(--color-text)]">
                                            {modalMovimiento ===
                                                "entrada"
                                                ? "➕ Entrada de efectivo"
                                                : "➖ Retiro de efectivo"}
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                            Monto
                                        </p>

                                        <p
                                            className={`mt - 1 text - lg font - bold ${modalMovimiento ===
                                                "entrada"
                                                ? "text-green-600"
                                                : "text-red-600"
                                                } `}
                                        >
                                            {formatoMoneda(
                                                Number(
                                                    montoMovimiento
                                                )
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="correoAutorizacion"
                                    className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                >
                                    Usuario o correo del autorizador
                                </label>

                                <input
                                    id="correoAutorizacion"
                                    type="email"
                                    value={
                                        correoAutorizacion
                                    }
                                    onChange={(e) =>
                                        setCorreoAutorizacion(
                                            e.target.value
                                        )
                                    }
                                    placeholder="admin@ejemplo.com"
                                    autoComplete="off"
                                    autoFocus
                                    disabled={
                                        autorizandoMovimiento
                                    }
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="passwordAutorizacion"
                                    className="mb-2 block text-sm font-semibold text-[var(--color-text)]"
                                >
                                    Contraseña
                                </label>

                                <input
                                    id="passwordAutorizacion"
                                    type="password"
                                    value={
                                        passwordAutorizacion
                                    }
                                    onChange={(e) =>
                                        setPasswordAutorizacion(
                                            e.target.value
                                        )
                                    }
                                    placeholder="••••••••"
                                    autoComplete="off"
                                    disabled={
                                        autorizandoMovimiento
                                    }
                                    onKeyDown={(e) => {
                                        if (
                                            e.key ===
                                            "Enter" &&
                                            !autorizandoMovimiento
                                        ) {
                                            autorizarMovimiento();
                                        }
                                    }}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                                />
                            </div>

                            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                                <p className="text-xs leading-5 text-blue-700">
                                    ℹ️ La cuenta debe pertenecer a este negocio y tener el rol de administrador o encargado.
                                </p>
                            </div>

                            {errorAutorizacion && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                    <p className="text-sm font-semibold text-red-700">
                                        ⚠️{" "}
                                        {
                                            errorAutorizacion
                                        }
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={
                                        cerrarModalAutorizacion
                                    }
                                    disabled={
                                        autorizandoMovimiento
                                    }
                                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-bold text-[var(--color-text)] transition hover:bg-[var(--color-background)]"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        autorizarMovimiento
                                    }
                                    disabled={
                                        autorizandoMovimiento
                                    }
                                    className={`rounded - xl px - 4 py - 3 text - sm font - bold text - white transition ${modalMovimiento ===
                                        "entrada"
                                        ? "bg-green-600 hover:bg-green-700"
                                        : "bg-red-600 hover:bg-red-700"
                                        } `}
                                >
                                    {autorizandoMovimiento
                                        ? "Validando..."
                                        : "Autorizar y registrar"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
