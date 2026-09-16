import { supabaseAdmin } from "./supabase";

export interface UsuarioActual {
    id: string;
    auth_user_id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
    activo: boolean;
}

/*
 * ==========================================
 * OBTENER USUARIO ACTUAL - ADMIN
 * ==========================================
 */
export async function obtenerUsuarioActual(): Promise<UsuarioActual | null> {

    /*
     * ========================================
     * 1. OBTENER USUARIO DE SUPABASE AUTH
     * ========================================
     */

    const {
        data: { user },
        error: authError,
    } = await supabaseAdmin.auth.getUser();


    if (authError) {
        console.error(
            "❌ Error obteniendo usuario ADMIN:",
            authError
        );

        return null;
    }

    if (!user) {
        console.error(
            "❌ No existe usuario autenticado en ADMIN."
        );

        return null;
    }


    /*
     * ========================================
     * 2. BUSCAR USUARIO EN public.usuarios
     * ========================================
     */

    const {
        data,
        error,
    } = await supabaseAdmin
        .from("usuarios")
        .select(`
            id,
            auth_user_id,
            negocio_id,
            nombre,
            rol,
            activo,
            negocios (
                id,
                nombre,
                tipo_negocio,
                logo_url
            )
        `)
        .eq(
            "auth_user_id",
            user.id
        )
        .eq(
            "activo",
            true
        )
        .maybeSingle();



    if (error) {
        console.error(
            "❌ Error obteniendo usuario ADMIN desde public.usuarios:",
            error
        );

        return null;
    }

    if (!data) {
        console.error(
            "❌ El usuario Auth existe pero no existe en public.usuarios."
        );

        return null;
    }

    if (!data.negocio_id) {
        console.error(
            "❌ El usuario ADMIN no tiene negocio_id."
        );

        return null;
    }

    return {
        id: data.id,
        auth_user_id: data.auth_user_id,
        negocio_id: data.negocio_id,
        nombre: data.nombre,
        rol: data.rol,
        activo: data.activo,
    };
}