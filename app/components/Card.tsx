interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export default function Card({
    children,
    className = "",
}: CardProps) {
    return (
        <div
            className={`
                rounded-2xl
                border
                border-[var(--color-border)]
                bg-[var(--color-surface)]
                shadow-[var(--shadow-sm)]
                p-6
                ${className}
            `}
        >
            {children}
        </div>
    );
}