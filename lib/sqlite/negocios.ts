import { getSQLiteDatabase } from "./database";

export interface SQLiteNegocio {
  id: string;
  nombre: string;
  tipo_negocio: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  logo_url: string | null;
  activo: number;
  impuestos_activos: number;
  iva_porcentaje: number;
  recargo_tarjeta_activo: number;
  recargo_tarjeta_porcentaje: number;
  created_at: string;
}

export async function obtenerNegocio(
  negocioId: string
): Promise<SQLiteNegocio | null> {
  const db = await getSQLiteDatabase();

  const rows = await db.select<SQLiteNegocio[]>(
    `
      SELECT
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
      FROM negocios
      WHERE id = $1
      LIMIT 1
    `,
    [negocioId]
  );

  return rows[0] ?? null;
}
