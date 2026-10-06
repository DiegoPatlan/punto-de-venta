import { supabasePOS } from "../supabase";
import { getSQLiteDatabase } from "./database";
import { obtenerUsuarioPOS } from "../usuarioPOS";

interface NegocioRow {
    id: string;
    nombre: string;
    tipo_negocio: string | null;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    logo_url: string | null;
    activo: boolean;
    impuestos_activos: boolean;
    iva_porcentaje: number;
    recargo_tarjeta_activo: boolean;
    recargo_tarjeta_porcentaje: number;
    created_at: string;
}

interface SucursalRow {
    id: string;
    negocio_id: string;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    activo: boolean;
    created_at: string;
}

interface CategoriaRow {
    id: string;
    negocio_id: string;
    nombre: string;
    descripcion: string | null;
    activo: boolean;
    created_at: string;
}

interface ProductoRow {
    id: string;
    negocio_id: string;
    categoria_id: string | null;
    codigo_barras: string | null;
    sku: string | null;
    nombre: string;
    descripcion: string | null;
    precio_compra: number;
    precio_venta: number;
    unidad: string;
    imagen_url: string | null;
    stock_minimo: number;
    activo: boolean;
    created_at: string;
    updated_at: string | null;
    precio_base: number | null;
}

interface InventarioRow {
    id: string;
    producto_id: string;
    sucursal_id: string;
    stock: number;
    stock_reservado: number;
    created_at: string;
    updated_at: string | null;
}

interface ClienteRow {
    id: string;
    negocio_id: string;
    nombre: string;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    rfc: string | null;
    limite_credito: number;
    saldo_credito: number;
    activo: boolean;
    created_at: string;
}

export interface ResultadoSincronizacionCatalogo {
    negocioId: string;
    negocio: number;
    sucursales: number;
    categorias: number;
    productos: number;
    inventario: number;
    clientes: number;
    total: number;
}

function booleanoSQLite(valor: boolean): number {
    return valor ? 1 : 0;
}

function numeroSeguro(valor: number | null | undefined): number {
    if (valor === null || valor === undefined) {
        return 0;
    }

    const numero = Number(valor);

    return Number.isFinite(numero) ? numero : 0;
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

export async function sincronizarCatalogo(): Promise<ResultadoSincronizacionCatalogo> {
    const usuario = await obtenerUsuarioPOS();

    if (!usuario) {
        throw new Error("No se pudo obtener el usuario POS autenticado.");
    }

    const negocioId = usuario.negocio_id;

    if (!negocioId) {
        throw new Error("El usuario POS no tiene un negocio asociado.");
    }

    const db = await getSQLiteDatabase();

    /*
     * ============================================================
     * 1. OBTENER NEGOCIO
     * ============================================================
     */

    const negocios = await obtenerDatosSupabase<NegocioRow>(
        supabasePOS
            .from("negocios")
            .select(
                `
          id,
          nombre,
          tipo_negocio,
          telefono,
          email,
          direccion,
          logo_url,
          activo,
          impuestos_activos,
          iva_porcentaje,
          recargo_tarjeta_activo,
          recargo_tarjeta_porcentaje,
          created_at
        `
            )
            .eq("id", negocioId)
    );

    /*
     * ============================================================
     * 2. OBTENER SUCURSALES
     * ============================================================
     */

    const sucursales = await obtenerDatosSupabase<SucursalRow>(
        supabasePOS
            .from("sucursales")
            .select(
                `
          id,
          negocio_id,
          nombre,
          direccion,
          telefono,
          activo,
          created_at
        `
            )
            .eq("negocio_id", negocioId)
    );

    const idsSucursales = sucursales.map(
        (sucursal) => sucursal.id
    );

    /*
     * ============================================================
     * 3. OBTENER CATEGORÍAS
     * ============================================================
     */

    const categorias = await obtenerDatosSupabase<CategoriaRow>(
        supabasePOS
            .from("categorias")
            .select(
                `
          id,
          negocio_id,
          nombre,
          descripcion,
          activo,
          created_at
        `
            )
            .eq("negocio_id", negocioId)
    );

    /*
     * ============================================================
     * 4. OBTENER PRODUCTOS
     * ============================================================
     */

    const productos = await obtenerDatosSupabase<ProductoRow>(
        supabasePOS
            .from("productos")
            .select(
                `
          id,
          negocio_id,
          categoria_id,
          codigo_barras,
          sku,
          nombre,
          descripcion,
          precio_compra,
          precio_venta,
          unidad,
          imagen_url,
          stock_minimo,
          activo,
          created_at,
          updated_at,
          precio_base
        `
            )
            .eq("negocio_id", negocioId)
    );

    const idsProductos = productos.map(
        (producto) => producto.id
    );

    /*
     * ============================================================
     * 5. OBTENER INVENTARIO
     * ============================================================
     */

    let inventario: InventarioRow[] = [];

    if (
        idsProductos.length > 0 &&
        idsSucursales.length > 0
    ) {
        inventario =
            await obtenerDatosSupabase<InventarioRow>(
                supabasePOS
                    .from("inventario")
                    .select(
                        `
              id,
              producto_id,
              sucursal_id,
              stock,
              stock_reservado,
              created_at,
              updated_at
            `
                    )
                    .in("producto_id", idsProductos)
                    .in("sucursal_id", idsSucursales)
            );
    }

    /*
     * ============================================================
     * 6. OBTENER CLIENTES
     * ============================================================
     */

    const clientes = await obtenerDatosSupabase<ClienteRow>(
        supabasePOS
            .from("clientes")
            .select(
                `
          id,
          negocio_id,
          nombre,
          telefono,
          email,
          direccion,
          rfc,
          limite_credito,
          saldo_credito,
          activo,
          created_at
        `
            )
            .eq("negocio_id", negocioId)
    );

    /*
     * ============================================================
     * 7. UPSERT DEL NEGOCIO
     * ============================================================
     */

    for (const negocio of negocios) {
        await db.execute(
            `
        INSERT INTO negocios (
          id,
          nombre,
          tipo_negocio,
          telefono,
          email,
          direccion,
          logo_url,
          activo,
          impuestos_activos,
          iva_porcentaje,
          recargo_tarjeta_activo,
          recargo_tarjeta_porcentaje,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13
        )
        ON CONFLICT(id) DO UPDATE SET
          nombre = excluded.nombre,
          tipo_negocio = excluded.tipo_negocio,
          telefono = excluded.telefono,
          email = excluded.email,
          direccion = excluded.direccion,
          logo_url = excluded.logo_url,
          activo = excluded.activo,
          impuestos_activos = excluded.impuestos_activos,
          iva_porcentaje = excluded.iva_porcentaje,
          recargo_tarjeta_activo = excluded.recargo_tarjeta_activo,
          recargo_tarjeta_porcentaje = excluded.recargo_tarjeta_porcentaje,
          created_at = excluded.created_at
      `,
            [
                negocio.id,
                negocio.nombre,
                negocio.tipo_negocio,
                negocio.telefono,
                negocio.email,
                negocio.direccion,
                negocio.logo_url,
                booleanoSQLite(negocio.activo),
                booleanoSQLite(negocio.impuestos_activos),
                numeroSeguro(negocio.iva_porcentaje),
                booleanoSQLite(negocio.recargo_tarjeta_activo),
                numeroSeguro(negocio.recargo_tarjeta_porcentaje),
                negocio.created_at,
            ]
        );
    }

    /*
     * ============================================================
     * 8. UPSERT DE SUCURSALES
     * ============================================================
     */

    for (const sucursal of sucursales) {
        await db.execute(
            `
        INSERT INTO sucursales (
          id,
          negocio_id,
          nombre,
          direccion,
          telefono,
          activo,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        ON CONFLICT(id) DO UPDATE SET
          negocio_id = excluded.negocio_id,
          nombre = excluded.nombre,
          direccion = excluded.direccion,
          telefono = excluded.telefono,
          activo = excluded.activo,
          created_at = excluded.created_at
      `,
            [
                sucursal.id,
                sucursal.negocio_id,
                sucursal.nombre,
                sucursal.direccion,
                sucursal.telefono,
                booleanoSQLite(sucursal.activo),
                sucursal.created_at,
            ]
        );
    }

    /*
     * ============================================================
     * 9. UPSERT DE CATEGORÍAS
     * ============================================================
     */

    for (const categoria of categorias) {
        await db.execute(
            `
        INSERT INTO categorias (
          id,
          negocio_id,
          nombre,
          descripcion,
          activo,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        ON CONFLICT(id) DO UPDATE SET
          negocio_id = excluded.negocio_id,
          nombre = excluded.nombre,
          descripcion = excluded.descripcion,
          activo = excluded.activo,
          created_at = excluded.created_at
      `,
            [
                categoria.id,
                categoria.negocio_id,
                categoria.nombre,
                categoria.descripcion,
                booleanoSQLite(categoria.activo),
                categoria.created_at,
            ]
        );
    }

    /*
     * ============================================================
     * 10. UPSERT DE PRODUCTOS
     * ============================================================
     */

    for (const producto of productos) {
        await db.execute(
            `
        INSERT INTO productos (
          id,
          negocio_id,
          categoria_id,
          codigo_barras,
          sku,
          nombre,
          descripcion,
          precio_compra,
          precio_venta,
          unidad,
          imagen_url,
          stock_minimo,
          activo,
          precio_base,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16
        )
        ON CONFLICT(id) DO UPDATE SET
          negocio_id = excluded.negocio_id,
          categoria_id = excluded.categoria_id,
          codigo_barras = excluded.codigo_barras,
          sku = excluded.sku,
          nombre = excluded.nombre,
          descripcion = excluded.descripcion,
          precio_compra = excluded.precio_compra,
          precio_venta = excluded.precio_venta,
          unidad = excluded.unidad,
          imagen_url = excluded.imagen_url,
          stock_minimo = excluded.stock_minimo,
          activo = excluded.activo,
          precio_base = excluded.precio_base,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
            [
                producto.id,
                producto.negocio_id,
                producto.categoria_id,
                producto.codigo_barras,
                producto.sku,
                producto.nombre,
                producto.descripcion,
                numeroSeguro(producto.precio_compra),
                numeroSeguro(producto.precio_venta),
                producto.unidad,
                producto.imagen_url,
                numeroSeguro(producto.stock_minimo),
                booleanoSQLite(producto.activo),
                producto.precio_base === null
                    ? null
                    : numeroSeguro(producto.precio_base),
                producto.created_at,
                producto.updated_at,
            ]
        );
    }

    /*
     * ============================================================
     * 11. UPSERT DE INVENTARIO
     * ============================================================
     */

    for (const item of inventario) {
        await db.execute(
            `
        INSERT INTO inventario (
          id,
          producto_id,
          sucursal_id,
          stock,
          stock_reservado,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        ON CONFLICT(id) DO UPDATE SET
          producto_id = excluded.producto_id,
          sucursal_id = excluded.sucursal_id,
          stock = excluded.stock,
          stock_reservado = excluded.stock_reservado,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
            [
                item.id,
                item.producto_id,
                item.sucursal_id,
                numeroSeguro(item.stock),
                numeroSeguro(item.stock_reservado),
                item.created_at,
                item.updated_at,
            ]
        );
    }

    /*
     * ============================================================
     * 12. UPSERT DE CLIENTES
     * ============================================================
     */

    for (const cliente of clientes) {
        await db.execute(
            `
        INSERT INTO clientes (
          id,
          negocio_id,
          nombre,
          telefono,
          email,
          direccion,
          rfc,
          limite_credito,
          saldo_credito,
          activo,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        )
        ON CONFLICT(id) DO UPDATE SET
          negocio_id = excluded.negocio_id,
          nombre = excluded.nombre,
          telefono = excluded.telefono,
          email = excluded.email,
          direccion = excluded.direccion,
          rfc = excluded.rfc,
          limite_credito = excluded.limite_credito,
          saldo_credito = excluded.saldo_credito,
          activo = excluded.activo,
          created_at = excluded.created_at
      `,
            [
                cliente.id,
                cliente.negocio_id,
                cliente.nombre,
                cliente.telefono,
                cliente.email,
                cliente.direccion,
                cliente.rfc,
                numeroSeguro(cliente.limite_credito),
                numeroSeguro(cliente.saldo_credito),
                booleanoSQLite(cliente.activo),
                cliente.created_at,
            ]
        );
    }

    const resultado: ResultadoSincronizacionCatalogo = {
        negocioId,
        negocio: negocios.length,
        sucursales: sucursales.length,
        categorias: categorias.length,
        productos: productos.length,
        inventario: inventario.length,
        clientes: clientes.length,
        total:
            negocios.length +
            sucursales.length +
            categorias.length +
            productos.length +
            inventario.length +
            clientes.length,
    };

    console.log(
        "Sincronización de catálogo SQLite completada:",
        resultado
    );

    return resultado;
}