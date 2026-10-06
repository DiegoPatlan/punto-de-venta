-- ============================================================
-- 002_sync_infrastructure.sql
-- Infraestructura de sincronización - Punto de Venta v1.6.0
-- ============================================================

CREATE TABLE IF NOT EXISTS device_info (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    device_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
