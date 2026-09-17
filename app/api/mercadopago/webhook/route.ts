import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log("=================================");
        console.log("MERCADO PAGO WEBHOOK RECIBIDO");
        console.log("=================================");
        console.log(JSON.stringify(body, null, 2));

        const action = body?.action ?? null;
        const orderId = body?.data?.id ?? null;

        console.log("Action:", action);
        console.log("Order ID:", orderId);

        return NextResponse.json(
            {
                ok: true,
                received: true,
                action,
                order_id: orderId,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error procesando webhook de Mercado Pago:", error);

        return NextResponse.json(
            {
                ok: false,
                error: "No se pudo procesar la notificación.",
            },
            { status: 400 }
        );
    }
}