import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
    cifrarToken,
    descifrarToken,
} from "./cifrado";

type CredencialesMercadoPagoDB = {
    id: string;
    negocio_id: string;
    usuario_mercado_pago_id: string | null;
    access_token_encrypted: string;
    refresh_token_encrypted: string;
    expires_at: string | null;
    scope: string | null;
};

type ConfiguracionMercadoPagoDB = {
    negocio_id: string;
    habilitado: boolean;
    terminal_id: string | null;
    modo: "sandbox" | "produccion";
    estado_conexion:
    | "desconectado"
    | "conectando"
    | "conectado"
    | "error";
    usuario_mercado_pago_id: string | null;
};

type RespuestaRefreshMercadoPago = {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    user_id?: unknown;
    scope?: unknown;
};

function obtenerSupabaseAdmin() {
    const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            "Faltan las variables de entorno de Supabase."
        );
    }

    return createClient(
        supabaseUrl,
        serviceRoleKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}

/**
 * Obtiene las credenciales almacenadas de un negocio.
 *
 * Los tokens almacenados en Supabase están cifrados.
 */
async function obtenerCredencialesAlmacenadas(
    negocioId: string
) {
    const supabaseAdmin =
        obtenerSupabaseAdmin();

    const { data, error } =
        await supabaseAdmin
            .from("mercado_pago_credenciales")
            .select(
                "id, negocio_id, usuario_mercado_pago_id, access_token_encrypted, refresh_token_encrypted, expires_at, scope"
            )
            .eq("negocio_id", negocioId)
            .maybeSingle();

    if (error) {
        console.error(
            "Error obteniendo credenciales de Mercado Pago:",
            error
        );

        throw new Error(
            "No se pudieron obtener las credenciales de Mercado Pago."
        );
    }

    const credenciales =
        data as CredencialesMercadoPagoDB | null;

    if (!credenciales) {
        throw new Error(
            "Este negocio todavía no tiene una cuenta de Mercado Pago conectada."
        );
    }

    if (
        !credenciales.access_token_encrypted ||
        !credenciales.refresh_token_encrypted
    ) {
        throw new Error(
            "Las credenciales de Mercado Pago están incompletas."
        );
    }

    return credenciales;
}

/**
 * Renueva las credenciales OAuth de Mercado Pago.
 *
 * Mercado Pago puede devolver un nuevo refresh_token,
 * por lo que ambos tokens se vuelven a cifrar y guardar.
 */
async function renovarCredencialesMercadoPago(
    credenciales: CredencialesMercadoPagoDB
) {
    const clientId =
        process.env.MERCADOPAGO_CLIENT_ID;

    const clientSecret =
        process.env.MERCADOPAGO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            "Faltan las variables de entorno OAuth de Mercado Pago."
        );
    }

    let refreshToken: string;

    try {
        refreshToken =
            descifrarToken(
                credenciales.refresh_token_encrypted
            );
    } catch (error) {
        console.error(
            "Error descifrando Refresh Token de Mercado Pago:",
            error instanceof Error
                ? error.message
                : error
        );

        throw new Error(
            "No se pudo descifrar el Refresh Token de Mercado Pago."
        );
    }

    const response = await fetch(
        "https://api.mercadopago.com/oauth/token",
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded",
            },

            body: new URLSearchParams({
                client_id: clientId,

                client_secret:
                    clientSecret,

                grant_type:
                    "refresh_token",

                refresh_token:
                    refreshToken,
            }),

            cache: "no-store",
        }
    );

    const data =
        (await response.json()) as RespuestaRefreshMercadoPago;

    if (!response.ok) {
        console.error(
            "Error renovando credenciales de Mercado Pago:",
            {
                status:
                    response.status,

                error:
                    data,
            }
        );

        throw new Error(
            "No se pudieron renovar las credenciales de Mercado Pago."
        );
    }

    const nuevoAccessToken =
        typeof data.access_token ===
            "string"
            ? data.access_token
            : null;

    const nuevoRefreshToken =
        typeof data.refresh_token ===
            "string"
            ? data.refresh_token
            : null;

    const expiresIn =
        Number(data.expires_in);

    if (
        !nuevoAccessToken ||
        !nuevoRefreshToken ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0
    ) {
        console.error(
            "Respuesta de renovación OAuth incompleta."
        );

        throw new Error(
            "Mercado Pago devolvió una respuesta de renovación incompleta."
        );
    }

    const nuevoExpiresAt =
        new Date(
            Date.now() +
            expiresIn * 1000
        ).toISOString();

    const accessTokenCifrado =
        cifrarToken(
            nuevoAccessToken
        );

    const refreshTokenCifrado =
        cifrarToken(
            nuevoRefreshToken
        );

    const nuevoUsuarioMercadoPagoId =
        data.user_id != null
            ? String(data.user_id)
            : credenciales.usuario_mercado_pago_id;

    const nuevoScope =
        typeof data.scope ===
            "string"
            ? data.scope
            : credenciales.scope;

    const supabaseAdmin =
        obtenerSupabaseAdmin();

    const { error: errorActualizacion } =
        await supabaseAdmin
            .from("mercado_pago_credenciales")
            .update({
                access_token_encrypted:
                    accessTokenCifrado,

                refresh_token_encrypted:
                    refreshTokenCifrado,

                expires_at:
                    nuevoExpiresAt,

                usuario_mercado_pago_id:
                    nuevoUsuarioMercadoPagoId,

                scope:
                    nuevoScope,

                updated_at:
                    new Date().toISOString(),
            })
            .eq(
                "id",
                credenciales.id
            );

    if (errorActualizacion) {
        console.error(
            "Error guardando las credenciales renovadas:",
            errorActualizacion
        );

        throw new Error(
            "El token fue renovado, pero no se pudieron guardar las nuevas credenciales."
        );
    }

    console.log(
        "Credenciales de Mercado Pago renovadas correctamente."
    );

    return {
        id:
            credenciales.id,

        negocioId:
            credenciales.negocio_id,

        usuarioMercadoPagoId:
            nuevoUsuarioMercadoPagoId,

        accessToken:
            nuevoAccessToken,

        refreshToken:
            nuevoRefreshToken,

        expiresAt:
            nuevoExpiresAt,

        scope:
            nuevoScope,
    };
}

/**
 * Obtiene un Access Token válido para el negocio.
 *
 * Si el token está próximo a expirar, lo renueva
 * automáticamente utilizando el Refresh Token.
 */
export async function obtenerCredencialesMercadoPago(
    negocioId: string
) {
    const credenciales =
        await obtenerCredencialesAlmacenadas(
            negocioId
        );

    let accessToken: string;
    let refreshToken: string;

    try {
        accessToken =
            descifrarToken(
                credenciales.access_token_encrypted
            );

        refreshToken =
            descifrarToken(
                credenciales.refresh_token_encrypted
            );
    } catch (error) {
        console.error(
            "Error descifrando credenciales de Mercado Pago:",
            error instanceof Error
                ? error.message
                : error
        );

        throw new Error(
            "No se pudieron descifrar las credenciales de Mercado Pago."
        );
    }

    /*
     * Renovamos con anticipación.
     *
     * Se utiliza un margen de 5 minutos para evitar
     * que un Access Token expire durante una operación.
     */
    const margenRenovacionMs =
        5 * 60 * 1000;

    const expiraEnMs =
        credenciales.expires_at
            ? new Date(
                credenciales.expires_at
            ).getTime()
            : 0;

    const necesitaRenovacion =
        !expiraEnMs ||
        expiraEnMs <=
        Date.now() +
        margenRenovacionMs;

    if (necesitaRenovacion) {
        return renovarCredencialesMercadoPago(
            credenciales
        );
    }

    return {
        id:
            credenciales.id,

        negocioId:
            credenciales.negocio_id,

        usuarioMercadoPagoId:
            credenciales.usuario_mercado_pago_id,

        accessToken,

        refreshToken,

        expiresAt:
            credenciales.expires_at,

        scope:
            credenciales.scope,
    };
}

export async function obtenerTerminalMercadoPago(
    negocioId: string
) {
    const supabaseAdmin =
        obtenerSupabaseAdmin();

    const { data, error } =
        await supabaseAdmin
            .from("configuracion_mercado_pago")
            .select(
                "negocio_id, habilitado, terminal_id, modo, estado_conexion, usuario_mercado_pago_id"
            )
            .eq("negocio_id", negocioId)
            .maybeSingle();

    if (error) {
        console.error(
            "Error obteniendo configuración de Mercado Pago:",
            error
        );

        throw new Error(
            "No se pudo obtener la configuración de Mercado Pago."
        );
    }

    const configuracion =
        data as ConfiguracionMercadoPagoDB | null;

    if (!configuracion) {
        throw new Error(
            "Este negocio no tiene configurado Mercado Pago."
        );
    }

    if (!configuracion.habilitado) {
        throw new Error(
            "Mercado Pago está deshabilitado para este negocio."
        );
    }

    if (
        configuracion.estado_conexion !==
        "conectado"
    ) {
        throw new Error(
            "La cuenta de Mercado Pago no está conectada."
        );
    }

    if (!configuracion.terminal_id) {
        throw new Error(
            "Este negocio todavía no tiene una terminal de Mercado Pago configurada."
        );
    }

    return {
        terminalId:
            configuracion.terminal_id,

        modo:
            configuracion.modo,

        estadoConexion:
            configuracion.estado_conexion,
    };
}