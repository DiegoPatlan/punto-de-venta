import { NextRequest, NextResponse } from "next/server";

type Params = {
    params: Promise<{
        order_id: string;
    }>;
};

export async function GET(
    _request: NextRequest,
    { params }: Params
) {
    try {
        // =========================================================
        // 1. ACCESS TOKEN
        // =========================================================

        const accessToken =
            process.env.MERCADOPAGO_ACCESS_TOKEN;

        if (!accessToken) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "MERCADOPAGO_ACCESS_TOKEN no está configurado.",
                },
                { status: 500 }
            );
        }

        // =========================================================
        // 2. OBTENER ORDER ID
        // =========================================================

        const { order_id } = await params;

        if (!order_id) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Falta el order_id.",
                },
                { status: 400 }
            );
        }

        // =========================================================
        // 3. CONSULTAR ORDER EN MERCADO PAGO
        // =========================================================

        const response = await fetch(
            `https://api.mercadopago.com/v1/orders/${order_id}`,
            {
                method: "GET",

                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,

                    "Content-Type":
                        "application/json",
                },

                cache: "no-store",
            }
        );

        const data = await response.json();

        // =========================================================
        // 4. ERROR MERCADO PAGO
        // =========================================================

        if (!response.ok) {
            console.error(
                "Mercado Pago error consultando Order:",
                data
            );

            return NextResponse.json(
                {
                    ok: false,
                    status: response.status,
                    error: data,
                },
                {
                    status: response.status,
                }
            );
        }

        // =========================================================
        // 5. INFORMACIÓN GENERAL DE LA ORDER
        // =========================================================

        const status =
            data?.status ?? null;

        const statusDetail =
            data?.status_detail ?? null;

        // =========================================================
        // 6. OBTENER INFORMACIÓN DEL PAGO
        // =========================================================

        const payments =
            data?.transactions?.payments ?? [];

        const primerPago =
            payments.length > 0
                ? payments[0]
                : null;

        const paymentStatus =
            primerPago?.status ?? null;

        const paymentStatusDetail =
            primerPago?.status_detail ?? null;

        const paymentMethod =
            primerPago?.payment_method ?? null;

        // =========================================================
        // 7. DETERMINAR SI EL PAGO FUE CONFIRMADO
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
            paymentStatus === "processed" &&
            paymentStatusDetail === "accredited";

        // =========================================================
        // 8. ESTADO DEL PROCESO
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
            estadoPOS = "aprobado";
        } else if (
            status === "failed"
        ) {
            estadoPOS = "rechazado";
        } else if (
            status === "canceled"
        ) {
            estadoPOS = "cancelado";
        } else if (
            status === "expired"
        ) {
            estadoPOS = "expirado";
        } else if (
            status === "action_required"
        ) {
            estadoPOS = "requiere_accion";
        } else if (
            status === "created" ||
            status === "processing"
        ) {
            estadoPOS = "pendiente";
        } else {
            estadoPOS = "desconocido";
        }

        // =========================================================
        // 9. RESPUESTA PARA EL POS
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