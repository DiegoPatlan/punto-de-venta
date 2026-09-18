import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cifrarToken } from "../../../../../lib/mercadopago/cifrado";

const REDIRECT_URI =
    "https://punto-ventasit.vercel.app/api/mercadopago/oauth/callback";

function crearSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            "Faltan las variables de entorno de Supabase."
        );
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

function redirigirConfiguracion(
    request: NextRequest,
    resultado: "ok" | "error",
    mensaje?: string
) {
    const url = new URL(
        "/admin/configuracion/mercadopago",
        request.url
    );

    url.searchParams.set("conexion", resultado);

    if (mensaje) {
        url.searchParams.set("mensaje", mensaje);
    }

    return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
    try {
        const clientId = process.env.MERCADOPAGO_CLIENT_ID;
        const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            console.error(
                "Faltan las variables de entorno OAuth de Mercado Pago."
            );

            return redirigirConfiguracion(
                request,
                "error",
                "Falta configurar OAuth de Mercado Pago en el servidor."
            );
        }

        const supabaseAdmin = crearSupabaseAdmin();

        const { searchParams } = new URL(request.url);

        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const oauthError = searchParams.get("error");

        if (oauthError) {
            console.error(
                "Mercado Pago devolvió un error OAuth:",
                oauthError
            );

            return redirigirConfiguracion(
                request,
                "error",
                "La autorización de Mercado Pago fue cancelada o rechazada."
            );
        }

        if (!code || !state) {
            return redirigirConfiguracion(
                request,
                "error",
                "La respuesta de autorización está incompleta."
            );
        }

        // Buscar el estado de autorización y el negocio asociado.
        const { data: estado, error: errorEstado } =
            await supabaseAdmin
                .from("mercado_pago_oauth_states")
                .select("id, state, negocio_id, usuario_id, expires_at")
                .eq("state", state)
                .maybeSingle();

        if (errorEstado) {
            console.error(
                "Error consultando el estado OAuth:",
                errorEstado
            );

            return redirigirConfiguracion(
                request,
                "error",
                "No se pudo validar la autorización."
            );
        }

        if (!estado) {
            return redirigirConfiguracion(
                request,
                "error",
                "El estado de autorización no es válido o ya fue utilizado."
            );
        }

        if (new Date(estado.expires_at).getTime() <= Date.now()) {
            await supabaseAdmin
                .from("mercado_pago_oauth_states")
                .delete()
                .eq("id", estado.id);

            return redirigirConfiguracion(
                request,
                "error",
                "La autorización expiró. Intenta conectar nuevamente."
            );
        }

        // Intercambiar el código OAuth por tokens.
        const tokenResponse = await fetch(
            "https://api.mercadopago.com/oauth/token",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: REDIRECT_URI,
                }),
                cache: "no-store",
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error(
                "Error intercambiando código OAuth:",
                {
                    status: tokenResponse.status,
                    message:
                        tokenData?.message ??
                        tokenData?.error ??
                        "Error desconocido",
                }
            );

            return redirigirConfiguracion(
                request,
                "error",
                "Mercado Pago no pudo completar la autorización."
            );
        }

        const accessToken = tokenData?.access_token;
        const refreshToken = tokenData?.refresh_token;
        const expiresIn = Number(tokenData?.expires_in);

        if (
            typeof accessToken !== "string" ||
            typeof refreshToken !== "string" ||
            !Number.isFinite(expiresIn) ||
            expiresIn <= 0
        ) {
            console.error(
                "Respuesta OAuth incompleta o inválida."
            );

            return redirigirConfiguracion(
                request,
                "error",
                "Mercado Pago devolvió datos de autorización incompletos."
            );
        }

        // Cifrar ambos tokens antes de almacenarlos.
        const accessTokenCifrado = cifrarToken(accessToken);
        const refreshTokenCifrado = cifrarToken(refreshToken);

        const expiresAt = new Date(
            Date.now() + expiresIn * 1000
        ).toISOString();

        const usuarioMercadoPagoId =
            tokenData?.user_id != null
                ? String(tokenData.user_id)
                : null;

        const scope =
            typeof tokenData?.scope === "string"
                ? tokenData.scope
                : null;

        // Guardar las credenciales cifradas por negocio.
        const { error: errorCredenciales } =
            await supabaseAdmin
                .from("mercado_pago_credenciales")
                .upsert(
                    {
                        negocio_id: estado.negocio_id,
                        usuario_mercado_pago_id:
                            usuarioMercadoPagoId,
                        access_token_encrypted:
                            accessTokenCifrado,
                        refresh_token_encrypted:
                            refreshTokenCifrado,
                        expires_at: expiresAt,
                        scope,
                    },
                    {
                        onConflict: "negocio_id",
                    }
                );

        if (errorCredenciales) {
            console.error(
                "Error guardando credenciales cifradas:",
                errorCredenciales
            );

            return redirigirConfiguracion(
                request,
                "error",
                "No se pudieron guardar las credenciales de Mercado Pago."
            );
        }

        // Actualizar la configuración de Mercado Pago del negocio.
        const { error: errorConfiguracion } =
            await supabaseAdmin
                .from("configuracion_mercado_pago")
                .upsert(
                    {
                        negocio_id: estado.negocio_id,
                        habilitado: true,
                        estado_conexion: "conectado",
                        modo: "produccion",
                        usuario_mercado_pago_id:
                            usuarioMercadoPagoId,
                    },
                    {
                        onConflict: "negocio_id",
                    }
                );

        if (errorConfiguracion) {
            console.error(
                "Error actualizando configuración:",
                errorConfiguracion
            );

            return redirigirConfiguracion(
                request,
                "error",
                "Se autorizaron las credenciales, pero no se pudo actualizar la configuración."
            );
        }

        // El estado se elimina después de completar el proceso.
        const { error: errorEliminarEstado } =
            await supabaseAdmin
                .from("mercado_pago_oauth_states")
                .delete()
                .eq("id", estado.id);

        if (errorEliminarEstado) {
            console.error(
                "No se pudo eliminar el estado OAuth utilizado:",
                errorEliminarEstado
            );
        }

        return redirigirConfiguracion(request, "ok");
    } catch (error) {
        console.error(
            "Error en callback OAuth de Mercado Pago:",
            error instanceof Error
                ? error.message
                : "Error desconocido"
        );

        return redirigirConfiguracion(
            request,
            "error",
            "Ocurrió un error al conectar Mercado Pago."
        );
    }
}