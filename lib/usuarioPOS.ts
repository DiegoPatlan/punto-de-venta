import { supabasePOS } from "./supabase";

export interface NegocioPOS {
    id: string;

    nombre: string;

    tipo_negocio: string | null;

    logo_url: string | null;
}

export interface UsuarioPOS {
    id: string;
    auth_user_id: string;
    negocio_id: string | null;
    nombre: string;
    rol: string;
    activo: boolean;
    foto_url: string | null;
    negocio: NegocioPOS;
}

/*
 * ==========================================
 * OBTENER USUARIO ACTUAL - POS
 * ==========================================
 */

export async function obtenerUsuarioPOS(): Promise<UsuarioPOS | null> {
    console.log(
        "=========================================="
    );

    console.log(
        "👤 OBTENER USUARIO ACTUAL - POS"
    );

    console.log(
        "=========================================="
    );

    /*
     * ========================================
     * 1. OBTENER USUARIO DE SUPABASE AUTH
     * ========================================
     */

    const {
        data: { user },
        error: authError,
    } = await supabasePOS.auth.getUser();

    console.log(
        "👤 Usuario Auth POS:",
        user
    );

    console.log(
        "❌ Error Auth POS:",
        authError
    );

    if (authError) {
        console.error(
            "❌ Error obteniendo usuario POS:",
            authError
        );

        return null;
    }

    if (!user) {
        console.error(
            "❌ No existe usuario autenticado en POS."
        );

        return null;
    }

    console.log(
        "✅ Usuario POS autenticado:",
        user.id
    );

    /*
     * ========================================
     * 2. BUSCAR USUARIO EN public.usuarios
     * ========================================
     */

    const {
        data,
        error,
    } = await supabasePOS
        .from("usuarios")
        .select(`
            id,
            auth_user_id,
            negocio_id,
            nombre,
            rol,
            activo,
            foto_url,
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

    console.log(
        "👤 Usuario POS encontrado:",
        data
    );

    console.log(
        "❌ Error consultando usuario POS:",
        error
    );

    if (error) {
        console.error(
            "❌ Error obteniendo usuario POS desde public.usuarios:",
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
            "❌ El usuario POS no tiene negocio_id."
        );

        return null;
    }

    /*
     * ========================================
     * 3. PROCESAR NEGOCIO
     * ========================================
     */

    const negocioData = Array.isArray(data.negocios)
        ? data.negocios[0]
        : data.negocios;

    if (!negocioData) {
        console.error(
            "❌ No se encontró el negocio asociado al usuario."
        );

        return null;
    }

    const negocio: NegocioPOS = {
        id: negocioData.id,

        nombre: negocioData.nombre,

        tipo_negocio:
            negocioData.tipo_negocio ?? null,

        logo_url:
            negocioData.logo_url ?? null,
    };

    /*
     * ========================================
     * 4. USUARIO POS COMPLETO
     * ========================================
     */

    const usuarioPOS: UsuarioPOS = {
        id: data.id,
        auth_user_id:
            data.auth_user_id,
        negocio_id:
            data.negocio_id,
        nombre:
            data.nombre,
        rol:
            data.rol,
        activo:
            data.activo,
        foto_url:
            data.foto_url ?? null,
        negocio,
    };

    console.log(
        "=========================================="
    );

    console.log(
        "✅ USUARIO POS COMPLETO"
    );

    console.log(
        "👤 Usuario:",
        usuarioPOS.nombre
    );

    console.log(
        "🔐 Rol:",
        usuarioPOS.rol
    );

    console.log(
        "🏪 Negocio:",
        usuarioPOS.negocio?.nombre
    );

    console.log(
        "🖼️ Logo:",
        usuarioPOS.negocio?.logo_url
    );

    console.log(
        "=========================================="
    );

    return usuarioPOS;
}