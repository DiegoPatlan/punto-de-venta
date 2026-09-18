import { NextRequest, NextResponse } from "next/server";

import crypto from "crypto";

import { createClient } from "@supabase/supabase-js";

import {
    obtenerCredencialesMercadoPago,
    obtenerTerminalMercadoPago,
} from "../../../../lib/mercadopago/credenciales";

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

function obtenerTokenAutorizacion(
    request: NextRequest
) {
    const authorization =
        request.headers.get("authorization");

    if (
        !authorization ||
        !authorization.startsWith("Bearer ")
    ) {
        return null;
    }

    return authorization.substring(7).trim();
}

export async function POST(
    request: NextRequest
) {
    try {
        // =========================================================
        // 1. AUTENTICAR USUARIO DEL POS
        // =========================================================

        const accessTokenUsuario =
            obtenerTokenAutorizacion(request);

        if (!accessTokenUsuario) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No autorizado. Se requiere una sesión activa.",
                },
                { status: 401 }
            );
        }

        const supabaseAdmin =
            obtenerSupabaseAdmin();

        const {
            data: authData,
            error: authError,
        } =
            await supabaseAdmin.auth.getUser(
                accessTokenUsuario
            );

        if (
            authError ||
            !authData?.user
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "La sesión del usuario no es válida.",
                },
                { status: 401 }
            );
        }

        // =========================================================
        // 2. OBTENER USUARIO Y NEGOCIO
        // =========================================================

        const { data: usuario, error: usuarioError } =
            await supabaseAdmin
                .from("usuarios")
                .select(
                    "id, negocio_id, rol, activo"
                )
                .eq(
                    "auth_user_id",
                    authData.user.id
                )
                .maybeSingle();

        if (usuarioError) {
            console.error(
                "Error obteniendo usuario:",
                usuarioError
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudo identificar al usuario.",
                },
                { status: 500 }
            );
        }

        if (!usuario || !usuario.activo) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El usuario no está autorizado para utilizar el Punto de Venta.",
                },
                { status: 403 }
            );
        }

        const negocioId =
            usuario.negocio_id;

        if (!negocioId) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El usuario no tiene un negocio asociado.",
                },
                { status: 403 }
            );
        }

        // =========================================================
        // 3. RECIBIR DATOS DEL POS
        // =========================================================

        const body = await request.json();

        const monto =
            Number(body?.monto);

        if (
            !Number.isFinite(monto) ||
            monto <= 0
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El monto debe ser un número mayor que 0.",
                },
                { status: 400 }
            );
        }

        // =========================================================
        // 4. OBTENER CREDENCIALES DEL NEGOCIO
        // =========================================================

        const credenciales =
            await obtenerCredencialesMercadoPago(
                negocioId
            );

        // =========================================================
        // 5. OBTENER TERMINAL DEL NEGOCIO
        // =========================================================

        const terminal =
            await obtenerTerminalMercadoPago(
                negocioId
            );

        const terminalId =
            terminal.terminalId;

        // =========================================================
        // 6. VERIFICAR EXPIRACIÓN DEL ACCESS TOKEN
        // =========================================================

        if (
            credenciales.expiresAt &&
            new Date(
                credenciales.expiresAt
            ).getTime() <= Date.now()
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "La autorización de Mercado Pago expiró. Es necesario renovar la conexión.",
                },
                { status: 401 }
            );
        }

        // =========================================================
        // 7. REFERENCIA EXTERNA
        // =========================================================

        const externalReference =
            `pos-${Date.now()}-${crypto
                .randomBytes(4)
                .toString("hex")}`;

        // =========================================================
        // 8. IDEMPOTENCY KEY
        // =========================================================

        const idempotencyKey =
            crypto.randomUUID();

        // =========================================================
        // 9. BODY PARA MERCADO PAGO
        // =========================================================

        const orderBody = {
            type: "point",

            external_reference:
                externalReference,

            expiration_time:
                "PT15M",

            transactions: {
                payments: [
                    {
                        amount:
                            monto.toFixed(2),
                    },
                ],
            },

            config: {
                point: {
                    terminal_id:
                        terminalId,

                    print_on_terminal:
                        "no_ticket",
                },
            },

            description:
                "Punto de Venta Soporte IT - Cobro con tarjeta",
        };

        console.log(
            "========================================"
        );

        console.log(
            "MERCADO PAGO - CREANDO ORDER"
        );

        console.log(
            "========================================"
        );

        console.log(
            "Negocio:",
            negocioId
        );

        console.log(
            "Usuario:",
            usuario.id
        );

        console.log(
            "Monto:",
            monto.toFixed(2)
        );

        console.log(
            "Terminal:",
            terminalId
        );

        console.log(
            "External Reference:",
            externalReference
        );

        // =========================================================
        // 10. CREAR ORDER EN MERCADO PAGO
        // =========================================================

        const response = await fetch(
            "https://api.mercadopago.com/v1/orders",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${credenciales.accessToken}`,

                    "X-Idempotency-Key":
                        idempotencyKey,
                },

                body:
                    JSON.stringify(
                        orderBody
                    ),

                cache: "no-store",
            }
        );

        const data =
            await response.json();

        // =========================================================
        // 11. ERROR DE MERCADO PAGO
        // =========================================================

        if (!response.ok) {
            console.error(
                "Mercado Pago error creando Order:",
                {
                    status:
                        response.status,

                    data,
                }
            );

            return NextResponse.json(
                {
                    ok: false,

                    status:
                        response.status,

                    error:
                        data,

                    external_reference:
                        externalReference,

                    terminal_id:
                        terminalId,
                },
                {
                    status:
                        response.status,
                }
            );
        }

        // =========================================================
        // 12. VALIDAR ORDER ID
        // =========================================================

        if (!data?.id) {
            console.error(
                "Mercado Pago no devolvió un Order ID:",
                data
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Mercado Pago no devolvió un identificador de Order válido.",
                },
                { status: 502 }
            );
        }

        // =========================================================
        // 13. GUARDAR RELACIÓN ORDER ↔ NEGOCIO
        // =========================================================

        const { error: errorRegistro } =
            await supabaseAdmin
                .from("mercado_pago_orders")
                .insert({
                    negocio_id:
                        negocioId,

                    order_id:
                        String(data.id),

                    external_reference:
                        data.external_reference ??
                        externalReference,

                    monto:
                        monto,

                    estado:
                        data.status ??
                        null,

                    estado_detalle:
                        data.status_detail ??
                        null,
                });

        if (errorRegistro) {
            console.error(
                "Error guardando relación de Mercado Pago:",
                errorRegistro
            );

            /*
             * La Order ya existe en Mercado Pago.
             * No intentamos crear otra Order.
             *
             * Devolvemos error para que el problema
             * quede registrado y pueda corregirse.
             */

            return NextResponse.json(
                {
                    ok: false,

                    error:
                        "La Order fue creada en Mercado Pago, pero no se pudo registrar su relación con el negocio.",

                    order_id:
                        data.id,

                    external_reference:
                        data.external_reference ??
                        externalReference,
                },
                { status: 500 }
            );
        }

        // =========================================================
        // 14. RESPUESTA EXITOSA
        // =========================================================

        console.log(
            "Order creada correctamente:"
        );

        console.log(
            "Order ID:",
            data.id
        );

        console.log(
            "Status:",
            data.status
        );

        return NextResponse.json(
            {
                ok: true,

                mensaje:
                    "Order de Mercado Pago creada correctamente.",

                order_id:
                    data.id,

                status:
                    data.status,

                status_detail:
                    data.status_detail ??
                    null,

                external_reference:
                    data.external_reference ??
                    externalReference,

                terminal_id:
                    terminalId,

                monto:
                    monto.toFixed(2),

                expiration_time:
                    data.expiration_time ??
                    "PT15M",

                data,
            },
            {
                status: 201,
            }
        );
    } catch (error) {
        console.error(
            "Error creando Order de Mercado Pago:",
            error instanceof Error
                ? error.message
                : error
        );

        const mensaje =
            error instanceof Error
                ? error.message
                : "Error interno al comunicarse con Mercado Pago.";

        return NextResponse.json(
            {
                ok: false,
                error: mensaje,
            },
            { status: 500 }
        );
    }
}