"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "../../../lib/supabase";
import Logo from "../../components/Logo";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ModalMensaje from "../../components/ModalMensaje";

export default function RecuperarContrasenaPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [cargando, setCargando] = useState(false);

    const [modal, setModal] = useState({
        abierto: false,
        tipo: "info" as "exito" | "error" | "confirmacion" | "info",
        titulo: "",
        mensaje: "",
    });

    function mostrarModal(
        tipo: "exito" | "error" | "confirmacion" | "info",
        titulo: string,
        mensaje: string
    ) {
        setModal({
            abierto: true,
            tipo,
            titulo,
            mensaje,
        });
    }

    function cerrarModal() {
        setModal((prev) => ({
            ...prev,
            abierto: false,
        }));
    }

    async function solicitarRecuperacion(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (cargando) return;

        const correo = email.trim().toLowerCase();

        if (!correo) {
            mostrarModal(
                "error",
                "Correo requerido",
                "Escribe el correo electrónico de tu cuenta."
            );
            return;
        }

        setCargando(true);

        try {
            const redirectTo =
                `${window.location.origin}/admin/restablecer-contrasena`;

            const { error } = await supabase.auth.resetPasswordForEmail(
                correo,
                {
                    redirectTo,
                }
            );

            if (error) {
                console.error(
                    "Error al solicitar recuperación:",
                    error
                );

                mostrarModal(
                    "error",
                    "No se pudo enviar",
                    "No fue posible procesar la solicitud. Verifica el correo e inténtalo nuevamente."
                );

                return;
            }

            mostrarModal(
                "exito",
                "Solicitud enviada",
                "Si existe una cuenta asociada a ese correo, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de correo no deseado."
            );
        } catch (error) {
            console.error(
                "Error inesperado al solicitar recuperación:",
                error
            );

            mostrarModal(
                "error",
                "Error inesperado",
                "Ocurrió un problema al solicitar el restablecimiento de contraseña. Inténtalo nuevamente."
            );
        } finally {
            setCargando(false);
        }
    }

    return (
        <main className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md">
                <div className="mt-4 flex justify-center">
                    <img
                        src="/logo.png"
                        alt="Soporte TI"
                        className="h-55 w-auto object-contain"
                    />
                </div>

                <Card className="p-6 sm:p-8">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-[var(--color-text)]">
                            Recuperar contraseña
                        </h1>

                        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                            Escribe el correo electrónico de tu cuenta y te
                            enviaremos un enlace para crear una nueva
                            contraseña.
                        </p>
                    </div>

                    <form
                        onSubmit={solicitarRecuperacion}
                        className="space-y-5"
                    >
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-medium text-[var(--color-text)]"
                            >
                                Correo electrónico
                            </label>

                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="correo@ejemplo.com"
                                disabled={cargando}
                                className="
                                    w-full
                                    rounded-xl
                                    border
                                    border-[var(--color-border)]
                                    bg-[var(--color-surface)]
                                    px-4
                                    py-3
                                    text-[var(--color-text)]
                                    outline-none
                                    transition
                                    placeholder:text-[var(--color-text-secondary)]
                                    focus:border-[var(--color-primary)]
                                    focus:ring-2
                                    focus:ring-[var(--color-primary)]/20
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                "
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={cargando}
                            className="w-full"
                        >
                            {cargando
                                ? "Enviando..."
                                : "Enviar enlace de recuperación"}
                        </Button>

                        <button
                            type="button"
                            onClick={() => router.push("/admin/login")}
                            disabled={cargando}
                            className="
                                w-full
                                text-sm
                                font-medium
                                text-[var(--color-primary)]
                                transition
                                hover:underline
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                            "
                        >
                            Volver al inicio de sesión
                        </button>
                    </form>
                </Card>
            </div>

            <ModalMensaje
                abierto={modal.abierto}
                tipo={modal.tipo}
                titulo={modal.titulo}
                mensaje={modal.mensaje}
                textoBoton="Aceptar"
                onCerrar={cerrarModal}
            />
        </main>
    );
}