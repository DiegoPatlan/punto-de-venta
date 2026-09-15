"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
    verificarRol,
    type UsuarioActual,
} from "../../../lib/auth/roleGuard";
import ModalMensaje from "../../components/ModalMensaje";
import Button from "../../components/Button";
import Card from "../../components/Card";

type TipoMensaje =
    | "exito"
    | "error"
    | "confirmacion"
    | "info";

type EstadoGasto =
    | "pendiente"
    | "aprobado"
    | "rechazado";

interface Sucursal {
    id: string;
    nombre: string;
}

interface CajaSesion {
    id: string;
    caja_id: string;
    estado: string;
    monto_esperado: number;
    caja_nombre: string;
    sucursal_id: string;
    sucursal_nombre: string;
}

interface Gasto {
    id: string;
    negocio_id: string;
    sucursal_id: string;
    sesion_caja_id: string;
    usuario_id: string;
    concepto: string;
    monto: number;
    referencia: string | null;
    notas: string | null;
    estado: EstadoGasto;
    created_at: string;
    sucursal?: {
        nombre: string;
    } | null;
    usuario?: {
        nombre: string;
    } | null;
}

interface MovimientoCaja {
    id: string;
    sesion_caja_id: string;
    usuario_id: string;
    tipo: string;
    concepto: string | null;
    monto: number;
    referencia_id: string | null;
    usuario_autorizador_id: string | null;
    created_at: string;
}

function dinero(valor: number) {
    return Number(valor || 0).toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
    });
}

function fechaHora(valor: string) {
    if (!valor) return "—";

    return new Date(valor).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
    });
}

function obtenerFechaLocal() {
    const ahora = new Date();
    const year = ahora.getFullYear();
    const month = String(ahora.getMonth() + 1).padStart(2, "0");
    const day = String(ahora.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function fechaLocalDeTimestamp(valor: string) {
    const fecha = new Date(valor);

    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

export default function GastosPage() {
    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [sucursales, setSucursales] =
        useState<Sucursal[]>([]);
    const [sesiones, setSesiones] =
        useState<CajaSesion[]>([]);

    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

    const [error, setError] = useState("");

    // =========================================================
    // FILTROS
    // =========================================================

    const [busqueda, setBusqueda] = useState("");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const [filtroSucursal, setFiltroSucursal] =
        useState("");
    const [filtroEstado, setFiltroEstado] =
        useState<"" | EstadoGasto>("");
    const [filtroUsuario, setFiltroUsuario] =
        useState("");

    // =========================================================
    // MODAL REGISTRAR
    // =========================================================

    const [modalRegistrar, setModalRegistrar] =
        useState(false);

    const [sesionSeleccionada, setSesionSeleccionada] =
        useState("");

    const [concepto, setConcepto] =
        useState("");
    const [monto, setMonto] =
        useState("");
    const [referencia, setReferencia] =
        useState("");
    const [notas, setNotas] =
        useState("");

    // =========================================================
    // DETALLE
    // =========================================================

    const [gastoDetalle, setGastoDetalle] =
        useState<Gasto | null>(null);

    const [movimientoDetalle, setMovimientoDetalle] =
        useState<MovimientoCaja | null>(null);

    const [cargandoDetalle, setCargandoDetalle] =
        useState(false);

    // =========================================================
    // MODAL MENSAJE
    // =========================================================

    const [modalAbierto, setModalAbierto] =
        useState(false);

    const [modalTipo, setModalTipo] =
        useState<TipoMensaje>("info");

    const [modalTitulo, setModalTitulo] =
        useState("");

    const [modalMensaje, setModalMensaje] =
        useState("");

    function mostrarMensaje(
        tipo: TipoMensaje,
        titulo: string,
        mensaje: string
    ) {
        setModalTipo(tipo);
        setModalTitulo(titulo);
        setModalMensaje(mensaje);
        setModalAbierto(true);
    }

    function cerrarMensaje() {
        setModalAbierto(false);
    }

    // =========================================================
    // CARGAR CONTEXTO
    // =========================================================

    async function cargarDatos() {
        try {
            setCargando(true);
            setError("");

            const resultado =
                await verificarRol([
                    "admin",
                    "encargado",
                ]);

            // IMPORTANTE:
            // verificarRol NO devuelve directamente
            // UsuarioActual. Devuelve un objeto con:
            // autorizado + usuario + motivo.

            if (
                !resultado.autorizado ||
                !resultado.usuario
            ) {
                setUsuario(null);
                return;
            }

            const usuarioActual =
                resultado.usuario;

            setUsuario(usuarioActual);

            const negocioId =
                usuarioActual.negocio_id;

            // =================================================
            // SUCURSALES
            // =================================================

            const {
                data: sucursalesData,
                error: errorSucursales,
            } = await supabase
                .from("sucursales")
                .select(`
                    id,
                    nombre
                `)
                .eq("negocio_id", negocioId)
                .eq("activo", true)
                .order("nombre");

            if (errorSucursales) {
                console.error(
                    "Error cargando sucursales:",
                    errorSucursales
                );

                setError(
                    errorSucursales.message ||
                    "No se pudieron cargar las sucursales."
                );

                return;
            }

            setSucursales(
                (sucursalesData as Sucursal[]) ?? []
            );

            // =================================================
            // SESIONES DE CAJA ABIERTAS
            // =================================================

            const {
                data: sesionesData,
                error: errorSesiones,
            } = await supabase
                .from("sesiones_caja")
                .select(`
                    id,
                    caja_id,
                    estado,
                    monto_esperado,
                    cajas!inner(
                        id,
                        nombre,
                        sucursal_id,
                        sucursales!inner(
                            id,
                            nombre,
                            negocio_id
                        )
                    )
                `)
                .eq("estado", "abierta")
                .eq(
                    "cajas.sucursales.negocio_id",
                    negocioId
                );

            if (errorSesiones) {
                console.error(
                    "Error cargando sesiones:",
                    errorSesiones
                );

                setError(
                    errorSesiones.message ||
                    "No se pudieron cargar las sesiones de caja."
                );

                return;
            }

            const sesionesFormateadas: CajaSesion[] =
                (sesionesData ?? []).map(
                    (sesion: any) => ({
                        id: sesion.id,
                        caja_id: sesion.caja_id,
                        estado: sesion.estado,
                        monto_esperado:
                            Number(
                                sesion.monto_esperado
                            ) || 0,
                        caja_nombre:
                            sesion.cajas?.nombre ??
                            "Caja",
                        sucursal_id:
                            sesion.cajas?.sucursal_id ??
                            "",
                        sucursal_nombre:
                            sesion.cajas?.sucursales
                                ?.nombre ??
                            "Sucursal",
                    })
                );

            setSesiones(sesionesFormateadas);

            // =================================================
            // GASTOS
            // =================================================

            const {
                data: gastosData,
                error: errorGastos,
            } = await supabase
                .from("gastos")
                .select(`
                    id,
                    negocio_id,
                    sucursal_id,
                    sesion_caja_id,
                    usuario_id,
                    concepto,
                    monto,
                    referencia,
                    notas,
                    estado,
                    created_at,
                    sucursales(
                        nombre
                    ),
                    usuarios(
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

            if (errorGastos) {
                console.error(
                    "Error cargando gastos:",
                    errorGastos
                );

                setError(
                    errorGastos.message ||
                    "No se pudieron cargar los gastos."
                );

                return;
            }

            const gastosFormateados: Gasto[] =
                (gastosData ?? []).map(
                    (gasto: any) => ({
                        id: gasto.id,
                        negocio_id:
                            gasto.negocio_id,
                        sucursal_id:
                            gasto.sucursal_id,
                        sesion_caja_id:
                            gasto.sesion_caja_id,
                        usuario_id:
                            gasto.usuario_id,
                        concepto:
                            gasto.concepto,
                        monto:
                            Number(gasto.monto) || 0,
                        referencia:
                            gasto.referencia,
                        notas:
                            gasto.notas,
                        estado:
                            gasto.estado,
                        created_at:
                            gasto.created_at,
                        sucursal:
                            gasto.sucursales,
                        usuario:
                            gasto.usuarios,
                    })
                );

            setGastos(gastosFormateados);
        } catch (err) {
            console.error(
                "Error inesperado cargando gastos:",
                err
            );

            setError(
                "Ocurrió un error inesperado al cargar Gastos."
            );
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        const hoy = obtenerFechaLocal();

        setFechaDesde(hoy);
        setFechaHasta(hoy);

        cargarDatos();
    }, []);

    // =========================================================
    // SESIONES DEL USUARIO / DISPONIBLES
    // =========================================================

    const sesionesDisponibles = useMemo(() => {
        return sesiones;
    }, [sesiones]);

    // =========================================================
    // FILTROS
    // =========================================================

    const gastosFiltrados = useMemo(() => {
        return gastos.filter((gasto) => {
            const texto =
                busqueda.trim().toLowerCase();

            if (texto) {
                const coincide =
                    gasto.concepto
                        .toLowerCase()
                        .includes(texto) ||
                    (gasto.referencia ?? "")
                        .toLowerCase()
                        .includes(texto) ||
                    (gasto.notas ?? "")
                        .toLowerCase()
                        .includes(texto) ||
                    (gasto.usuario?.nombre ?? "")
                        .toLowerCase()
                        .includes(texto);

                if (!coincide) {
                    return false;
                }
            }

            const fecha =
                fechaLocalDeTimestamp(
                    gasto.created_at
                );

            if (
                fechaDesde &&
                fecha < fechaDesde
            ) {
                return false;
            }

            if (
                fechaHasta &&
                fecha > fechaHasta
            ) {
                return false;
            }

            if (
                filtroSucursal &&
                gasto.sucursal_id !==
                filtroSucursal
            ) {
                return false;
            }

            if (
                filtroEstado &&
                gasto.estado !== filtroEstado
            ) {
                return false;
            }

            if (
                filtroUsuario &&
                gasto.usuario_id !==
                filtroUsuario
            ) {
                return false;
            }

            return true;
        });
    }, [
        gastos,
        busqueda,
        fechaDesde,
        fechaHasta,
        filtroSucursal,
        filtroEstado,
        filtroUsuario,
    ]);

    // =========================================================
    // RESUMEN
    // =========================================================

    const resumen = useMemo(() => {
        let total = 0;
        let aprobados = 0;
        let pendientes = 0;
        let rechazados = 0;

        gastosFiltrados.forEach((gasto) => {
            const montoGasto =
                Number(gasto.monto) || 0;

            if (
                gasto.estado === "aprobado"
            ) {
                total += montoGasto;
                aprobados++;
            }

            if (
                gasto.estado === "pendiente"
            ) {
                pendientes++;
            }

            if (
                gasto.estado === "rechazado"
            ) {
                rechazados++;
            }
        });

        return {
            total,
            cantidad:
                gastosFiltrados.length,
            aprobados,
            pendientes,
            rechazados,
        };
    }, [gastosFiltrados]);

    // =========================================================
    // USUARIOS DEL FILTRO
    // =========================================================

    const usuariosFiltro = useMemo(() => {
        const mapa = new Map<
            string,
            string
        >();

        gastos.forEach((gasto) => {
            mapa.set(
                gasto.usuario_id,
                gasto.usuario?.nombre ??
                "Usuario"
            );
        });

        return Array.from(
            mapa.entries()
        ).map(
            ([id, nombre]) => ({
                id,
                nombre,
            })
        );
    }, [gastos]);

    // =========================================================
    // SESIÓN SELECCIONADA
    // =========================================================

    const sesionActual = useMemo(() => {
        return sesiones.find(
            (sesion) =>
                sesion.id ===
                sesionSeleccionada
        );
    }, [
        sesiones,
        sesionSeleccionada,
    ]);

    const montoNumerico =
        Number(monto) || 0;

    const efectivoDespues =
        sesionActual
            ? Number(
                sesionActual.monto_esperado
            ) - montoNumerico
            : 0;

    // =========================================================
    // LIMPIAR FORMULARIO
    // =========================================================

    function limpiarFormulario() {
        setSesionSeleccionada("");
        setConcepto("");
        setMonto("");
        setReferencia("");
        setNotas("");
    }

    function cerrarModalRegistrar() {
        if (guardando) return;

        setModalRegistrar(false);
        limpiarFormulario();
    }

    // =========================================================
    // REGISTRAR GASTO
    // =========================================================

    async function registrarGasto() {
        if (!sesionSeleccionada) {
            mostrarMensaje(
                "error",
                "Caja requerida",
                "Selecciona una sesión de caja abierta."
            );

            return;
        }

        if (
            !concepto.trim()
        ) {
            mostrarMensaje(
                "error",
                "Concepto requerido",
                "Escribe el concepto del gasto."
            );

            return;
        }

        if (
            !monto ||
            montoNumerico <= 0
        ) {
            mostrarMensaje(
                "error",
                "Monto inválido",
                "El monto del gasto debe ser mayor a cero."
            );

            return;
        }

        if (
            sesionActual &&
            montoNumerico >
            Number(
                sesionActual.monto_esperado
            )
        ) {
            mostrarMensaje(
                "error",
                "Efectivo insuficiente",
                `La caja tiene ${dinero(
                    Number(
                        sesionActual.monto_esperado
                    )
                )} disponibles y el gasto es de ${dinero(
                    montoNumerico
                )}.`
            );

            return;
        }

        try {
            setGuardando(true);

            const {
                data,
                error: errorRPC,
            } = await supabase.rpc(
                "registrar_gasto",
                {
                    p_sesion_caja_id:
                        sesionSeleccionada,
                    p_concepto:
                        concepto.trim(),
                    p_monto:
                        montoNumerico,
                    p_referencia:
                        referencia.trim() ||
                        null,
                    p_notas:
                        notas.trim() ||
                        null,
                }
            );

            if (errorRPC) {
                console.error(
                    "Error registrando gasto:",
                    errorRPC
                );

                mostrarMensaje(
                    "error",
                    "No se pudo registrar",
                    errorRPC.message ||
                    "No fue posible registrar el gasto."
                );

                return;
            }

            if (!data) {
                mostrarMensaje(
                    "error",
                    "Registro incompleto",
                    "El sistema no devolvió el identificador del gasto."
                );

                return;
            }

            setModalRegistrar(false);
            limpiarFormulario();

            mostrarMensaje(
                "exito",
                "Gasto registrado",
                `El gasto por ${dinero(
                    montoNumerico
                )} fue registrado correctamente y se reflejó como salida de caja.`
            );

            await cargarDatos();
        } catch (err: any) {
            console.error(
                "Error inesperado registrando gasto:",
                err
            );

            mostrarMensaje(
                "error",
                "Error inesperado",
                err?.message ||
                "Ocurrió un error al registrar el gasto."
            );
        } finally {
            setGuardando(false);
        }
    }

    // =========================================================
    // VER DETALLE
    // =========================================================

    async function abrirDetalle(
        gasto: Gasto
    ) {
        setGastoDetalle(gasto);
        setMovimientoDetalle(null);
        setCargandoDetalle(true);

        try {
            const {
                data,
                error: errorMovimiento,
            } = await supabase
                .from("movimientos_caja")
                .select(`
                    id,
                    sesion_caja_id,
                    usuario_id,
                    tipo,
                    concepto,
                    monto,
                    referencia_id,
                    usuario_autorizador_id,
                    created_at
                `)
                .eq(
                    "referencia_id",
                    gasto.id
                )
                .eq(
                    "tipo",
                    "salida"
                )
                .maybeSingle();

            if (errorMovimiento) {
                console.error(
                    "Error obteniendo movimiento del gasto:",
                    errorMovimiento
                );
            }

            setMovimientoDetalle(
                (data as MovimientoCaja) ??
                null
            );
        } catch (err) {
            console.error(
                "Error cargando detalle del gasto:",
                err
            );
        } finally {
            setCargandoDetalle(false);
        }
    }

    function cerrarDetalle() {
        setGastoDetalle(null);
        setMovimientoDetalle(null);
    }

    // =========================================================
    // LIMPIAR FILTROS
    // =========================================================

    function limpiarFiltros() {
        setBusqueda("");
        setFechaDesde("");
        setFechaHasta("");
        setFiltroSucursal("");
        setFiltroEstado("");
        setFiltroUsuario("");
    }

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div
            className="space-y-6"
            style={{
                color: "var(--color-text)",
            }}
        >
            {/* ================================================= */}
            {/* ENCABEZADO */}
            {/* ================================================= */}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1
                        className="text-2xl font-bold"
                        style={{
                            color: "var(--color-text)",
                        }}
                    >
                        Gastos
                    </h1>

                    <p
                        className="mt-1 text-sm"
                        style={{
                            color: "var(--color-text-secondary)",
                        }}
                    >
                        Registra y controla los gastos
                        operativos de tu negocio.
                    </p>
                </div>

                <Button
                    type="button"
                    onClick={() =>
                        setModalRegistrar(true)
                    }
                    disabled={
                        sesionesDisponibles.length ===
                        0
                    }
                    size="large"
                >
                    + Registrar gasto
                </Button>
            </div>

            {/* ================================================= */}
            {/* ERROR */}
            {/* ================================================= */}

            {error && (
                <div
                    className="rounded-2xl border p-4 text-sm"
                    style={{
                        borderColor:
                            "var(--color-danger)",
                        background:
                            "var(--color-danger-soft)",
                        color:
                            "var(--color-danger)",
                    }}
                >
                    {error}
                </div>
            )}

            {/* ================================================= */}
            {/* AVISO SIN CAJA */}
            {/* ================================================= */}

            {!cargando &&
                sesionesDisponibles.length ===
                0 && (
                    <div
                        className="rounded-2xl border p-5"
                        style={{
                            borderColor:
                                "var(--color-warning)",
                            background:
                                "color-mix(in srgb, var(--color-warning) 10%, var(--color-surface))",
                        }}
                    >
                        <p
                            className="font-semibold"
                            style={{
                                color:
                                    "var(--color-warning)",
                            }}
                        >
                            No hay sesiones de caja abiertas.
                        </p>

                        <p
                            className="mt-1 text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Para registrar un gasto
                            directamente debes tener
                            una caja abierta.
                        </p>
                    </div>
                )}

            {/* ================================================= */}
            {/* RESUMEN */}
            {/* ================================================= */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="p-5">
                    <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        Gastos del periodo
                    </p>

                    <p
                        className="mt-2 text-3xl font-bold"
                        style={{
                            color:
                                "var(--color-text)",
                        }}
                    >
                        {dinero(resumen.total)}
                    </p>
                </Card>

                <Card className="p-5">
                    <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        Gastos aprobados
                    </p>

                    <p
                        className="mt-2 text-3xl font-bold"
                        style={{
                            color:
                                "var(--color-success)",
                        }}
                    >
                        {resumen.aprobados}
                    </p>
                </Card>

                <Card className="p-5">
                    <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        Pendientes
                    </p>

                    <p
                        className="mt-2 text-3xl font-bold"
                        style={{
                            color:
                                "var(--color-warning)",
                        }}
                    >
                        {resumen.pendientes}
                    </p>
                </Card>

                <Card className="p-5">
                    <p
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        Cantidad de gastos
                    </p>

                    <p
                        className="mt-2 text-3xl font-bold"
                        style={{
                            color:
                                "var(--color-text)",
                        }}
                    >
                        {resumen.cantidad}
                    </p>
                </Card>
            </div>

            {/* ================================================= */}
            {/* CAJAS ABIERTAS */}
            {/* ================================================= */}

            {sesionesDisponibles.length > 0 && (
                <Card>
                    <div className="mb-4">
                        <h2
                            className="text-lg font-bold"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            Cajas abiertas
                        </h2>

                        <p
                            className="text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Selecciona una caja al registrar
                            un gasto.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {sesionesDisponibles.map(
                            (sesion) => (
                                <button
                                    key={sesion.id}
                                    type="button"
                                    onClick={() => {
                                        setSesionSeleccionada(
                                            sesion.id
                                        );
                                        setModalRegistrar(
                                            true
                                        );
                                    }}
                                    className="rounded-xl border p-4 text-left transition duration-200 hover:-translate-y-0.5"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                        background:
                                            "var(--color-surface)",
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p
                                                className="font-semibold"
                                                style={{
                                                    color:
                                                        "var(--color-text)",
                                                }}
                                            >
                                                {
                                                    sesion.caja_nombre
                                                }
                                            </p>

                                            <p
                                                className="mt-1 text-sm"
                                                style={{
                                                    color:
                                                        "var(--color-text-secondary)",
                                                }}
                                            >
                                                {
                                                    sesion.sucursal_nombre
                                                }
                                            </p>
                                        </div>

                                        <span
                                            className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                                            style={{
                                                borderColor:
                                                    "var(--color-success)",
                                                color:
                                                    "var(--color-success)",
                                                background:
                                                    "color-mix(in srgb, var(--color-success) 10%, var(--color-surface))",
                                            }}
                                        >
                                            Abierta
                                        </span>
                                    </div>

                                    <div
                                        className="mt-4 border-t pt-3"
                                        style={{
                                            borderColor:
                                                "var(--color-border)",
                                        }}
                                    >
                                        <p
                                            className="text-xs uppercase tracking-wide"
                                            style={{
                                                color:
                                                    "var(--color-text-secondary)",
                                            }}
                                        >
                                            Efectivo disponible
                                        </p>

                                        <p
                                            className="mt-1 text-xl font-bold"
                                            style={{
                                                color:
                                                    "var(--color-text)",
                                            }}
                                        >
                                            {dinero(
                                                sesion.monto_esperado
                                            )}
                                        </p>
                                    </div>
                                </button>
                            )
                        )}
                    </div>
                </Card>
            )}

            {/* ================================================= */}
            {/* FILTROS */}
            {/* ================================================= */}

            <Card>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2
                            className="text-lg font-bold"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            Filtros
                        </h2>

                        <p
                            className="text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Consulta el historial de gastos.
                        </p>
                    </div>

                    <Button
                        type="button"
                        onClick={limpiarFiltros}
                        variant="ghost"
                        size="small"
                    >
                        Limpiar filtros
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <div>
                        <label
                            className="mb-1 block text-sm font-medium"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            Buscar
                        </label>

                        <input
                            value={busqueda}
                            onChange={(e) =>
                                setBusqueda(
                                    e.target.value
                                )
                            }
                            placeholder="Concepto, referencia..."
                            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                                background:
                                    "var(--color-surface)",
                                color:
                                    "var(--color-text)",
                            }}
                        />
                    </div>

                    <div>
                        <label
                            className="mb-1 block text-sm font-medium"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
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
                            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                                background:
                                    "var(--color-surface)",
                                color:
                                    "var(--color-text)",
                            }}
                        />
                    </div>

                    <div>
                        <label
                            className="mb-1 block text-sm font-medium"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
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
                            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                                background:
                                    "var(--color-surface)",
                                color:
                                    "var(--color-text)",
                            }}
                        />
                    </div>

                    <div>
                        <label
                            className="mb-1 block text-sm font-medium"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            Sucursal
                        </label>

                        <select
                            value={filtroSucursal}
                            onChange={(e) =>
                                setFiltroSucursal(
                                    e.target.value
                                )
                            }
                            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                                background:
                                    "var(--color-surface)",
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            <option value="">
                                Todas
                            </option>

                            {sucursales.map(
                                (sucursal) => (
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
                            className="mb-1 block text-sm font-medium"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            Estado
                        </label>

                        <select
                            value={filtroEstado}
                            onChange={(e) =>
                                setFiltroEstado(
                                    e.target.value as
                                    | ""
                                    | EstadoGasto
                                )
                            }
                            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                                background:
                                    "var(--color-surface)",
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            <option value="">
                                Todos
                            </option>

                            <option value="aprobado">
                                Aprobados
                            </option>

                            <option value="pendiente">
                                Pendientes
                            </option>

                            <option value="rechazado">
                                Rechazados
                            </option>
                        </select>
                    </div>

                    <div>
                        <label
                            className="mb-1 block text-sm font-medium"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            Usuario
                        </label>

                        <select
                            value={filtroUsuario}
                            onChange={(e) =>
                                setFiltroUsuario(
                                    e.target.value
                                )
                            }
                            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                                background:
                                    "var(--color-surface)",
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            <option value="">
                                Todos
                            </option>

                            {usuariosFiltro.map(
                                (item) => (
                                    <option
                                        key={item.id}
                                        value={item.id}
                                    >
                                        {item.nombre}
                                    </option>
                                )
                            )}
                        </select>
                    </div>
                </div>
            </Card>

            {/* ================================================= */}
            {/* TABLA */}
            {/* ================================================= */}

            <Card className="overflow-hidden p-0">
                <div
                    className="border-b p-5"
                    style={{
                        borderColor:
                            "var(--color-border)",
                    }}
                >
                    <h2
                        className="text-lg font-bold"
                        style={{
                            color:
                                "var(--color-text)",
                        }}
                    >
                        Historial de gastos
                    </h2>

                    <p
                        className="text-sm"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        {gastosFiltrados.length} registro(s)
                        encontrado(s).
                    </p>
                </div>

                {cargando ? (
                    <div
                        className="p-8 text-center text-sm"
                        style={{
                            color:
                                "var(--color-text-secondary)",
                        }}
                    >
                        Cargando gastos...
                    </div>
                ) : gastosFiltrados.length ===
                    0 ? (
                    <div className="p-10 text-center">
                        <p
                            className="font-semibold"
                            style={{
                                color:
                                    "var(--color-text)",
                            }}
                        >
                            No hay gastos para mostrar.
                        </p>

                        <p
                            className="mt-1 text-sm"
                            style={{
                                color:
                                    "var(--color-text-secondary)",
                            }}
                        >
                            Ajusta los filtros o registra
                            un nuevo gasto.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead
                                style={{
                                    background:
                                        "var(--color-background)",
                                }}
                            >
                                <tr>
                                    <th
                                        className="px-5 py-3 text-left font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Fecha
                                    </th>

                                    <th
                                        className="px-5 py-3 text-left font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Concepto
                                    </th>

                                    <th
                                        className="px-5 py-3 text-left font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Sucursal
                                    </th>

                                    <th
                                        className="px-5 py-3 text-left font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Usuario
                                    </th>

                                    <th
                                        className="px-5 py-3 text-left font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Monto
                                    </th>

                                    <th
                                        className="px-5 py-3 text-left font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Estado
                                    </th>

                                    <th
                                        className="px-5 py-3 text-right font-semibold"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Acción
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {gastosFiltrados.map(
                                    (gasto) => (
                                        <tr
                                            key={
                                                gasto.id
                                            }
                                            className="transition hover:bg-[var(--color-background)]"
                                            style={{
                                                borderTop:
                                                    "1px solid var(--color-border)",
                                            }}
                                        >
                                            <td
                                                className="whitespace-nowrap px-5 py-4"
                                                style={{
                                                    color:
                                                        "var(--color-text-secondary)",
                                                }}
                                            >
                                                {fechaHora(
                                                    gasto.created_at
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <p
                                                    className="font-semibold"
                                                    style={{
                                                        color:
                                                            "var(--color-text)",
                                                    }}
                                                >
                                                    {
                                                        gasto.concepto
                                                    }
                                                </p>

                                                {gasto.referencia && (
                                                    <p
                                                        className="mt-1 text-xs"
                                                        style={{
                                                            color:
                                                                "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        Ref:{" "}
                                                        {
                                                            gasto.referencia
                                                        }
                                                    </p>
                                                )}
                                            </td>

                                            <td
                                                className="px-5 py-4"
                                                style={{
                                                    color:
                                                        "var(--color-text-secondary)",
                                                }}
                                            >
                                                {
                                                    gasto
                                                        .sucursal
                                                        ?.nombre ??
                                                    "—"
                                                }
                                            </td>

                                            <td
                                                className="px-5 py-4"
                                                style={{
                                                    color:
                                                        "var(--color-text-secondary)",
                                                }}
                                            >
                                                {
                                                    gasto
                                                        .usuario
                                                        ?.nombre ??
                                                    "—"
                                                }
                                            </td>

                                            <td
                                                className="whitespace-nowrap px-5 py-4 font-bold"
                                                style={{
                                                    color:
                                                        "var(--color-text)",
                                                }}
                                            >
                                                {dinero(
                                                    gasto.monto
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                {gasto.estado ===
                                                    "aprobado" && (
                                                        <span
                                                            className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                                                            style={{
                                                                borderColor:
                                                                    "var(--color-success)",
                                                                color:
                                                                    "var(--color-success)",
                                                                background:
                                                                    "color-mix(in srgb, var(--color-success) 10%, var(--color-surface))",
                                                            }}
                                                        >
                                                            Aprobado
                                                        </span>
                                                    )}

                                                {gasto.estado ===
                                                    "pendiente" && (
                                                        <span
                                                            className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                                                            style={{
                                                                borderColor:
                                                                    "var(--color-warning)",
                                                                color:
                                                                    "var(--color-warning)",
                                                                background:
                                                                    "color-mix(in srgb, var(--color-warning) 10%, var(--color-surface))",
                                                            }}
                                                        >
                                                            Pendiente
                                                        </span>
                                                    )}

                                                {gasto.estado ===
                                                    "rechazado" && (
                                                        <span
                                                            className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                                                            style={{
                                                                borderColor:
                                                                    "var(--color-danger)",
                                                                color:
                                                                    "var(--color-danger)",
                                                                background:
                                                                    "color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))",
                                                            }}
                                                        >
                                                            Rechazado
                                                        </span>
                                                    )}
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                <Button
                                                    type="button"
                                                    onClick={() =>
                                                        abrirDetalle(
                                                            gasto
                                                        )
                                                    }
                                                    variant="ghost"
                                                    size="small"
                                                >
                                                    Ver detalle
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* ================================================= */}
            {/* MODAL REGISTRAR GASTO */}
            {/* ================================================= */}

            {modalRegistrar && (
                <div
                    className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onMouseDown={(e) => {
                        if (
                            e.target ===
                            e.currentTarget
                        ) {
                            cerrarModalRegistrar();
                        }
                    }}
                >
                    <Card
                        className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-0 shadow-2xl"
                    >
                        <div
                            className="border-b p-6"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                            }}
                        >
                            <h2
                                className="text-xl font-bold"
                                style={{
                                    color:
                                        "var(--color-text)",
                                }}
                            >
                                Registrar gasto
                            </h2>

                            <p
                                className="mt-1 text-sm"
                                style={{
                                    color:
                                        "var(--color-text-secondary)",
                                }}
                            >
                                El registro creará el gasto
                                y su salida correspondiente
                                en caja de forma atómica.
                            </p>
                        </div>

                        <div className="space-y-5 p-6">
                            {/* CAJA */}

                            <div>
                                <label
                                    className="mb-1 block text-sm font-semibold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Caja / sesión
                                </label>

                                <select
                                    value={
                                        sesionSeleccionada
                                    }
                                    onChange={(e) =>
                                        setSesionSeleccionada(
                                            e.target.value
                                        )
                                    }
                                    disabled={guardando}
                                    className="w-full rounded-xl border px-3 py-3 text-sm outline-none transition"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                        background:
                                            "var(--color-surface)",
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    <option value="">
                                        Selecciona una caja
                                    </option>

                                    {sesionesDisponibles.map(
                                        (sesion) => (
                                            <option
                                                key={
                                                    sesion.id
                                                }
                                                value={
                                                    sesion.id
                                                }
                                            >
                                                {
                                                    sesion.caja_nombre
                                                }{" "}
                                                —{" "}
                                                {
                                                    sesion.sucursal_nombre
                                                }{" "}
                                                — Disponible:{" "}
                                                {dinero(
                                                    sesion.monto_esperado
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            {/* CONCEPTO */}

                            <div>
                                <label
                                    className="mb-1 block text-sm font-semibold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Concepto
                                </label>

                                <input
                                    value={concepto}
                                    onChange={(e) =>
                                        setConcepto(
                                            e.target.value
                                        )
                                    }
                                    disabled={guardando}
                                    placeholder="Ej. Compra de material de limpieza"
                                    className="w-full rounded-xl border px-3 py-3 text-sm outline-none transition"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                        background:
                                            "var(--color-surface)",
                                        color:
                                            "var(--color-text)",
                                    }}
                                />
                            </div>

                            {/* MONTO */}

                            <div>
                                <label
                                    className="mb-1 block text-sm font-semibold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Monto
                                </label>

                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={monto}
                                    onChange={(e) =>
                                        setMonto(
                                            e.target.value
                                        )
                                    }
                                    disabled={guardando}
                                    placeholder="0.00"
                                    className="w-full rounded-xl border px-3 py-3 text-sm outline-none transition"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                        background:
                                            "var(--color-surface)",
                                        color:
                                            "var(--color-text)",
                                    }}
                                />
                            </div>

                            {/* REFERENCIA */}

                            <div>
                                <label
                                    className="mb-1 block text-sm font-semibold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Referencia
                                    <span
                                        className="ml-1 font-normal"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        (opcional)
                                    </span>
                                </label>

                                <input
                                    value={referencia}
                                    onChange={(e) =>
                                        setReferencia(
                                            e.target.value
                                        )
                                    }
                                    disabled={guardando}
                                    placeholder="Folio, factura, ticket..."
                                    className="w-full rounded-xl border px-3 py-3 text-sm outline-none transition"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                        background:
                                            "var(--color-surface)",
                                        color:
                                            "var(--color-text)",
                                    }}
                                />
                            </div>

                            {/* NOTAS */}

                            <div>
                                <label
                                    className="mb-1 block text-sm font-semibold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Notas
                                    <span
                                        className="ml-1 font-normal"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        (opcional)
                                    </span>
                                </label>

                                <textarea
                                    value={notas}
                                    onChange={(e) =>
                                        setNotas(
                                            e.target.value
                                        )
                                    }
                                    disabled={guardando}
                                    rows={3}
                                    placeholder="Observaciones del gasto..."
                                    className="w-full resize-none rounded-xl border px-3 py-3 text-sm outline-none transition"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                        background:
                                            "var(--color-surface)",
                                        color:
                                            "var(--color-text)",
                                    }}
                                />
                            </div>

                            {/* RESUMEN */}

                            {sesionActual && (
                                <div
                                    className="rounded-xl border p-4"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                        background:
                                            "var(--color-background)",
                                    }}
                                >
                                    <div className="flex items-center justify-between text-sm">
                                        <span
                                            style={{
                                                color:
                                                    "var(--color-text-secondary)",
                                            }}
                                        >
                                            Efectivo disponible
                                        </span>

                                        <span
                                            className="font-semibold"
                                            style={{
                                                color:
                                                    "var(--color-text)",
                                            }}
                                        >
                                            {dinero(
                                                sesionActual.monto_esperado
                                            )}
                                        </span>
                                    </div>

                                    <div className="mt-2 flex items-center justify-between text-sm">
                                        <span
                                            style={{
                                                color:
                                                    "var(--color-text-secondary)",
                                            }}
                                        >
                                            Gasto
                                        </span>

                                        <span
                                            className="font-semibold"
                                            style={{
                                                color:
                                                    "var(--color-danger)",
                                            }}
                                        >
                                            -{" "}
                                            {dinero(
                                                montoNumerico
                                            )}
                                        </span>
                                    </div>

                                    <div
                                        className="mt-3 border-t pt-3"
                                        style={{
                                            borderColor:
                                                "var(--color-border)",
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span
                                                className="font-semibold"
                                                style={{
                                                    color:
                                                        "var(--color-text)",
                                                }}
                                            >
                                                Efectivo después
                                            </span>

                                            <span
                                                className="text-lg font-bold"
                                                style={{
                                                    color:
                                                        efectivoDespues < 0
                                                            ? "var(--color-danger)"
                                                            : "var(--color-text)",
                                                }}
                                            >
                                                {dinero(
                                                    efectivoDespues
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div
                            className="flex flex-col-reverse gap-3 border-t p-5 sm:flex-row sm:justify-end"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                                background:
                                    "var(--color-background)",
                            }}
                        >
                            <Button
                                type="button"
                                onClick={
                                    cerrarModalRegistrar
                                }
                                disabled={guardando}
                                variant="secondary"
                            >
                                Cancelar
                            </Button>

                            <Button
                                type="button"
                                onClick={
                                    registrarGasto
                                }
                                disabled={guardando}
                            >
                                {guardando
                                    ? "Registrando..."
                                    : "Registrar gasto"}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* ================================================= */}
            {/* MODAL DETALLE */}
            {/* ================================================= */}

            {gastoDetalle && (
                <div
                    className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onMouseDown={(e) => {
                        if (
                            e.target ===
                            e.currentTarget
                        ) {
                            cerrarDetalle();
                        }
                    }}
                >
                    <Card
                        className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-0 shadow-2xl"
                    >
                        <div
                            className="flex items-start justify-between gap-4 border-b p-6"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                            }}
                        >
                            <div>
                                <h2
                                    className="text-xl font-bold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Detalle del gasto
                                </h2>

                                <p
                                    className="mt-1 text-sm"
                                    style={{
                                        color:
                                            "var(--color-text-secondary)",
                                    }}
                                >
                                    {fechaHora(
                                        gastoDetalle.created_at
                                    )}
                                </p>
                            </div>

                            <Button
                                type="button"
                                onClick={
                                    cerrarDetalle
                                }
                                variant="ghost"
                                size="small"
                                aria-label="Cerrar detalle"
                            >
                                ✕
                            </Button>
                        </div>

                        <div className="space-y-4 p-6">
                            <div
                                className="rounded-xl border p-4"
                                style={{
                                    borderColor:
                                        "var(--color-border)",
                                }}
                            >
                                <p
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{
                                        color:
                                            "var(--color-text-secondary)",
                                    }}
                                >
                                    Concepto
                                </p>

                                <p
                                    className="mt-1 font-semibold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    {
                                        gastoDetalle.concepto
                                    }
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div
                                    className="rounded-xl border p-4"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                    }}
                                >
                                    <p
                                        className="text-xs font-semibold uppercase tracking-wide"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Monto
                                    </p>

                                    <p
                                        className="mt-1 text-xl font-bold"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        {dinero(
                                            gastoDetalle.monto
                                        )}
                                    </p>
                                </div>

                                <div
                                    className="rounded-xl border p-4"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                    }}
                                >
                                    <p
                                        className="text-xs font-semibold uppercase tracking-wide"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Estado
                                    </p>

                                    <div className="mt-1">
                                        {gastoDetalle.estado ===
                                            "aprobado" && (
                                                <span
                                                    className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                                                    style={{
                                                        borderColor:
                                                            "var(--color-success)",
                                                        color:
                                                            "var(--color-success)",
                                                        background:
                                                            "color-mix(in srgb, var(--color-success) 10%, var(--color-surface))",
                                                    }}
                                                >
                                                    Aprobado
                                                </span>
                                            )}

                                        {gastoDetalle.estado ===
                                            "pendiente" && (
                                                <span
                                                    className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                                                    style={{
                                                        borderColor:
                                                            "var(--color-warning)",
                                                        color:
                                                            "var(--color-warning)",
                                                        background:
                                                            "color-mix(in srgb, var(--color-warning) 10%, var(--color-surface))",
                                                    }}
                                                >
                                                    Pendiente
                                                </span>
                                            )}

                                        {gastoDetalle.estado ===
                                            "rechazado" && (
                                                <span
                                                    className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                                                    style={{
                                                        borderColor:
                                                            "var(--color-danger)",
                                                        color:
                                                            "var(--color-danger)",
                                                        background:
                                                            "color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))",
                                                    }}
                                                >
                                                    Rechazado
                                                </span>
                                            )}
                                    </div>
                                </div>
                            </div>

                            <div
                                className="rounded-xl border p-4"
                                style={{
                                    borderColor:
                                        "var(--color-border)",
                                }}
                            >
                                <p
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{
                                        color:
                                            "var(--color-text-secondary)",
                                    }}
                                >
                                    Sucursal
                                </p>

                                <p
                                    className="mt-1"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    {
                                        gastoDetalle
                                            .sucursal
                                            ?.nombre ??
                                        "—"
                                    }
                                </p>
                            </div>

                            <div
                                className="rounded-xl border p-4"
                                style={{
                                    borderColor:
                                        "var(--color-border)",
                                }}
                            >
                                <p
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{
                                        color:
                                            "var(--color-text-secondary)",
                                    }}
                                >
                                    Usuario
                                </p>

                                <p
                                    className="mt-1"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    {
                                        gastoDetalle
                                            .usuario
                                            ?.nombre ??
                                        "—"
                                    }
                                </p>
                            </div>

                            {gastoDetalle.referencia && (
                                <div
                                    className="rounded-xl border p-4"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                    }}
                                >
                                    <p
                                        className="text-xs font-semibold uppercase tracking-wide"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Referencia
                                    </p>

                                    <p
                                        className="mt-1"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        {
                                            gastoDetalle.referencia
                                        }
                                    </p>
                                </div>
                            )}

                            {gastoDetalle.notas && (
                                <div
                                    className="rounded-xl border p-4"
                                    style={{
                                        borderColor:
                                            "var(--color-border)",
                                    }}
                                >
                                    <p
                                        className="text-xs font-semibold uppercase tracking-wide"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Notas
                                    </p>

                                    <p
                                        className="mt-1 whitespace-pre-wrap"
                                        style={{
                                            color:
                                                "var(--color-text)",
                                        }}
                                    >
                                        {
                                            gastoDetalle.notas
                                        }
                                    </p>
                                </div>
                            )}

                            <div
                                className="rounded-xl border p-4"
                                style={{
                                    borderColor:
                                        "var(--color-border)",
                                    background:
                                        "var(--color-background)",
                                }}
                            >
                                <p
                                    className="text-sm font-bold"
                                    style={{
                                        color:
                                            "var(--color-text)",
                                    }}
                                >
                                    Integración con caja
                                </p>

                                {cargandoDetalle ? (
                                    <p
                                        className="mt-2 text-sm"
                                        style={{
                                            color:
                                                "var(--color-text-secondary)",
                                        }}
                                    >
                                        Consultando movimiento...
                                    </p>
                                ) : movimientoDetalle ? (
                                    <div className="mt-3 space-y-2 text-sm">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                            <span
                                                style={{
                                                    color:
                                                        "var(--color-text-secondary)",
                                                }}
                                            >
                                                Movimiento
                                            </span>

                                            <span
                                                className="break-all font-mono text-xs"
                                                style={{
                                                    color:
                                                        "var(--color-text)",
                                                }}
                                            >
                                                {
                                                    movimientoDetalle.id
                                                }
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <span
                                                style={{
                                                    color:
                                                        "var(--color-text-secondary)",
                                                }}
                                            >
                                                Tipo
                                            </span>

                                            <span
                                                className="font-semibold"
                                                style={{
                                                    color:
                                                        "var(--color-danger)",
                                                }}
                                            >
                                                Salida
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <span
                                                style={{
                                                    color:
                                                        "var(--color-text-secondary)",
                                                }}
                                            >
                                                Monto
                                            </span>

                                            <span
                                                className="font-bold"
                                                style={{
                                                    color:
                                                        "var(--color-text)",
                                                }}
                                            >
                                                {dinero(
                                                    movimientoDetalle.monto
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                            <span
                                                style={{
                                                    color:
                                                        "var(--color-text-secondary)",
                                                }}
                                            >
                                                Referencia
                                            </span>

                                            <span
                                                className="break-all font-mono text-xs"
                                                style={{
                                                    color:
                                                        "var(--color-text)",
                                                }}
                                            >
                                                {
                                                    movimientoDetalle.referencia_id
                                                }
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p
                                        className="mt-2 text-sm"
                                        style={{
                                            color:
                                                "var(--color-warning)",
                                        }}
                                    >
                                        No se encontró el
                                        movimiento de caja
                                        asociado.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div
                            className="border-t p-5 text-right"
                            style={{
                                borderColor:
                                    "var(--color-border)",
                                background:
                                    "var(--color-background)",
                            }}
                        >
                            <Button
                                type="button"
                                onClick={
                                    cerrarDetalle
                                }
                            >
                                Cerrar
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* ================================================= */}
            {/* MODAL MENSAJE */}
            {/* ================================================= */}

            <ModalMensaje
                abierto={modalAbierto}
                tipo={modalTipo}
                titulo={modalTitulo}
                mensaje={modalMensaje}
                onCerrar={cerrarMensaje}
            />
        </div>
    );
}