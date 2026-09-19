import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { descifrarToken } from "../../../../../lib/mercadopago/cifrado";

type Params = {
    params: Promise<{
        order_id: string;
    }>;
};

function obtenerSupabaseAdmin() {
    const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
            "La configuración de Supabase del servidor está incompleta."
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

export async function GET(
    request: NextRequest,
    { params }: Params
) {
    try {
        // =========================================================
        // 1. OBTENER ORDER ID
        // =========================================================

        const { order_id } = await params;

        if (!order_id) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Falta el order_id.",
                },
                {
                    status: 400,
                }
            );
        }

        // =========================================================
        // 2. AUTENTICAR USUARIO
        // =========================================================

        const authorization =
            request.headers.get("authorization");

        if (
            !authorization ||
            !authorization.toLowerCase().startsWith("bearer ")
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "No autorizado.",
                },
                {
                    status: 401,
                }
            );
        }

        const accessTokenUsuario =
            authorization.substring(7).trim();

        if (!accessTokenUsuario) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "No autorizado.",
                },
                {
                    status: 401,
                }
            );
        }

        // =========================================================
        // 3. CLIENTE SUPABASE ADMIN
        // =========================================================

        const supabaseAdmin =
            obtenerSupabaseAdmin();

        // =========================================================
        // 4. VALIDAR SESIÓN DE SUPABASE
        // =========================================================

        const {
            data: usuarioAuth,
            error: errorAuth,
        } =
            await supabaseAdmin.auth.getUser(
                accessTokenUsuario
            );

        if (
            errorAuth ||
            !usuarioAuth?.user
        ) {
            console.error(
                "Error validando usuario para consultar Order:",
                errorAuth
            );

            return NextResponse.json(
                {
                    ok: false,
                    error: "No autorizado.",
                },
                {
                    status: 401,
                }
            );
        }

        const authUserId =
            usuarioAuth.user.id;

        // =========================================================
        // 5. OBTENER USUARIO Y NEGOCIO
        // =========================================================

        const {
            data: usuario,
            error: errorUsuario,
        } =
            await supabaseAdmin
                .from("usuarios")
                .select(
                    "id, negocio_id, activo"
                )
                .eq(
                    "auth_user_id",
                    authUserId
                )
                .maybeSingle();

        if (
            errorUsuario ||
            !usuario
        ) {
            console.error(
                "Error obteniendo usuario POS:",
                errorUsuario
            );

            return NextResponse.json(
                {
                    ok: false,
                    error: "No se pudo identificar el negocio del usuario.",
                },
                {
                    status: 403,
                }
            );
        }

        if (usuario.activo === false) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "El usuario está inactivo.",
                },
                {
                    status: 403,
                }
            );
        }

        const negocioId =
            usuario.negocio_id;

        if (!negocioId) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "El usuario no tiene un negocio asociado.",
                },
                {
                    status: 403,
                }
            );
        }

        // =========================================================
        // 6. OBTENER LA ORDER LOCAL
        // =========================================================

        const {
            data: ordenLocal,
            error: errorOrdenLocal,
        } =
            await supabaseAdmin
                .from("mercado_pago_orders")
                .select(
                    "id, negocio_id, order_id, external_reference, monto, estado, estado_detalle"
                )
                .eq(
                    "order_id",
                    order_id
                )
                .maybeSingle();

        if (errorOrdenLocal) {
            console.error(
                "Error obteniendo Order local de Mercado Pago:",
                errorOrdenLocal
            );

            return NextResponse.json(
                {
                    ok: false,
                    error: "No se pudo consultar la Order local.",
                },
                {
                    status: 500,
                }
            );
        }

        if (!ordenLocal) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "La Order de Mercado Pago no existe.",
                },
                {
                    status: 404,
                }
            );
        }

        // =========================================================
        // 7. VALIDAR QUE LA ORDER PERTENEZCA AL NEGOCIO
        // =========================================================

        if (
            ordenLocal.negocio_id !==
            negocioId
        ) {
            console.error(
                "Intento de consultar Order de otro negocio:",
                {
                    order_id,
                    negocioId,
                    negocioOrder:
                        ordenLocal.negocio_id,
                }
            );

            return NextResponse.json(
                {
                    ok: false,
                    error: "La Order no pertenece al negocio actual.",
                },
                {
                    status: 403,
                }
            );
        }

        // =========================================================
        // 8. OBTENER CREDENCIALES OAUTH DEL NEGOCIO
        // =========================================================

        const {
            data: credenciales,
            error: errorCredenciales,
        } =
            await supabaseAdmin
                .from(
                    "mercado_pago_credenciales"
                )
                .select(
                    "access_token_encrypted, expires_at"
                )
                .eq(
                    "negocio_id",
                    negocioId
                )
                .maybeSingle();

        if (
            errorCredenciales
        ) {
            console.error(
                "Error obteniendo credenciales OAuth de Mercado Pago:",
                errorCredenciales
            );

            return NextResponse.json(
                {
                    ok: false,
                    error: "No se pudieron obtener las credenciales de Mercado Pago.",
                },
                {
                    status: 500,
                }
            );
        }

        if (
            !credenciales?.access_token_encrypted
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "El negocio no tiene Mercado Pago conectado.",
                },
                {
                    status: 400,
                }
            );
        }

        // =========================================================
        // 9. VALIDAR EXPIRACIÓN DEL TOKEN
        // =========================================================

        if (
            credenciales.expires_at
        ) {
            const expiresAt =
                new Date(
                    credenciales.expires_at
                ).getTime();

            const ahora =
                Date.now();

            if (
                Number.isFinite(
                    expiresAt
                ) &&
                expiresAt <= ahora
            ) {
                return NextResponse.json(
                    {
                        ok: false,
                        error:
                            "La autorización de Mercado Pago ha expirado. Es necesario reconectar la cuenta.",
                    },
                    {
                        status: 401,
                    }
                );
            }
        }

        // =========================================================
        // 10. DESCIFRAR ACCESS TOKEN
        // =========================================================

        let accessTokenMercadoPago: string;

        try {
            accessTokenMercadoPago =
                descifrarToken(
                    credenciales.access_token_encrypted
                );
        } catch (error) {
            console.error(
                "Error descifrando access token de Mercado Pago:",
                error
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudo utilizar la autorización de Mercado Pago.",
                },
                {
                    status: 500,
                }
            );
        }

        // =========================================================
        // 11. CONSULTAR ORDER EN MERCADO PAGO
        // =========================================================

        const response =
            await fetch(
                `https://api.mercadopago.com/v1/orders/${order_id}`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${accessTokenMercadoPago}`,
                        "Content-Type":
                            "application/json",
                    },
                    cache: "no-store",
                }
            );

        const data =
            await response.json();

        // =========================================================
        // 12. ERROR MERCADO PAGO
        // =========================================================

        if (!response.ok) {
            console.error(
                "Mercado Pago error consultando Order:",
                {
                    status:
                        response.status,
                    order_id,
                    data,
                }
            );

            return NextResponse.json(
                {
                    ok: false,
                    status:
                        response.status,
                    error: data,
                },
                {
                    status:
                        response.status,
                }
            );
        }

        // =========================================================
        // 13. INFORMACIÓN GENERAL DE LA ORDER
        // =========================================================

        const status =
            data?.status ?? null;

        const statusDetail =
            data?.status_detail ??
            null;

        // =========================================================
        // 14. OBTENER INFORMACIÓN DEL PAGO
        // =========================================================

        const payments =
            data?.transactions
                ?.payments ?? [];

        const primerPago =
            payments.length > 0
                ? payments[0]
                : null;

        const paymentStatus =
            primerPago?.status ??
            null;

        const paymentStatusDetail =
            primerPago?.status_detail ??
            null;

        const paymentMethod =
            primerPago?.payment_method ??
            null;

        // =========================================================
        // 15. DETERMINAR SI EL PAGO FUE CONFIRMADO
        // =========================================================
        //
        // Para nuestro POS consideraremos exitoso solamente cuando:
        //
        // Order = processed
        // Pago  = processed
        // Detalle = accredited
        //

        const pagoConfirmado =
            status === "processed" &&
            paymentStatus ===
            "processed" &&
            paymentStatusDetail ===
            "accredited";

        // =========================================================
        // 16. ESTADO DEL PROCESO
        // =========================================================

        let estadoPOS:
            | "pendiente"
            | "aprobado"
            | "rechazado"
            | "cancelado"
            | "expirado"
            | "requiere_accion"
            | "desconocido";

        if (
            pagoConfirmado
        ) {
            estadoPOS =
                "aprobado";
        } else if (
            status === "failed"
        ) {
            estadoPOS =
                "rechazado";
        } else if (
            status === "canceled"
        ) {
            estadoPOS =
                "cancelado";
        } else if (
            status === "expired"
        ) {
            estadoPOS =
                "expirado";
        } else if (
            status ===
            "action_required"
        ) {
            estadoPOS =
                "requiere_accion";
        } else if (
            status ===
            "created" ||
            status ===
            "processing"
        ) {
            estadoPOS =
                "pendiente";
        } else {
            estadoPOS =
                "desconocido";
        }

        // =========================================================
        // 17. ACTUALIZAR ESTADO LOCAL DE LA ORDER
        // =========================================================

        const estadoLocal =
            pagoConfirmado
                ? "aprobado"
                : estadoPOS;

        const { error: errorActualizacion } =
            await supabaseAdmin
                .from(
                    "mercado_pago_orders"
                )
                .update({
                    estado:
                        estadoLocal,
                    estado_detalle:
                        statusDetail,
                })
                .eq(
                    "order_id",
                    order_id
                )
                .eq(
                    "negocio_id",
                    negocioId
                );

        if (
            errorActualizacion
        ) {
            console.error(
                "Error actualizando estado local de Mercado Pago:",
                errorActualizacion
            );
        }

        // =========================================================
        // 18. RESPUESTA PARA EL POS
        // =========================================================

        return NextResponse.json(
            {
                ok: true,

                order_id:
                    data.id,

                status,

                status_detail:
                    statusDetail,

                estado_pos:
                    estadoPOS,

                pago_confirmado:
                    pagoConfirmado,

                external_reference:
                    data.external_reference ??
                    null,

                total_paid_amount:
                    data.total_paid_amount ??
                    null,

                currency:
                    data.currency ??
                    null,

                payment: primerPago
                    ? {
                        id:
                            primerPago.id ??
                            null,

                        status:
                            paymentStatus,

                        status_detail:
                            paymentStatusDetail,

                        amount:
                            primerPago.amount ??
                            null,

                        paid_amount:
                            primerPago.paid_amount ??
                            null,

                        payment_method:
                            paymentMethod
                                ? {
                                    id:
                                        paymentMethod.id ??
                                        null,

                                    type:
                                        paymentMethod.type ??
                                        null,

                                    installments:
                                        paymentMethod.installments ??
                                        null,
                                }
                                : null,
                    }
                    : null,

                data,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        // =========================================================
        // ERROR GENERAL
        // =========================================================

        console.error(
            "Error consultando Order de Mercado Pago:",
            error
        );

        return NextResponse.json(
            {
                ok: false,
                error:
                    "Error interno al consultar la Order.",
            },
            {
                status: 500,
            }
        );
    }
}