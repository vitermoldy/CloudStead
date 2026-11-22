import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import express from 'express'

/**
 * Accounts: a username and a password. Each account owns one data key (`device_id`),
 * the code this app already filed its saves and events under, so signing up keeps
 * the progress the browser already has and signing in elsewhere brings it along.
 *
 *   POST /api/auth/register  { username, password, device? }  new account, signed in
 *   POST /api/auth/login     { username, password }           signed in
 *   POST /api/auth/logout
 *   GET  /api/auth/me                                         who is signed in, 401 if nobody
 *
 * The session is an HttpOnly cookie. Only a SHA-256 of its token is stored, so a
 * copy of the sessions table cannot be used to sign in.
 */

export const AUTH_TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(24) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL,
    last_login_at DATETIME NULL,
    last_seen_at DATETIME NULL,
    login_count INT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE KEY users_username (username),
    UNIQUE KEY users_device (device_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    user_agent VARCHAR(255) NULL,
    INDEX sessions_by_user (user_id),
    CONSTRAINT sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
]

