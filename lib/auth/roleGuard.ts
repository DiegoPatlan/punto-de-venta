import { supabase } from "../supabase";

export type RolUsuario = "admin" | "encargado" | "cajero";

export interface UsuarioNegocio {
    id: string;
    nombre: string;
    tipo_negocio: string | null;
    logo_url: string | null;
}

export interface UsuarioActual {
    id: string;
    auth_user_id: string;
    negocio_id: string;
    nombre: string;
    rol: RolUsuario;
    activo: boolean;
    negocios: UsuarioNegocio | null;
}

export async function obtenerUsuarioActual(): Promise<UsuarioActual | null> {

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();


    if (authError || !user) {
        return null;
    }

    const { data: usuario, error } = await supabase
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
        .eq("auth_user_id", user.id)
        .eq("activo", true)
        .maybeSingle();

    if (error) {
        console.error(
            "❌ Error obteniendo usuario administrativo:",
            error
        );
        return null;
    }

    if (!usuario) {
        console.error(
            "❌ El usuario Auth existe pero no está registrado en public.usuarios."
        );
        return null;
    }

    const negocio = Array.isArray(usuario.negocios)
        ? usuario.negocios[0] ?? null
        : usuario.negocios ?? null;

    const usuarioActual: UsuarioActual = {
        id: usuario.id,
        auth_user_id: usuario.auth_user_id,
        negocio_id: usuario.negocio_id,
        nombre: usuario.nombre,
        rol: usuario.rol as RolUsuario,
        activo: usuario.activo,
        negocios: negocio,
    };

    return usuarioActual;
}

export async function verificarRol(
    rolesPermitidos: RolUsuario[]
) {
    const usuario = await obtenerUsuarioActual();

    if (!usuario) {
        return {
            autorizado: false,
            usuario: null,
            motivo: "no_autenticado" as const,
        };
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
        return {
            autorizado: false,
            usuario,
            motivo: "sin_permiso" as const,
        };
    }

    return {
        autorizado: true,
        usuario,
        motivo: null,
    };
}