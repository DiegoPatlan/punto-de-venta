interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "small" | "medium" | "large";
}

export default function Button({
    children,
    variant = "primary",
    size = "medium",
    className = "",
    ...props
}: ButtonProps) {
    const variants = {
        primary:
            "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]",

        secondary:
            "bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-background)]",

        danger:
            "bg-[var(--color-danger)] text-white hover:bg-red-700",

        ghost:
            "bg-transparent text-[var(--color-text)] hover:bg-[var(--color-background)]",
    };

    const sizes = {
        small: "px-3 py-2 text-sm",
        medium: "px-4 py-3 text-sm",
        large: "px-5 py-3.5 text-base",
    };

    return (
        <button
            {...props}
            className={`
                rounded-xl
                font-semibold
                transition
                duration-200
                active:scale-[0.98]
                disabled:cursor-not-allowed
                disabled:opacity-50
                ${variants[variant]}
                ${sizes[size]}
                ${className}
            `}
        >
            {children}
        </button>
    );
}