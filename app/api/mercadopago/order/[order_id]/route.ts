import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { obtenerCredencialesMercadoPago } from "../../../../../lib/mercadopago/credenciales";

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
            !authorization
                .toLowerCase()
                .startsWith("bearer ")
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
            authorization
                .substring(7)
                .trim();

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
                    error:
                        "No se pudo identificar el negocio del usuario.",
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
                    error:
                        "El usuario está inactivo.",
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
                    error:
                        "El usuario no tiene un negocio asociado.",
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
                    error:
                        "No se pudo consultar la Order local.",
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
                    error:
                        "La Order de Mercado Pago no existe.",
                },
                {
                    status: 404,
                }
            );
        }

        // =========================================================
        // 7. VALIDAR QUE LA ORDER PERTENEZCA AL NEGOCIO ACTUAL
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
                    error:
                        "La Order no pertenece al negocio actual.",
                },
                {
                    status: 403,
                }
            );
        }

        // =========================================================
        // 8. OBTENER CREDENCIALES DEL NEGOCIO
        // =========================================================
        //
        // IMPORTANTE:
        // Este helper busca las credenciales por negocio_id
        // y además renueva automáticamente el access token
        // cuando está próximo a expirar.
        //
        // Esto mantiene aisladas las cuentas de Mercado Pago
        // entre los diferentes negocios.
        // =========================================================

        let credenciales;

        try {
            credenciales =
                await obtenerCredencialesMercadoPago(
                    negocioId
                );
        } catch (error) {
            console.error(
                "Error obteniendo credenciales de Mercado Pago:",
                error
            );

            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudieron obtener las credenciales de Mercado Pago del negocio.",
                },
                {
                    status: 500,
                }
            );
        }

        if (!credenciales) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "El negocio no tiene Mercado Pago conectado.",
                },
                {
                    status: 400,
                }
            );
        }

        // =========================================================
        // 9. VALIDAR ACCESS TOKEN
        // =========================================================

        const accessTokenMercadoPago =
            credenciales.accessToken;

        if (
            !accessTokenMercadoPago
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "No se pudo obtener el Access Token de Mercado Pago.",
                },
                {
                    status: 401,
                }
            );
        }

        // =========================================================
        // 10. CONSULTAR ORDER EN MERCADO PAGO
        // =========================================================

        const response =
            await fetch(
                `https://api.mercadopago.com/v1/orders/${encodeURIComponent(
                    order_id
                )}`,
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

        let data: any = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }

        // =========================================================
        // 11. ERROR MERCADO PAGO
        // =========================================================

        if (!response.ok) {
            console.error(
                "Mercado Pago error consultando Order:",
                {
                    status:
                        response.status,
                    order_id,
                    negocioId,
                    data,
                }
            );

            return NextResponse.json(
                {
                    ok: false,
                    status:
                        response.status,
                    error:
                        data ??
                        "Mercado Pago no pudo consultar la Order.",
                },
                {
                    status:
                        response.status,
                }
            );
        }

        // =========================================================
        // 12. INFORMACIÓN GENERAL DE LA ORDER
        // =========================================================

        const status =
            data?.status ?? null;

        const statusDetail =
            data?.status_detail ??
            null;

        // =========================================================
        // 13. OBTENER INFORMACIÓN DEL PAGO
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
        // 14. DETERMINAR SI EL PAGO FUE CONFIRMADO
        // =========================================================
        //
        // Para nuestro POS, el cobro se considera confirmado
        // únicamente cuando:
        //
        // Order:
        //     processed
        //
        // Pago:
        //     processed
        //
        // Detalle:
        //     accredited
        //
        // Mercado Pago documenta esta combinación como pago
        // procesado y acreditado.
        // =========================================================

        const pagoConfirmado =
            status === "processed" &&
            paymentStatus === "processed" &&
            paymentStatusDetail ===
            "accredited";

        // =========================================================
        // 15. DETERMINAR ESTADO PARA EL POS
        // =========================================================

        let estadoPOS:
            | "pendiente"
            | "aprobado"
            | "rechazado"
            | "cancelado"
            | "expirado"
            | "requiere_accion"
            | "desconocido";

        if (pagoConfirmado) {
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
            status === "created" ||
            status ===
            "at_terminal" ||
            status === "processing"
        ) {
            estadoPOS =
                "pendiente";
        } else if (
            status === "refunded"
        ) {
            // No debe ocurrir durante el cobro normal,
            // pero lo reconocemos para mantener coherencia
            // con los estados de Mercado Pago.
            estadoPOS =
                "desconocido";
        } else {
            estadoPOS =
                "desconocido";
        }

        // =========================================================
        // 16. ACTUALIZAR ESTADO LOCAL DE LA ORDER
        // =========================================================
        //
        // Solo actualizamos la Order que pertenece al negocio
        // autenticado.
        // =========================================================

        const estadoLocal =
            pagoConfirmado
                ? "aprobado"
                : estadoPOS;

        const {
            error: errorActualizacion,
        } =
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
        // 17. RESPUESTA PARA EL POS
        // =========================================================

        return NextResponse.json(
            {
                ok: true,

                order_id:
                    data?.id ??
                    order_id,

                status,

                status_detail:
                    statusDetail,

                estado_pos:
                    estadoPOS,

                pago_confirmado:
                    pagoConfirmado,

                external_reference:
                    data?.external_reference ??
                    ordenLocal.external_reference ??
                    null,

                total_paid_amount:
                    data?.total_paid_amount ??
                    null,

                currency:
                    data?.currency ??
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