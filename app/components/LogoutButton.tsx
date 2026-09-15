"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseAdmin } from "../../lib/supabase";
import Button from "./Button";

export default function LogoutButton() {
    const router = useRouter();
    const [cargando, setCargando] = useState(false);

    async function cerrarSesion() {
        if (cargando) return;

        setCargando(true);

        try {
            // Cerrar COMPLETAMENTE la sesión administrativa
            await supabaseAdmin.auth.signOut({
                scope: "local",
            });

            // Limpiar cualquier dato relacionado con la sesión admin
            if (typeof window !== "undefined") {
                localStorage.removeItem("pos-admin-auth");
            }

            // Ir directamente al login administrativo
            window.location.replace("/admin/login");
        } catch (error) {
            console.error("❌ Error al cerrar sesión ADMIN:", error);

            // Aunque exista un error, sacar al usuario del panel
            window.location.replace("/admin/login");
        }
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={cerrarSesion}
            disabled={cargando}
            className="w-full justify-start text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger-hover)]"
        >
            {cargando
                ? "Cerrando sesión..."
                : "Cerrar sesión"}
        </Button>
    );
}
