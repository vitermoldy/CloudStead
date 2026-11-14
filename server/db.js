import mysql from 'mysql2/promise'

/**
 * Three tables, the same in every app:
 * - devices: one row per browser, keyed by its recovery code;
