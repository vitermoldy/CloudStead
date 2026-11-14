import mysql from 'mysql2/promise'

/**
 * Three tables, the same in every app:
 * - devices: one row per browser, keyed by its recovery code;
 * - saves: the app's browser save, mirrored as one JSON text per device;
 * - events: what happened (a focus session finished, a song played), for the stats.
 * Times are stored in UTC; `day` is the local date the browser reported, so a day
 * in the stats is the visitor's own day.
 */
const TABLES = [
  `CREATE TABLE IF NOT EXISTS devices (
    id CHAR(12) PRIMARY KEY,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
