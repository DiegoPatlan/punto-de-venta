import Database from "@tauri-apps/plugin-sql";

let database: Database | null = null;

export async function getSQLiteDatabase(): Promise<Database> {
  if (typeof window === "undefined") {
    throw new Error("SQLite solo está disponible en el entorno de escritorio.");
  }

  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error(
      "SQLite local solo está disponible dentro de la aplicación de escritorio."
    );
  }

  if (!database) {
    database = await Database.load("sqlite:pos.db");
  }

  return database;
}
