"use client";

interface POSSidebarProps {
    moduloActivo: string;
    onCambiarModulo: (modulo: string) => void;
    onSalir: () => void;
}

const opciones = [
    {
        id: "venta",
        nombre: "Venta",
        icono: "🛒",
    },
    {
        id: "productos",
        nombre: "Productos",
        icono: "📦",
    },
    {
        id: "devoluciones",
        nombre: "Devoluciones",
        icono: "↩️",
    },
    {
        id: "caja",
        nombre: "Caja",
        icono: "💰",
    },
    {
        id: "corte",
        nombre: "Corte",
        icono: "📊",
    },
    {
        id: "configuracion",
        nombre: "Configuración",
        icono: "⚙️",
    },
];

export default function POSSidebar({
    moduloActivo,
    onCambiarModulo,
    onSalir,
}: POSSidebarProps) {
    return (
        <>
            {/* SIDEBAR DESKTOP */}
            <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex lg:min-h-[calc(100vh-4rem)] lg:flex-col">
                <nav className="flex-1 space-y-1 p-3">
                    {opciones.map((opcion) => {
                        const activo =
                            moduloActivo === opcion.id;

                        return (
                            <button
                                key={opcion.id}
                                type="button"
                                onClick={() =>
                                    onCambiarModulo(
                                        opcion.id
                                    )
                                }
                                className={`flex w - full items - center gap - 3 rounded - xl px - 4 py - 3 text - left text - sm font - semibold transition ${activo
                                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                                        : "text-[var(--color-text-secondary)] hover:bg-slate-100 hover:text-[var(--color-text)]"
                                    } `}
                            >
                                <span className="text-lg">
                                    {opcion.icono}
                                </span>

                                <span>
                                    {opcion.nombre}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                {/* SALIR */}
                <div className="border-t border-[var(--color-border)] p-3">
                    <button
                        type="button"
                        onClick={onSalir}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                        <span className="text-lg">
                            🚪
                        </span>

                        <span>Salir</span>
                    </button>
                </div>
            </aside>

            {/* NAVEGACIÓN MÓVIL */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface)] lg:hidden">
                <div className="grid grid-cols-5">
                    {opciones
                        .slice(0, 4)
                        .map((opcion) => {
                            const activo =
                                moduloActivo ===
                                opcion.id;

                            return (
                                <button
                                    key={opcion.id}
                                    type="button"
                                    onClick={() =>
                                        onCambiarModulo(
                                            opcion.id
                                        )
                                    }
                                    className={`flex min - h - 16 flex - col items - center justify - center gap - 1 text - [11px] font - semibold transition ${activo
                                            ? "text-[var(--color-primary)]"
                                            : "text-[var(--color-text-secondary)]"
                                        } `}
                                >
                                    <span className="text-lg">
                                        {
                                            opcion.icono
                                        }
                                    </span>

                                    <span>
                                        {
                                            opcion.nombre
                                        }
                                    </span>
                                </button>
                            );
                        })}

                    {/* MÁS */}
                    <button
                        type="button"
                        onClick={() =>
                            onCambiarModulo(
                                "configuracion"
                            )
                        }
                        className={`flex min - h - 16 flex - col items - center justify - center gap - 1 text - [11px] font - semibold ${moduloActivo ===
                                "configuracion"
                                ? "text-[var(--color-primary)]"
                                : "text-[var(--color-text-secondary)]"
                            } `}
                    >
                        <span className="text-lg">
                            ☰
                        </span>

                        <span>Más</span>
                    </button>
                </div>
            </nav>
        </>
    );
}
