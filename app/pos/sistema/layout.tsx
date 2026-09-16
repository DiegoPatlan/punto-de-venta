"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
    obtenerUsuarioPOS,
    type UsuarioPOS,
} from "../../../lib/usuarioPOS";

import { supabasePOS } from "../../../lib/supabase";
import Logo from "../../components/Logo";

interface POSLayoutProps {
    children: ReactNode;
}

export default function POSLayout({
    children,
}: POSLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();

    const [usuario, setUsuario] =
        useState<UsuarioPOS | null>(null);

    const [cargando, setCargando] =
        useState(true);

    const [cajaAbierta, setCajaAbierta] =
        useState(false);

    const [cerrandoSesion, setCerrandoSesion] =
        useState(false);

    const [menuMovilAbierto, setMenuMovilAbierto] =
        useState(false);

    useEffect(() => {
        function actualizarFotoUsuario(
            event: Event
        ) {
            const customEvent =
                event as CustomEvent<{
                    userId?: string;
                    fotoUrl?: string | null;
                }>;

            const userId =
                customEvent.detail?.userId;

            const fotoUrl =
                customEvent.detail?.fotoUrl ?? null;

            if (
                userId &&
                usuario?.id &&
                userId === usuario.id
            ) {
                setUsuario((actual) =>
                    actual
                        ? {
                            ...actual,
                            foto_url: fotoUrl,
                        }
                        : actual
                );
            }
        }

        window.addEventListener(
            "usuario-foto-actualizada",
            actualizarFotoUsuario
        );

        return () => {
            window.removeEventListener(
                "usuario-foto-actualizada",
                actualizarFotoUsuario
            );
        };
    }, [usuario?.id]);

    /*
     * ============================================================
     * CARGAR USUARIO Y VERIFICAR CAJA
     * ============================================================
     */

    useEffect(() => {
        let cancelado = false;

        async function cargarUsuario() {
            try {
                setCargando(true);

                const usuarioActual =
                    await obtenerUsuarioPOS();

                if (cancelado) return;


                /*
                 * ========================================================
                 * NO HAY SESIÓN
                 * ========================================================
                 */

                if (!usuarioActual) {
                    console.warn(
                        "⚠️ No existe una sesión POS activa."
                    );

                    setUsuario(null);
                    setCajaAbierta(false);
                    setCargando(false);

                    router.replace("/pos/login");
                    return;
                }

                /*
                 * ========================================================
                 * GUARDAR USUARIO
                 * ========================================================
                 */

                setUsuario(usuarioActual);

                /*
                 * ========================================================
                 * VERIFICAR CAJA ABIERTA
                 * ========================================================
                 */

                const {
                    data: sesionCaja,
                    error: errorCaja,
                } = await supabasePOS
                    .from("sesiones_caja")
                    .select(
                        "id, caja_id, usuario_apertura_id, estado"
                    )
                    .eq(
                        "usuario_apertura_id",
                        usuarioActual.id
                    )
                    .eq(
                        "estado",
                        "abierta"
                    )
                    .maybeSingle();

                if (cancelado) return;

                /*
                 * ========================================================
                 * ERROR CONSULTANDO CAJA
                 * ========================================================
                 */

                if (errorCaja) {
                    console.error(
                        "❌ Error verificando caja abierta:",
                        errorCaja
                    );

                    setCajaAbierta(false);
                    setCargando(false);

                    router.replace("/pos/caj");
                    return;
                }

                /*
                 * ========================================================
                 * ACTUALIZAR ESTADO
                 * ========================================================
                 */

                const tieneCajaAbierta =
                    Boolean(sesionCaja);

                setCajaAbierta(
                    tieneCajaAbierta
                );


                if (sesionCaja) {

                }

                /*
                 * ========================================================
                 * SI NO HAY CAJA ABIERTA
                 * ========================================================
                 */

                if (!tieneCajaAbierta) {


                    setCargando(false);

                    router.replace("/pos/caj");
                    return;
                }

                /*
                 * ========================================================
                 * TODO CORRECTO
                 * ========================================================
                 */


                setCargando(false);
            } catch (error) {
                if (cancelado) return;

                console.error(
                    "❌ Error obteniendo usuario POS:",
                    error
                );

                setUsuario(null);
                setCajaAbierta(false);
                setCargando(false);

                router.replace("/pos/login");
            }
        }

        cargarUsuario();

        return () => {
            cancelado = true;
        };
    }, [router, pathname]);

    /*
     * ============================================================
     * CERRAR SESIÓN
     * ============================================================
     */

    async function cerrarSesion() {
        try {
            setCerrandoSesion(true);

            await supabasePOS.auth.signOut();

            setUsuario(null);
            setCajaAbierta(false);
            setMenuMovilAbierto(false);

            router.replace("/pos/login");
        } catch (error) {
            console.error(
                "❌ Error cerrando sesión:",
                error
            );

            setCerrandoSesion(false);
        }
    }

    /*
     * ============================================================
     * CERRAR MENÚ MÓVIL AL CAMBIAR DE RUTA
     * ============================================================
     */

    useEffect(() => {
        setMenuMovilAbierto(false);
    }, [pathname]);

    /*
     * ============================================================
     * CARGANDO
     * ============================================================
     */

    if (cargando) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
                <div className="w-full max-w-sm rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-xl">

                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl text-white shadow-lg">
                        🏪
                    </div>

                    <p className="text-base font-bold text-[var(--color-text)]">
                        Cargando punto de venta...
                    </p>

                    <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
                        Verificando sesión y caja
                    </p>

                    <div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--color-primary)]" />
                    </div>

                </div>
            </div>
        );
    }

    /*
     * ============================================================
     * SIN USUARIO
     * ============================================================
     */

    if (!usuario) {
        return null;
    }

    /*
     * ============================================================
     * SIN CAJA ABIERTA
     * ============================================================
     */

    if (!cajaAbierta) {
        return null;
    }

    /*
     * ============================================================
     * DATOS DEL NEGOCIO
     * ============================================================
     */

    const negocio = usuario.negocio;

    const nombreNegocio =
        negocio?.nombre || "Mi negocio";

    const logoNegocio =
        negocio?.logo_url || null;

    const inicialNegocio =
        nombreNegocio
            .trim()
            .charAt(0)
            .toUpperCase() || "N";

    const inicialUsuario =
        usuario.nombre
            ?.trim()
            .charAt(0)
            .toUpperCase() || "U";

    /*
     * ============================================================
     * MENÚ PRINCIPAL
     * ============================================================
     */

    const menuPrincipal = [
        {
            nombre: "Punto de Venta",
            corto: "Venta",
            icono: "🛒",
            ruta: "/pos/sistema",
            grupo: "Operación",
        },
        {
            nombre: "Historial de ventas",
            corto: "Historial",
            icono: "🧾",
            ruta: "/pos/sistema/historial",
            grupo: "Operación",
        },
        {
            nombre: "Clientes",
            corto: "Clientes",
            icono: "👥",
            ruta: "/pos/sistema/clientes",
            grupo: "Operación",
        },
        {
            nombre: "Productos",
            corto: "Productos",
            icono: "📦",
            ruta: "/pos/sistema/productos",
            grupo: "Operación",
        },
        {
            nombre: "Devoluciones",
            corto: "Devoluciones",
            icono: "↩️",
            ruta: "/pos/sistema/devoluciones",
            grupo: "Operación",
        },
        {
            nombre: "Cajas",
            corto: "Caja",
            icono: "💰",
            ruta: "/pos/sistema/caja",
            grupo: "Caja",
        },
        {
            nombre: "Resumen",
            corto: "Resumen",
            icono: "📊",
            ruta: "/pos/sistema/resumen",
            grupo: "Caja",
        },
        {
            nombre: "Cerrar caja",
            corto: "Cerrar",
            icono: "🔒",
            ruta: "/pos/sistema/cerrar",
            grupo: "Caja",
        },
        {
            nombre: "Configuración",
            corto: "Config.",
            icono: "⚙️",
            ruta: "/pos/sistema/configuracion",
            grupo: "Sistema",
        },
    ];

    /*
     * ============================================================
     * FUNCIÓN PARA SABER QUÉ RUTA ESTÁ ACTIVA
     * ============================================================
     */

    function rutaActiva(ruta: string) {
        if (ruta === "/pos/sistema") {
            return pathname === "/pos/sistema";
        }

        return pathname.startsWith(ruta);
    }

    /*
     * ============================================================
     * LAYOUT
     * ============================================================
     */

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">

            {/* =====================================================
                HEADER
            ===================================================== */}

            <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 shadow-sm backdrop-blur">

                <div className="mx-auto flex h-[68px] max-w-[1900px] items-center justify-between px-3 sm:h-[72px] sm:px-5 lg:px-7 xl:px-8">

                    {/* =================================================
                        NEGOCIO
                    ================================================= */}

                    <div className="flex min-w-0 items-center gap-3">

                        {/* LOGO DEL NEGOCIO */}

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm sm:h-11 sm:w-11">

                            {logoNegocio ? (
                                <img
                                    src={logoNegocio}
                                    alt={`Logo de ${nombreNegocio}`}
                                    className="h-full w-full object-contain p-1"
                                />
                            ) : (
                                <span className="text-lg font-extrabold text-[var(--color-primary)]">
                                    {inicialNegocio}
                                </span>
                            )}

                        </div>

                        {/* INFORMACIÓN DEL NEGOCIO */}

                        <div className="min-w-0">

                            <p className="max-w-[180px] truncate text-sm font-extrabold text-[var(--color-text)] sm:max-w-[260px] sm:text-base lg:max-w-[360px]">
                                {nombreNegocio}
                            </p>

                            <div className="mt-0.5 flex items-center gap-1.5">

                                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] sm:text-[11px]">
                                    Punto de Venta
                                </span>

                                <span className="h-1 w-1 rounded-full bg-slate-300" />

                                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] sm:text-[11px]">
                                    Sesión activa
                                </span>

                            </div>

                        </div>

                    </div>

                    {/* =================================================
                        ACCIONES HEADER
                    ================================================= */}

                    <div className="flex items-center gap-2 sm:gap-3">

                        {/* =================================================
                            LOGO SOPORTE TI
                            ================================================= */}

                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                            <img
                                src="/logo.png"
                                alt="Soporte TI"
                                className="h-22 w-auto object-contain sm:h-28"
                            />
                        </div>

                        {/* =================================================
                            ESTADO CAJA
                        ================================================= */}

                        <div className="hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 md:flex">

                            <span className="relative flex h-2.5 w-2.5">

                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />

                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />

                            </span>

                            <span className="text-xs font-bold text-emerald-700">
                                Caja abierta
                            </span>

                        </div>

                        {/* =================================================
                            USUARIO
                        ================================================= */}

                        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1.5 shadow-sm transition-colors sm:px-2.5">
                            {/* FOTO DEL USUARIO */}
                            <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-background)] shadow-sm sm:h-9 sm:w-9"
                                title={usuario.nombre}
                            >
                                {usuario.foto_url ? (
                                    <img
                                        src={usuario.foto_url}
                                        alt={`Foto de ${usuario.nombre}`}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div
                                        className="flex h-full w-full items-center justify-center text-xs font-extrabold text-white sm:text-sm"
                                        style={{
                                            background: `linear-gradient(
                        135deg,
                        var(--color-primary),
                        var(--color-primary-hover)
                    )`,
                                        }}
                                    >
                                        {inicialUsuario}
                                    </div>
                                )}
                            </div>

                            {/* INFORMACIÓN DEL USUARIO */}
                            <div className="hidden min-w-0 sm:block">
                                <p className="max-w-[130px] truncate text-xs font-bold text-[var(--color-text)]">
                                    {usuario.nombre}
                                </p>

                                <p className="mt-0.5 text-[10px] font-semibold capitalize text-[var(--color-text-secondary)]">
                                    {usuario.rol}
                                </p>
                            </div>
                        </div>

                        {/* =================================================
                            BOTÓN MENÚ MÓVIL
                        ================================================= */}

                        <button
                            type="button"
                            onClick={() =>
                                setMenuMovilAbierto(
                                    (actual) => !actual
                                )
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-lg shadow-sm transition hover:bg-slate-50 active:scale-95 lg:hidden"
                            aria-label="Abrir menú"
                        >
                            {menuMovilAbierto
                                ? "✕"
                                : "☰"}
                        </button>

                    </div>

                </div>

            </header>

            {/* =====================================================
                MENÚ MÓVIL DESPLEGABLE
            ===================================================== */}

            {menuMovilAbierto && (
                <div className="fixed inset-x-0 top-[68px] z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl sm:top-[72px] lg:hidden">

                    <div className="max-h-[calc(100vh-68px)] overflow-y-auto p-3 pb-24 sm:max-h-[calc(100vh-72px)] sm:p-4 sm:pb-24">

                        <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">

                            <div className="flex items-center gap-3">

                                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">

                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

                                </span>

                                <div>

                                    <p className="text-xs font-bold text-emerald-800">
                                        Caja abierta
                                    </p>

                                    <p className="mt-0.5 text-[10px] font-medium text-emerald-600">
                                        Sistema listo para operar
                                    </p>

                                </div>

                            </div>

                        </div>

                        <div className="space-y-1">

                            {menuPrincipal.map((item) => {

                                const activo =
                                    rutaActiva(
                                        item.ruta
                                    );

                                const esCerrarCaja =
                                    item.ruta ===
                                    "/pos/sistema/cerrar";

                                return (
                                    <button
                                        key={item.ruta}
                                        type="button"
                                        onClick={() => {
                                            router.push(
                                                item.ruta
                                            );

                                            setMenuMovilAbierto(
                                                false
                                            );
                                        }}
                                        className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition active:scale-[0.99] ${activo
                                            ? esCerrarCaja
                                                ? "bg-red-600 text-white shadow-sm"
                                                : "bg-[var(--color-primary)] text-white shadow-sm"
                                            : esCerrarCaja
                                                ? "text-red-600 hover:bg-red-50"
                                                : "text-[var(--color-text-secondary)] hover:bg-slate-100 hover:text-[var(--color-text)]"
                                            }`}
                                    >

                                        <span
                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${activo
                                                ? "bg-white/15"
                                                : esCerrarCaja
                                                    ? "bg-red-50"
                                                    : "bg-slate-100"
                                                }`}
                                        >
                                            {item.icono}
                                        </span>

                                        <span>
                                            {item.nombre}
                                        </span>

                                    </button>
                                );
                            })}

                        </div>

                        <div className="my-3 h-px bg-[var(--color-border)]" />

                        <button
                            type="button"
                            onClick={cerrarSesion}
                            disabled={cerrandoSesion}
                            className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                        >

                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-lg">
                                🚪
                            </span>

                            <span>
                                {cerrandoSesion
                                    ? "Cerrando sesión..."
                                    : "Cerrar sesión"}
                            </span>

                        </button>

                    </div>

                </div>
            )}

            {/* =====================================================
                ESTRUCTURA PRINCIPAL
            ===================================================== */}

            <div className="mx-auto flex min-h-[calc(100vh-68px)] max-w-[1900px] sm:min-h-[calc(100vh-72px)]">

                {/* =================================================
                    SIDEBAR DESKTOP
                ================================================= */}

                <aside className="hidden w-[220px] shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:block xl:w-[240px]">

                    <div className="sticky top-[68px] flex h-[calc(100vh-68px)] flex-col xl:top-[72px] xl:h-[calc(100vh-72px)]">

                        {/* NAVEGACIÓN */}

                        <nav className="flex-1 overflow-y-auto p-3 xl:p-4">

                            <p className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                                Operación
                            </p>

                            <div className="space-y-1">

                                {menuPrincipal
                                    .filter(
                                        (item) =>
                                            item.grupo ===
                                            "Operación"
                                    )
                                    .map((item) => {

                                        const activo =
                                            rutaActiva(
                                                item.ruta
                                            );

                                        return (
                                            <button
                                                key={item.ruta}
                                                type="button"
                                                onClick={() =>
                                                    router.push(
                                                        item.ruta
                                                    )
                                                }
                                                className={`group flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition ${activo
                                                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                                                    : "text-[var(--color-text-secondary)] hover:bg-slate-100 hover:text-[var(--color-text)]"
                                                    }`}
                                            >

                                                <span
                                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${activo
                                                        ? "bg-white/15"
                                                        : "bg-slate-100 group-hover:bg-white"
                                                        }`}
                                                >
                                                    {item.icono}
                                                </span>

                                                <span className="truncate">
                                                    {item.nombre}
                                                </span>

                                            </button>
                                        );
                                    })}

                            </div>

                            <p className="mb-3 mt-7 px-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                                Caja
                            </p>

                            <div className="space-y-1">

                                {menuPrincipal
                                    .filter(
                                        (item) =>
                                            item.grupo ===
                                            "Caja"
                                    )
                                    .map((item) => {

                                        const activo =
                                            rutaActiva(
                                                item.ruta
                                            );

                                        const esCerrarCaja =
                                            item.ruta ===
                                            "/pos/sistema/cerrar";

                                        return (
                                            <button
                                                key={item.ruta}
                                                type="button"
                                                onClick={() =>
                                                    router.push(
                                                        item.ruta
                                                    )
                                                }
                                                className={`group flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition ${activo
                                                    ? esCerrarCaja
                                                        ? "bg-red-600 text-white shadow-sm"
                                                        : "bg-[var(--color-primary)] text-white shadow-sm"
                                                    : esCerrarCaja
                                                        ? "text-red-600 hover:bg-red-50"
                                                        : "text-[var(--color-text-secondary)] hover:bg-slate-100 hover:text-[var(--color-text)]"
                                                    }`}
                                            >

                                                <span
                                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${activo
                                                        ? "bg-white/15"
                                                        : esCerrarCaja
                                                            ? "bg-red-50 group-hover:bg-red-100"
                                                            : "bg-slate-100 group-hover:bg-white"
                                                        }`}
                                                >
                                                    {item.icono}
                                                </span>

                                                <span className="truncate">
                                                    {item.nombre}
                                                </span>

                                            </button>
                                        );
                                    })}

                            </div>

                            <p className="mb-3 mt-7 px-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                                Sistema
                            </p>

                            <div className="space-y-1">

                                {menuPrincipal
                                    .filter(
                                        (item) =>
                                            item.grupo ===
                                            "Sistema"
                                    )
                                    .map((item) => {

                                        const activo =
                                            rutaActiva(
                                                item.ruta
                                            );

                                        return (
                                            <button
                                                key={item.ruta}
                                                type="button"
                                                onClick={() =>
                                                    router.push(
                                                        item.ruta
                                                    )
                                                }
                                                className={`group flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition ${activo
                                                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                                                    : "text-[var(--color-text-secondary)] hover:bg-slate-100 hover:text-[var(--color-text)]"
                                                    }`}
                                            >

                                                <span
                                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${activo
                                                        ? "bg-white/15"
                                                        : "bg-slate-100 group-hover:bg-white"
                                                        }`}
                                                >
                                                    {item.icono}
                                                </span>

                                                <span className="truncate">
                                                    {item.nombre}
                                                </span>

                                            </button>
                                        );
                                    })}

                            </div>

                        </nav>

                        {/* =================================================
                            PARTE INFERIOR SIDEBAR
                        ================================================= */}

                        <div className="border-t border-[var(--color-border)] p-3 xl:p-4">

                            {/* INFORMACIÓN DEL SISTEMA */}

                            <div className="mb-3 rounded-xl bg-slate-50 p-3">

                                <div className="flex items-center gap-2">

                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm shadow-sm">
                                        🏪
                                    </span>

                                    <div className="min-w-0">

                                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                                            Sistema
                                        </p>

                                        <p className="truncate text-xs font-bold text-[var(--color-text)]">
                                            Punto de Venta
                                        </p>

                                    </div>

                                </div>

                                <div className="mt-3 flex items-center gap-1.5">

                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                                    <span className="text-[10px] font-semibold text-emerald-700">
                                        Sesión activa
                                    </span>

                                </div>

                            </div>

                            {/* CERRAR SESIÓN */}

                            <button
                                type="button"
                                onClick={cerrarSesion}
                                disabled={cerrandoSesion}
                                className="group flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >

                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-base transition group-hover:bg-red-100">
                                    🚪
                                </span>

                                <span>
                                    {cerrandoSesion
                                        ? "Cerrando..."
                                        : "Cerrar sesión"}
                                </span>

                            </button>

                        </div>

                    </div>

                </aside>

                {/* =================================================
                    CONTENIDO PRINCIPAL
                ================================================= */}

                <main className="min-w-0 flex-1">

                    <div className="min-h-full p-3 pb-24 sm:p-5 sm:pb-24 md:p-6 md:pb-24 lg:p-7 lg:pb-7 xl:p-8">
                        {children}
                    </div>

                </main>

            </div>

            {/* =====================================================
                NAVEGACIÓN INFERIOR MÓVIL
            ===================================================== */}

            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">

                <nav className="mx-auto flex h-[68px] max-w-2xl items-stretch px-1 pb-[env(safe-area-inset-bottom)]">

                    {menuPrincipal
                        .filter(
                            (item) =>
                                item.ruta !==
                                "/pos/sistema/cerrar"
                        )
                        .slice(0, 4)
                        .map((item) => {

                            const activo =
                                rutaActiva(
                                    item.ruta
                                );

                            return (
                                <button
                                    key={item.ruta}
                                    type="button"
                                    onClick={() =>
                                        router.push(
                                            item.ruta
                                        )
                                    }
                                    className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition active:scale-95 ${activo
                                        ? "text-[var(--color-primary)]"
                                        : "text-[var(--color-text-secondary)]"
                                        }`}
                                >

                                    <span
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition ${activo
                                            ? "bg-[var(--color-primary)]/10"
                                            : ""
                                            }`}
                                    >
                                        {item.icono}
                                    </span>

                                    <span className="max-w-full truncate text-[9px] font-bold sm:text-[10px]">
                                        {item.corto}
                                    </span>

                                </button>
                            );
                        })}

                    {/* MÁS */}

                    <button
                        type="button"
                        onClick={() =>
                            setMenuMovilAbierto(
                                true
                            )
                        }
                        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[var(--color-text-secondary)] transition active:scale-95"
                    >

                        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base">
                            ☰
                        </span>

                        <span className="text-[9px] font-bold sm:text-[10px]">
                            Más
                        </span>

                    </button>

                </nav>

            </div>

        </div>
    );
}