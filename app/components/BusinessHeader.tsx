interface BusinessHeaderProps {
    nombre: string;
    tipoNegocio?: string | null;
    logoUrl?: string | null;
}

export default function BusinessHeader({
    nombre,
    tipoNegocio,
    logoUrl,
}: BusinessHeaderProps) {
    return (
        <header className="flex items-center gap-3">
            {/* Logo */}
            <div
                className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-xl
                    bg-[var(--color-primary)]
                    text-lg
                    font-bold
                    text-white
                "
            >
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={`Logo de ${nombre}`}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    nombre.charAt(0).toUpperCase()
                )}
            </div>

            {/* Información */}
            <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-[var(--color-text)]">
                    {nombre}
                </h1>

                {tipoNegocio && (
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">
                        {tipoNegocio}
                    </p>
                )}
            </div>
        </header>
    );
}