"use client";

import { useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { obtenerUsuarioActual } from "../../lib/auth/roleGuard";

import { supabase } from "../../lib/supabase";

import BusinessHeader from "../components/BusinessHeader";

import LogoutButton from "../components/LogoutButton";

import ThemeProvider from "../components/ThemeProvider";

import Logo from "../components/Logo";

interface UsuarioActual {
    id: string;
    nombre: string;
    rol: string;
    negocio_id: string;
    foto_url: string | null;
    negocios: {
        id: string;
        nombre: string;
        tipo_negocio: string | null;
        logo_url: string | null;
        activo: boolean;
    } | null;
}

interface MenuItem {
    nombre: string;
    ruta: string;
    icono: string;
}

const menuPrincipal: MenuItem[] = [
    {
        nombre: "Dashboard",
        ruta: "/admin",
        icono: "📊",
    },
    {
        nombre: "Ventas",
        ruta: "/admin/ventas",
        icono: "💰",
    },
    {
        nombre: "Productos",
        ruta: "/admin/productos",
        icono: "📦",
    },
    {
        nombre: "Categorías",
        ruta: "/admin/categorias",
        icono: "🏷️",
    },
    {
        nombre: "Inventario",
        ruta: "/admin/inventario",
        icono: "📋",
    },
    {
        nombre: "Movimientos Inventario",
        ruta: "/admin/movimientos",
        icono: "📈",
    },
    {
        nombre: "Cajas ",
        ruta: "/admin/cajas",
        icono: "💵",
    },
    {
        nombre: "Compras",
        ruta: "/admin/compras",
        icono: "🛒",
    },
    {
        nombre: "Gastos",
        ruta: "/admin/gastos",
        icono: "🧾",
    },
    {
        nombre: "Cuentas por Pagar",
        ruta: "/admin/cuentas-por-pagar",
        icono: "💳",
    },
    {
        nombre: "Clientes",
        ruta: "/admin/clientes",
        icono: "👥",
    },
    {
        nombre: "Proveedores",
        ruta: "/admin/proveedores",
        icono: "🚚",
    },
    {
        nombre: "Traspasos",
        ruta: "/admin/traspasos",
        icono: "🔄",
    },
    {
        nombre: "Devoluciones",
        ruta: "/admin/devoluciones",
        icono: "↩️",
    },
];

const menuAdministracion: MenuItem[] = [
    {
        nombre: "Sucursales",
        ruta: "/admin/sucursales",
        icono: "🏢",
    },
    {
        nombre: "Usuarios",
        ruta: "/admin/usuarios",
        icono: "👤",
    },
    {
        nombre: "Reportes",
        ruta: "/admin/reportes",
        icono: "📈",
    },
    {
        nombre: "Configuración",
        ruta: "/admin/configuracion",
        icono: "⚙️",
    },
];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const [usuario, setUsuario] =
        useState<UsuarioActual | null>(null);

    const [cargando, setCargando] = useState(true);

    const [menuAbierto, setMenuAbierto] = useState(false);

    /*
     * =====================================================
     * RUTAS PÚBLICAS
     * =====================================================
     *
     * Estas páginas no necesitan que exista una sesión
     * administrativa para poder mostrarse.
     *
     * Login:
     * /admin/login
     *
     * Recuperación:
     * /admin/recuperar-contrasena
     *
     * Restablecimiento:
     * /admin/restablecer-contrasena
     *
     * La página de restablecimiento se encarga de validar
     * que exista una sesión válida de recuperación.
     */
    const rutaPublica =
        pathname === "/admin/login" ||
        pathname === "/admin/recuperar-contrasena" ||
        pathname === "/admin/restablecer-contrasena";

    /*
     * =====================================================
     * CARGAR USUARIO + FOTO
     * =====================================================
     */
    async function cargarUsuarioConFoto(
        datos: any
    ): Promise<UsuarioActual | null> {
        if (!datos) {
            return null;
        }

        try {
            const { data: fotoData, error: fotoError } =
                await supabase
                    .from("usuarios")
                    .select("foto_url")
                    .eq("id", datos.id)
                    .maybeSingle();

            if (fotoError) {
                console.error(
                    "Error cargando foto del usuario:",
                    fotoError
                );
            }

            return {
                ...(datos as UsuarioActual),
                foto_url: fotoData?.foto_url ?? null,
            };
        } catch (error) {
            console.error(
                "Error obteniendo foto del usuario:",
                error
            );

            return {
                ...(datos as UsuarioActual),
                foto_url: null,
            };
        }
    }

    /*
     * =====================================================
     * CARGAR USUARIO INICIAL
     * =====================================================
     */
    useEffect(() => {
        async function cargarUsuario() {
            /*
             * Las rutas públicas no necesitan usuario.
             *
             * IMPORTANTE:
             * No intentamos ejecutar obtenerUsuarioActual()
             * en recuperación/restablecimiento cuando todavía
             * no existe una sesión administrativa normal.
             */
            if (rutaPublica) {
                setUsuario(null);
                setCargando(false);
                return;
            }

            try {
                const datos = await obtenerUsuarioActual();

                if (!datos) {
                    setUsuario(null);
                    return;
                }

                const usuarioCompleto =
                    await cargarUsuarioConFoto(datos);

                setUsuario(usuarioCompleto);
            } catch (error) {
                console.error(
                    "Error cargando usuario:",
                    error
                );

                setUsuario(null);
            } finally {
                setCargando(false);
            }
        }

        cargarUsuario();
    }, [rutaPublica]);

    /*
     * =====================================================
     * CERRAR MENÚ MÓVIL CUANDO CAMBIA LA PÁGINA
     * + VERIFICAR SESIÓN Y ROL
     * =====================================================
     */
    useEffect(() => {
        async function cargarUsuario() {
            /*
             * Las rutas públicas no necesitan usuario.
             */
            if (rutaPublica) {
                setUsuario(null);
                setCargando(false);
                setMenuAbierto(false);
                return;
            }

            /*
             * Cerrar menú móvil cuando cambia la página.
             */
            setMenuAbierto(false);

            try {
                const datos = await obtenerUsuarioActual();

                if (!datos) {
                    console.log(
                        "🔒 No hay sesión administrativa. Redirigiendo al login..."
                    );

                    setUsuario(null);

                    window.location.replace(
                        "/admin/login"
                    );

                    return;
                }

                /*
                 * Seguridad adicional:
                 *
                 * SOLO ADMIN puede permanecer dentro
                 * del panel administrativo.
                 */
                if (datos.rol !== "admin") {
                    console.log(
                        `🚫 Rol ${datos.rol} sin acceso al panel administrativo.`
                    );

                    setUsuario(null);

                    window.location.replace(
                        "/admin/login"
                    );

                    return;
                }

                const usuarioCompleto =
                    await cargarUsuarioConFoto(datos);

                setUsuario(usuarioCompleto);
            } catch (error) {
                console.error(
                    "❌ Error cargando usuario:",
                    error
                );

                setUsuario(null);

                window.location.replace(
                    "/admin/login"
                );
            } finally {
                setCargando(false);
            }
        }

        cargarUsuario();
    }, [pathname, rutaPublica]);

    /*
     * =====================================================
     * ESCUCHAR CAMBIOS DE FOTO
     * =====================================================
     *
     * La página de configuración enviará este evento
     * después de subir o eliminar la foto.
     *
     * Así el avatar cambia inmediatamente sin recargar.
     */
    useEffect(() => {
        function manejarFotoActualizada(
            event: Event
        ) {
            const evento =
                event as CustomEvent<{
                    foto_url?: string | null;
                }>;

            const nuevaFoto =
                evento.detail?.foto_url ?? null;

            setUsuario((actual) => {
                if (!actual) {
                    return actual;
                }

                return {
                    ...actual,
                    foto_url: nuevaFoto,
                };
            });
        }

        window.addEventListener(
            "usuario-foto-actualizada",
            manejarFotoActualizada
        );

        return () => {
            window.removeEventListener(
                "usuario-foto-actualizada",
                manejarFotoActualizada
            );
        };
    }, []);

    /*
     * =====================================================
     * PÁGINAS PÚBLICAS SIN DASHBOARD
     * =====================================================
     */
    if (rutaPublica) {
        return <>{children}</>;
    }

    /*
     * =====================================================
     * CARGANDO USUARIO
     * =====================================================
     */
    if (cargando) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl shadow-sm">
                        🏪
                    </div>

                    <p className="text-sm font-semibold text-[var(--color-text)]">
                        Cargando sistema...
                    </p>

                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Preparando tu panel de administración
                    </p>
                </div>
            </div>
        );
    }

    /*
     * =====================================================
     * USUARIO O NEGOCIO NO ENCONTRADO
     * =====================================================
     */
    if (!usuario || !usuario.negocios) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl shadow-sm">
                        🔐
                    </div>

                    <p className="text-sm font-semibold text-[var(--color-text)]">
                        Verificando sesión...
                    </p>

                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Redirigiendo al acceso administrativo
                    </p>
                </div>
            </div>
        );
    }

    const negocio = usuario.negocios;

    /*
     * =====================================================
     * DETERMINAR SI UNA RUTA ESTÁ ACTIVA
     * =====================================================
     */
    function estaActivo(ruta: string) {
        if (ruta === "/admin") {
            return pathname === "/admin";
        }

        return (
            pathname === ruta ||
            pathname.startsWith(`${ruta}/`)
        );
    }

    /*
     * =====================================================
     * RENDERIZAR ELEMENTO DEL MENÚ
     * =====================================================
     */
    function renderMenuItem(item: MenuItem) {
        const activo = estaActivo(item.ruta);

        return (
            <a
                key={item.ruta}
                href={item.ruta}
                onClick={() =>
                    setMenuAbierto(false)
                }
                className={`
                    group
                    flex
                    items-center
                    gap-3
                    rounded-xl
                    px-3
                    py-2.5
                    text-sm
                    font-semibold
                    transition-all
                    duration-150
                    ${activo
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : "text-[var(--color-text)] hover:bg-[var(--color-background)]"
                    }
                `}
            >
                {/* Icono */}
                <span
                    className={`
                        flex
                        h-9
                        w-9
                        shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        text-lg
                        transition
                        ${activo
                            ? "bg-white/15"
                            : "bg-[var(--color-background)] group-hover:bg-[var(--color-surface)]"
                        }
                    `}
                >
                    {item.icono}
                </span>

                {/* Nombre */}
                <span className="truncate">
                    {item.nombre}
                </span>

                {/* Indicador */}
                {activo && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-white" />
                )}
            </a>
        );
    }

    return (
        <ThemeProvider>
            <div className="min-h-screen bg-[var(--color-background)]">
                {/* ===================================================== */}
                {/* OVERLAY MÓVIL */}
                {/* ===================================================== */}
                {menuAbierto && (
                    <button
                        type="button"
                        aria-label="Cerrar menú"
                        onClick={() =>
                            setMenuAbierto(false)
                        }
                        className="
                            fixed
                            inset-0
                            z-40
                            bg-black/30
                            backdrop-blur-[2px]
                            lg:hidden
                        "
                    />
                )}

                {/* ===================================================== */}
                {/* SIDEBAR */}
                {/* ===================================================== */}
                <aside
                    className={`
                    fixed
                    inset-y-0
                    left-0
                    z-50
                    flex
                    w-72
                    flex-col
                    border-r
                    border-[var(--color-border)]
                    bg-[var(--color-surface)]
                    shadow-xl
                    transition-transform
                    duration-200
                    lg:translate-x-0
                    lg:shadow-none
                    ${menuAbierto
                            ? "translate-x-0"
                            : "-translate-x-full"
                        }
                `}
                >
                    {/* ================================================= */}
                    {/* ENCABEZADO DEL NEGOCIO */}
                    {/* ================================================= */}
                    <div className="border-b border-[var(--color-border)] p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                                Punto de Venta
                            </span>

                            {/* Cerrar móvil */}
                            <button
                                type="button"
                                onClick={() =>
                                    setMenuAbierto(false)
                                }
                                className="
                                    flex
                                    h-9
                                    w-9
                                    items-center
                                    justify-center
                                    rounded-lg
                                    text-lg
                                    text-[var(--color-text-secondary)]
                                    hover:bg-[var(--color-background)]
                                    lg:hidden
                                "
                                aria-label="Cerrar menú"
                            >
                                ✕
                            </button>
                        </div>

                        <BusinessHeader
                            nombre={negocio.nombre}
                            tipoNegocio={
                                negocio.tipo_negocio
                            }
                            logoUrl={
                                negocio.logo_url
                            }
                        />
                    </div>

                    {/* ================================================= */}
                    {/* NAVEGACIÓN */}
                    {/* ================================================= */}
                    <nav className="flex-1 overflow-y-auto px-3 py-4">
                        {/* Principal */}
                        <div className="mb-3 px-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                                Principal
                            </p>
                        </div>

                        <div className="space-y-1">
                            {menuPrincipal.map(
                                (item) =>
                                    renderMenuItem(item)
                            )}
                        </div>

                        {/* Administración */}
                        <div className="mb-3 mt-7 px-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                                Administración
                            </p>
                        </div>

                        <div className="space-y-1">
                            {menuAdministracion.map(
                                (item) =>
                                    renderMenuItem(item)
                            )}
                        </div>
                    </nav>

                    {/* ================================================= */}
                    {/* USUARIO */}
                    {/* ================================================= */}
                    <div className="border-t border-[var(--color-border)] p-4">
                        <div className="mb-4 flex items-center gap-3 rounded-xl bg-[var(--color-background)] p-3">
                            {/* FOTO DEL USUARIO */}
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)] font-bold text-white shadow-sm">
                                {usuario.foto_url ? (
                                    <img
                                        src={
                                            usuario.foto_url
                                        }
                                        alt={`Foto de ${usuario.nombre}`}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    usuario.nombre
                                        .charAt(0)
                                        .toUpperCase()
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                                    {usuario.nombre}
                                </p>

                                <p className="truncate text-xs capitalize text-[var(--color-text-secondary)]">
                                    {usuario.rol}
                                </p>
                            </div>
                        </div>

                        <LogoutButton />

                        <div className="mt-4 flex justify-center">
                            <Logo size="large" onlyImage />
                        </div>
                    </div>
                </aside>

                {/* ===================================================== */}
                {/* ÁREA PRINCIPAL */}
                {/* ===================================================== */}
                <div className="lg:pl-72">
                    {/* ================================================= */}
                    {/* HEADER SUPERIOR */}
                    {/* ================================================= */}
                    <header
                        className="
                            sticky
                            top-0
                            z-30
                            border-b
                            border-[var(--color-border)]
                            bg-[var(--color-surface)]/95
                            backdrop-blur
                        "
                    >
                        <div className="flex h-16 items-center px-4 sm:px-6">
                            {/* Botón menú móvil */}
                            <button
                                type="button"
                                onClick={() =>
                                    setMenuAbierto(true)
                                }
                                className="
                                    flex
                                    h-10
                                    w-10
                                    items-center
                                    justify-center
                                    rounded-xl
                                    text-xl
                                    text-[var(--color-text)]
                                    transition
                                    hover:bg-[var(--color-background)]
                                    lg:hidden
                                "
                                aria-label="Abrir menú"
                            >
                                ☰
                            </button>

                            {/* Información del negocio */}
                            <div className="ml-2 lg:ml-0">
                                <p className="text-sm font-bold text-[var(--color-text)]">
                                    {negocio.nombre}
                                </p>

                                <p className="text-xs text-[var(--color-text-secondary)]">
                                    {negocio.tipo_negocio ||
                                        "Punto de Venta"}
                                </p>
                            </div>

                            {/* Usuario */}
                            <div className="ml-auto flex items-center gap-3">
                                <div className="hidden text-right sm:block">
                                    <p className="text-sm font-semibold text-[var(--color-text)]">
                                        {usuario.nombre}
                                    </p>

                                    <p className="text-xs capitalize text-[var(--color-text-secondary)]">
                                        {usuario.rol}
                                    </p>
                                </div>

                                {/* FOTO DEL USUARIO */}
                                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)] font-bold text-white shadow-sm">
                                    {usuario.foto_url ? (
                                        <img
                                            src={
                                                usuario.foto_url
                                            }
                                            alt={`Foto de ${usuario.nombre}`}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        usuario.nombre
                                            .charAt(0)
                                            .toUpperCase()
                                    )}
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* ================================================= */}
                    {/* CONTENIDO */}
                    {/* ================================================= */}
                    <main className="p-4 sm:p-6 lg:p-8">
                        <div className="mx-auto w-full max-w-7xl">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </ThemeProvider>
    );
}