import { NextRequest, NextResponse } from "next/server";

import crypto from "crypto";

import { createClient } from "@supabase/supabase-js";

/*
 * ==========================================
 * CONFIGURACIÓN SUPABASE
 * ==========================================
 *
 * Este endpoint se ejecuta únicamente
 * en el servidor.
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

/*
 * ==========================================
 * CONFIGURACIÓN MERCADO PAGO
 * ==========================================
 */

const MERCADOPAGO_CLIENT_ID =
    process.env.MERCADOPAGO_CLIENT_ID;

const MERCADOPAGO_REDIRECT_URI =
    "https://punto-ventasit.vercel.app/api/mercadopago/oauth/callback";

/*
 * ==========================================
 * GET
 * ==========================================
 *
 * Inicia el proceso OAuth de Mercado Pago.
 */

export async function GET(
    request: NextRequest
) {
    try {
        /*
         * ==========================================
         * 1. VALIDAR CONFIGURACIÓN
         * ==========================================
         */

        if (
            !process.env.NEXT_PUBLIC_SUPABASE_URL ||
            !process.env.SUPABASE_SERVICE_ROLE_KEY
        ) {
            console.error(
                "Faltan variables de entorno de Supabase."
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "La configuración de Supabase está incompleta.",
                },
                {
                    status: 500,
                }
            );
        }

        if (!MERCADOPAGO_CLIENT_ID) {
            console.error(
                "Falta MERCADOPAGO_CLIENT_ID."
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "La configuración de Mercado Pago está incompleta.",
                },
                {
                    status: 500,
                }
            );
        }

        /*
         * ==========================================
         * 2. OBTENER TOKEN DEL USUARIO ACTUAL
         * ==========================================
         */

        const authorization =
            request.headers.get(
                "authorization"
            );

        if (
            !authorization ||
            !authorization.startsWith(
                "Bearer "
            )
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se encontró la sesión del usuario.",
                },
                {
                    status: 401,
                }
            );
        }

        const accessToken =
            authorization.replace(
                "Bearer ",
                ""
            );

        /*
         * ==========================================
         * 3. VALIDAR TOKEN
         * ==========================================
         *
         * Utilizamos exactamente el mismo patrón
         * que ya funciona en:
         *
         * app/api/admin/usuarios/route.ts
         */

        const {
            data: authData,
            error: authError,
        } =
            await supabaseAdmin.auth.getUser(
                accessToken
            );

        if (
            authError ||
            !authData.user
        ) {
            console.error(
                "Error validando sesión Supabase:",
                authError
            );

            return NextResponse.json(
                {
                    ok: false,
                    error: "La sesión no es válida o ha expirado.",
                },
                { status: 401 }
            );
        }

        const authUserId =
            authData.user.id;

        /*
         * ==========================================
         * 4. OBTENER USUARIO ADMINISTRADOR
         * ==========================================
         */

        const {
            data: administrador,
            error: administradorError,
        } =
            await supabaseAdmin
                .from("usuarios")
                .select(
                    `
                    id,
                    negocio_id,
                    nombre,
                    rol,
                    activo
                    `
                )
                .eq(
                    "auth_user_id",
                    authUserId
                )
                .eq(
                    "activo",
                    true
                )
                .single();

        if (
            administradorError ||
            !administrador
        ) {
            console.error(
                "Error obteniendo usuario administrativo:",
                administradorError
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se encontró el usuario actual en el sistema.",
                },
                {
                    status: 403,
                }
            );
        }

        /*
         * ==========================================
         * 5. VALIDAR ROL
         * ==========================================
         */

        if (
            administrador.rol !==
            "admin"
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Solo un administrador puede conectar Mercado Pago.",
                },
                {
                    status: 403,
                }
            );
        }

        /*
         * ==========================================
         * 6. VALIDAR NEGOCIO
         * ==========================================
         */

        if (
            !administrador.negocio_id
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El usuario no tiene un negocio asociado.",
                },
                {
                    status: 400,
                }
            );
        }

        const negocioId =
            administrador.negocio_id;

        /*
         * ==========================================
         * 7. GENERAR STATE
         * ==========================================
         *
         * El state vincula la autorización OAuth
         * con el negocio y usuario que inició
         * la conexión.
         */

        const state =
            crypto
                .randomBytes(32)
                .toString("hex");

        const expiresAt =
            new Date(
                Date.now() +
                10 * 60 * 1000
            ).toISOString();

        /*
         * ==========================================
         * 8. LIMPIAR STATES ANTERIORES
         * ==========================================
         */

        const {
            error: deleteStateError,
        } =
            await supabaseAdmin
                .from(
                    "mercado_pago_oauth_states"
                )
                .delete()
                .eq(
                    "negocio_id",
                    negocioId
                );

        if (
            deleteStateError
        ) {
            console.error(
                "Error eliminando estados OAuth anteriores:",
                deleteStateError
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudo preparar la conexión con Mercado Pago.",
                },
                {
                    status: 500,
                }
            );
        }

        /*
         * ==========================================
         * 9. GUARDAR STATE
         * ==========================================
         */

        const {
            error: insertStateError,
        } =
            await supabaseAdmin
                .from(
                    "mercado_pago_oauth_states"
                )
                .insert({
                    state,
                    negocio_id:
                        negocioId,
                    usuario_id:
                        administrador.id,
                    expires_at:
                        expiresAt,
                });

        if (
            insertStateError
        ) {
            console.error(
                "Error guardando estado OAuth:",
                insertStateError
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudo iniciar la conexión con Mercado Pago.",
                },
                {
                    status: 500,
                }
            );
        }

        /*
         * ==========================================
         * 10. CREAR URL DE AUTORIZACIÓN
         * ==========================================
         */

        const parametros =
            new URLSearchParams({
                client_id:
                    MERCADOPAGO_CLIENT_ID,

                response_type:
                    "code",

                platform_id:
                    "mp",

                state,

                redirect_uri:
                    MERCADOPAGO_REDIRECT_URI,
            });

        const authorizationUrl =
            `https://auth.mercadopago.com/authorization?${parametros.toString()}`;

        /*
         * ==========================================
         * 11. RESPUESTA
         * ==========================================
         */

        return NextResponse.json(
            {
                ok: true,
                authorization_url:
                    authorizationUrl,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Error iniciando OAuth de Mercado Pago:",
            error
        );

        return NextResponse.json(
            {
                ok: false,
                error:
                    "No se pudo iniciar la conexión con Mercado Pago.",
            },
            {
                status: 500,
            }
        );
    }
}