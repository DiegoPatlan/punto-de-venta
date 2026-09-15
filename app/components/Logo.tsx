interface LogoProps {
    size?: "small" | "medium" | "large";
    showText?: boolean;
    onlyImage?: boolean;
}

export default function Logo({
    size = "medium",
    showText = true,
    onlyImage = false,
}: LogoProps) {
    const sizes = {
        small: {
            box: "h-8 w-8",
            text: "text-sm",
            image: "h-8 w-auto",
        },
        medium: {
            box: "h-10 w-10",
            text: "text-base",
            image: "h-10 w-auto",
        },
        large: {
            box: "h-14 w-14",
            text: "text-xl",
            image: "h-16 w-auto",
        },
    };

    const current = sizes[size];

    // Mostrar únicamente el logo de Soporte TI
    if (onlyImage) {
        return (
            <img
                src="/logo.png"
                alt="Soporte TI"
                className={`${current.image} object - contain`}
            />
        );
    }

    return (
        <div className="flex items-center gap-3">
            <div
                className={`${current.box} flex items - center justify - center rounded - xl bg - [var(--color - primary)]text - white font - bold shadow - sm`}
            >
                ST
            </div>

            {showText && (
                <div>
                    <div
                        className={`${current.text} font - bold tracking - tight`}
                    >
                        Punto de Venta
                    </div>

                    <img
                        src="/logo.png"
                        alt="Soporte TI"
                        className="h-8 w-auto object-contain"
                    />
                </div>
            )}
        </div>
    );
}