import { supabasePOS } from "../supabase";
import { getSQLiteDatabase } from "./database";
import { obtenerUsuarioPOS } from "../usuarioPOS";

interface SesionCajaRow {
    id: string;
    caja_id: string;
    usuario_apertura_id: string;
    usuario_cierre_id: string | null;
    monto_inicial: number;
    monto_esperado: number | null;
    monto_real: number | null;
    diferencia: number | null;
    estado: string;
    fecha_apertura: string;
    fecha_cierre: string | null;
}

interface MovimientoCajaRow {
    id: string;
    sesion_caja_id: string;
    usuario_id: string;
    tipo: string;
    concepto: string | null;
    monto: number;
    referencia_id: string | null;
    created_at: string;
    usuario_autorizacion_id: string | null;
    usuario_autorizador_id: string | null;
}

interface VentaRow {
    id: string;
    negocio_id: string;
    sucursal_id: string;
    caja_id: string;
    sesion_caja_id: string;
    usuario_id: string;
    cliente_id: string | null;
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
    metodo_pago: string;
    estado: string;
    referencia: string | null;
    notas: string | null;
    created_at: string;
    folio: number | null;
}

interface PagoRow {
    id: string;
    venta_id: string;
    metodo_pago: string;
    monto: number;
    monto_recibido: number | null;
    cambio: number;
    referencia: string | null;
    created_at: string;
}

interface DetalleVentaRow {
    id: string;
    venta_id: string;
    producto_id: string;
    cantidad: number;
    precio_unitario: number;
    descuento: number;
    impuesto: number;
    subtotal: number;
    total: number;
    created_at: string;
}

export interface ResultadoSincronizacionOperativa {
    sesionId: string;
    sesionesCaja: number;
    movimientosCaja: number;
    ventas: number;
    pagos: number;
    detallesVenta: number;
    total: number;
}

function numeroSeguro(
    valor: number | null | undefined
): number {
    const numero = Number(valor ?? 0);

    return Number.isFinite(numero)
        ? numero
        : 0;
}

async function obtenerDatosSupabase<T>(
    consulta: PromiseLike<{
        data: T[] | null;
        error: {
            message: string;
            details?: string;
            hint?: string;
            code?: string;
        } | null;
    }>
): Promise<T[]> {
    const resultado = await consulta;

    if (resultado.error) {
        throw new Error(
            [
                resultado.error.message,
                resultado.error.code
                    ? `Código: ${resultado.error.code}`
                    : null,
                resultado.error.details
                    ? `Detalles: ${resultado.error.details}`
                    : null,
                resultado.error.hint
                    ? `Ayuda: ${resultado.error.hint}`
                    : null,
            ]
                .filter(Boolean)
                .join(" | ")
        );
    }

    return resultado.data ?? [];
}

export async function sincronizarOperacionSesion(
    sesionId: string
): Promise<ResultadoSincronizacionOperativa> {
    if (!sesionId) {
        throw new Error(
            "No se recibió el ID de la sesión de caja."
        );
    }

    const usuario = await obtenerUsuarioPOS();

    if (!usuario) {
        throw new Error(
            "No se pudo obtener el usuario POS autenticado."
        );
    }

    if (!usuario.negocio_id) {
        throw new Error(
            "El usuario POS no tiene un negocio asociado."
        );
    }

    const db = await getSQLiteDatabase();

    // ============================================================
    // 1. SESIÓN DE CAJA
    // ============================================================

    const sesiones = await obtenerDatosSupabase<SesionCajaRow>(
        supabasePOS
            .from("sesiones_caja")
            .select(`
        id,
        caja_id,
        usuario_apertura_id,
        usuario_cierre_id,
        monto_inicial,
        monto_esperado,
        monto_real,
        diferencia,
        estado,
        fecha_apertura,
        fecha_cierre
      `)
            .eq("id", sesionId)
            .limit(1)
    );

    if (sesiones.length === 0) {
        throw new Error(
            "La sesión de caja indicada no existe en Supabase."
        );
    }

    const sesion = sesiones[0];

    // ============================================================
    // 2. MOVIMIENTOS DE CAJA
    // ============================================================

    const movimientosCaja =
        await obtenerDatosSupabase<MovimientoCajaRow>(
            supabasePOS
                .from("movimientos_caja")
                .select(`
          id,
          sesion_caja_id,
          usuario_id,
          tipo,
          concepto,
          monto,
          referencia_id,
          created_at,
          usuario_autorizacion_id,
          usuario_autorizador_id
        `)
                .eq(
                    "sesion_caja_id",
                    sesionId
                )
                .order(
                    "created_at",
                    {
                        ascending: true,
                    }
                )
        );

    // ============================================================
    // 3. VENTAS
    // ============================================================

    const ventas =
        await obtenerDatosSupabase<VentaRow>(
            supabasePOS
                .from("ventas")
                .select(`
          id,
          negocio_id,
          sucursal_id,
          caja_id,
          sesion_caja_id,
          usuario_id,
          cliente_id,
          subtotal,
          descuento,
          impuesto,
          total,
          metodo_pago,
          estado,
          referencia,
          notas,
          created_at,
          folio
        `)
                .eq(
                    "sesion_caja_id",
                    sesionId
                )
                .eq(
                    "negocio_id",
                    usuario.negocio_id
                )
                .order(
                    "created_at",
                    {
                        ascending: true,
                    }
                )
        );

    // ============================================================
    // 4. PAGOS
    // ============================================================

    const ventaIds = ventas.map(
        (venta) => venta.id
    );

    let pagos: PagoRow[] = [];

    if (ventaIds.length > 0) {
        pagos =
            await obtenerDatosSupabase<PagoRow>(
                supabasePOS
                    .from("pagos")
                    .select(`
            id,
            venta_id,
            metodo_pago,
            monto,
            monto_recibido,
            cambio,
            referencia,
            created_at
          `)
                    .in(
                        "venta_id",
                        ventaIds
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true,
                        }
                    )
            );
    }

    // ============================================================
    // 5. DETALLES DE VENTA
    // ============================================================

    let detallesVenta: DetalleVentaRow[] = [];

    if (ventaIds.length > 0) {
        detallesVenta =
            await obtenerDatosSupabase<DetalleVentaRow>(
                supabasePOS
                    .from("detalle_ventas")
                    .select(`
            id,
            venta_id,
            producto_id,
            cantidad,
            precio_unitario,
            descuento,
            impuesto,
            subtotal,
            total,
            created_at
          `)
                    .in(
                        "venta_id",
                        ventaIds
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true,
                        }
                    )
            );
    }

    // ============================================================
    // 6. UPSERT DE SESIÓN
    // ============================================================

    await db.execute(
        `
      INSERT INTO sesiones_caja (
        id,
        caja_id,
        usuario_apertura_id,
        usuario_cierre_id,
        monto_inicial,
        monto_esperado,
        monto_real,
        diferencia,
        estado,
        fecha_apertura,
        fecha_cierre
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        caja_id = excluded.caja_id,
        usuario_apertura_id = excluded.usuario_apertura_id,
        usuario_cierre_id = excluded.usuario_cierre_id,
        monto_inicial = excluded.monto_inicial,
        monto_esperado = excluded.monto_esperado,
        monto_real = excluded.monto_real,
        diferencia = excluded.diferencia,
        estado = excluded.estado,
        fecha_apertura = excluded.fecha_apertura,
        fecha_cierre = excluded.fecha_cierre
    `,
        [
            sesion.id,
            sesion.caja_id,
            sesion.usuario_apertura_id,
            sesion.usuario_cierre_id,
            numeroSeguro(sesion.monto_inicial),
            sesion.monto_esperado === null
                ? null
                : numeroSeguro(sesion.monto_esperado),
            sesion.monto_real === null
                ? null
                : numeroSeguro(sesion.monto_real),
            sesion.diferencia === null
                ? null
                : numeroSeguro(sesion.diferencia),
            sesion.estado,
            sesion.fecha_apertura,
            sesion.fecha_cierre,
        ]
    );

    // ============================================================
    // 7. UPSERT DE MOVIMIENTOS DE CAJA
    // ============================================================

    for (const movimiento of movimientosCaja) {
        await db.execute(
            `
        INSERT INTO movimientos_caja (
          id,
          sesion_caja_id,
          usuario_id,
          tipo,
          concepto,
          monto,
          referencia_id,
          created_at,
          usuario_autorizacion_id,
          usuario_autorizador_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          sesion_caja_id = excluded.sesion_caja_id,
          usuario_id = excluded.usuario_id,
          tipo = excluded.tipo,
          concepto = excluded.concepto,
          monto = excluded.monto,
          referencia_id = excluded.referencia_id,
          created_at = excluded.created_at,
          usuario_autorizacion_id =
            excluded.usuario_autorizacion_id,
          usuario_autorizador_id =
            excluded.usuario_autorizador_id
      `,
            [
                movimiento.id,
                movimiento.sesion_caja_id,
                movimiento.usuario_id,
                movimiento.tipo,
                movimiento.concepto,
                numeroSeguro(movimiento.monto),
                movimiento.referencia_id,
                movimiento.created_at,
                movimiento.usuario_autorizacion_id,
                movimiento.usuario_autorizador_id,
            ]
        );
    }

    // ============================================================
    // 8. UPSERT DE VENTAS
    // ============================================================

    for (const venta of ventas) {
        await db.execute(
            `
        INSERT INTO ventas (
          id,
          negocio_id,
          sucursal_id,
          caja_id,
          sesion_caja_id,
          usuario_id,
          cliente_id,
          subtotal,
          descuento,
          impuesto,
          total,
          metodo_pago,
          estado,
          referencia,
          notas,
          created_at,
          folio
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          negocio_id = excluded.negocio_id,
          sucursal_id = excluded.sucursal_id,
          caja_id = excluded.caja_id,
          sesion_caja_id = excluded.sesion_caja_id,
          usuario_id = excluded.usuario_id,
          cliente_id = excluded.cliente_id,
          subtotal = excluded.subtotal,
          descuento = excluded.descuento,
          impuesto = excluded.impuesto,
          total = excluded.total,
          metodo_pago = excluded.metodo_pago,
          estado = excluded.estado,
          referencia = excluded.referencia,
          notas = excluded.notas,
          created_at = excluded.created_at,
          folio = excluded.folio
      `,
            [
                venta.id,
                venta.negocio_id,
                venta.sucursal_id,
                venta.caja_id,
                venta.sesion_caja_id,
                venta.usuario_id,
                venta.cliente_id,
                numeroSeguro(venta.subtotal),
                numeroSeguro(venta.descuento),
                numeroSeguro(venta.impuesto),
                numeroSeguro(venta.total),
                venta.metodo_pago,
                venta.estado,
                venta.referencia,
                venta.notas,
                venta.created_at,
                venta.folio,
            ]
        );
    }

    // ============================================================
    // 9. UPSERT DE PAGOS
    // ============================================================

    for (const pago of pagos) {
        await db.execute(
            `
        INSERT INTO pagos (
          id,
          venta_id,
          metodo_pago,
          monto,
          monto_recibido,
          cambio,
          referencia,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          venta_id = excluded.venta_id,
          metodo_pago = excluded.metodo_pago,
          monto = excluded.monto,
          monto_recibido = excluded.monto_recibido,
          cambio = excluded.cambio,
          referencia = excluded.referencia,
          created_at = excluded.created_at
      `,
            [
                pago.id,
                pago.venta_id,
                pago.metodo_pago,
                numeroSeguro(pago.monto),
                pago.monto_recibido === null
                    ? null
                    : numeroSeguro(pago.monto_recibido),
                numeroSeguro(pago.cambio),
                pago.referencia,
                pago.created_at,
            ]
        );
    }

    // ============================================================
    // 10. UPSERT DE DETALLES DE VENTA
    // ============================================================

    for (const detalle of detallesVenta) {
        await db.execute(
            `
        INSERT INTO detalle_ventas (
          id,
          venta_id,
          producto_id,
          cantidad,
          precio_unitario,
          descuento,
          impuesto,
          subtotal,
          total,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          venta_id = excluded.venta_id,
          producto_id = excluded.producto_id,
          cantidad = excluded.cantidad,
          precio_unitario = excluded.precio_unitario,
          descuento = excluded.descuento,
          impuesto = excluded.impuesto,
          subtotal = excluded.subtotal,
          total = excluded.total,
          created_at = excluded.created_at
      `,
            [
                detalle.id,
                detalle.venta_id,
                detalle.producto_id,
                numeroSeguro(detalle.cantidad),
                numeroSeguro(detalle.precio_unitario),
                numeroSeguro(detalle.descuento),
                numeroSeguro(detalle.impuesto),
                numeroSeguro(detalle.subtotal),
                numeroSeguro(detalle.total),
                detalle.created_at,
            ]
        );
    }

    const resultado: ResultadoSincronizacionOperativa = {
        sesionId,
        sesionesCaja: 1,
        movimientosCaja: movimientosCaja.length,
        ventas: ventas.length,
        pagos: pagos.length,
        detallesVenta: detallesVenta.length,
        total:
            1 +
            movimientosCaja.length +
            ventas.length +
            pagos.length +
            detallesVenta.length,
    };

    console.log(
        "Sincronización operativa SQLite completada:",
        resultado
    );

    return resultado;
}