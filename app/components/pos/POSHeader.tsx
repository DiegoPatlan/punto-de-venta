"use client";

interface POSHeaderProps {
    negocioNombre?: string;
    cajaNombre: string;
    sucursalNombre: string;
    usuarioNombre: string;
    usuarioRol: string;
}

export default function POSHeader({
    negocioNombre = "Mi negocio",
    cajaNombre,
    sucursalNombre,
    usuarioNombre,
    usuarioRol,
}: POSHeaderProps) {
    return (
        <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6">
                {/* IZQUIERDA */}
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-lg text-white shadow-sm">
                        🏪
                    </div>

                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--color-text)]">
                            {negocioNombre}
                        </p>

                        <p className="truncate text-xs text-[var(--color-text-secondary)]">
                            {cajaNombre} • {sucursalNombre}
                        </p>
                    </div>
                </div>

                {/* DERECHA */}
                <div className="flex items-center gap-3">
                    {/* ESTADO CAJA */}
                    <div className="hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 sm:flex">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />

                        <span className="text-xs font-semibold text-emerald-700">
                            Caja abierta
                        </span>
                    </div>

                    {/* USUARIO */}
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-[var(--color-text)]">
                            {usuarioNombre
                                ?.charAt(0)
                                .toUpperCase()}
                        </div>

                        <div className="hidden sm:block">
                            <p className="text-xs font-bold text-[var(--color-text)]">
                                {usuarioNombre}
                            </p>

                            <p className="text-[11px] capitalize text-[var(--color-text-secondary)]">
                                {usuarioRol}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
