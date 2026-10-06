-- ============================================================
-- 003_sync_queue.sql
-- Cola local de sincronización - Punto de Venta v1.6.0
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    entidad TEXT NOT NULL,
    operacion TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    intentos INTEGER NOT NULL DEFAULT 0,
    ultimo_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_estado_created_at
    ON sync_queue (estado, created_at);

CREATE INDEX IF NOT EXISTS idx_sync_queue_device_id
    ON sync_queue (device_id);

CREATE INDEX IF NOT EXISTS idx_sync_queue_registro
    ON sync_queue (entidad, registro_id);
