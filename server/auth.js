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

export const USERNAME = /^[A-Za-z0-9_.-]{3,24}$/
export const PASSWORD_MIN = 6
export const PASSWORD_MAX = 128
const SESSION_DAYS = 30
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEYLEN = 64

const MESSAGES = {
  id: {
    username: 'Username 3 sampai 24 karakter: huruf, angka, titik, garis bawah, atau tanda minus.',
    password: `Kata sandi minimal ${PASSWORD_MIN} karakter.`,
    passwordLong: `Kata sandi paling panjang ${PASSWORD_MAX} karakter.`,
    taken: 'Username itu sudah dipakai. Pilih yang lain.',
    wrong: 'Username atau kata sandi salah.',
    signedOut: 'Kamu belum masuk.',
    tooMany: 'Terlalu banyak percobaan masuk. Tunggu satu menit, lalu coba lagi.',
  },
  en: {
    username: 'A username has 3 to 24 characters: letters, digits, dots, underscores or hyphens.',
    password: `A password has at least ${PASSWORD_MIN} characters.`,
    passwordLong: `A password has at most ${PASSWORD_MAX} characters.`,
    taken: 'That username is taken. Pick another one.',
    wrong: 'Wrong username or password.',
    signedOut: 'You are not signed in.',
    tooMany: 'Too many sign-in attempts. Wait a minute, then try again.',
  },
}

const scrypt = (password, salt, keylen, options) =>
  new Promise((resolve, reject) => scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))))

/** "scrypt$N$r$p$salt$hash": everything needed to check the password again later. */
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, KEYLEN, SCRYPT)
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$')
}

export async function verifyPassword(password, stored) {
  const [kind, n, r, p, salt, hash] = String(stored).split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function readCookie(req, name) {
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const at = part.indexOf('=')
    if (at > 0 && part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim())
  }
  return undefined
}

/** At most `limit` attempts per minute per address: slows down password guessing. */
function attemptLimit(limit, message) {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const key = req.ip ?? 'unknown'
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000)
    recent.push(now)
    hits.set(key, recent)
    if (hits.size > 5000) hits.clear()
    if (recent.length > limit) return res.status(429).json({ error: message })
    next()
  }
}

/**
 * @param {object} options
 * @param {() => import('mysql2/promise').Pool | null} options.getPool
 * @param {string} options.cookie  cookie name, unique per app: every app on localhost shares one cookie jar
 * @param {'id' | 'en'} options.lang
 * @param {RegExp} options.deviceCode  shape of this app's data key
 * @param {() => string} options.newDevice  makes a fresh data key
 */
export function createAuth({ getPool, cookie, lang, deviceCode, newDevice }) {
  const t = MESSAGES[lang]
  const router = express.Router()
  // Checked against when the username does not exist, so a wrong name takes as long as a wrong password.
  const decoy = hashPassword(randomBytes(12).toString('hex'))

  const publicUser = (row) => ({ username: row.username, createdAt: row.created_at })

  function setCookie(req, res, token, maxAge) {
    const secure = req.secure ? '; Secure' : ''
    res.setHeader('Set-Cookie', `${cookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`)
  }

  async function startSession(req, res, userId) {
    const token = randomBytes(32).toString('base64url')
    const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000)
    const pool = getPool()
    await pool.query('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, UTC_TIMESTAMP(), ?, ?)', [
      sha256(token),
      userId,
      expires,
      String(req.headers['user-agent'] ?? '').slice(0, 255) || null,
    ])
    await pool.query('UPDATE users SET last_login_at = UTC_TIMESTAMP(), last_seen_at = UTC_TIMESTAMP(), login_count = login_count + 1 WHERE id = ?', [userId])
    await pool.query('DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()')
    setCookie(req, res, token, SESSION_DAYS * 86_400)
  }

  /** The signed-in user, or null. Also notes when the account was last active. */
  async function userFor(req) {
    const token = readCookie(req, cookie)
    if (!token) return null
    const pool = getPool()
    const [rows] = await pool.query(
      'SELECT u.id, u.username, u.device_id, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()',
      [sha256(token)],
    )
    const row = rows[0]
    if (!row) return null
    await pool.query('UPDATE users SET last_seen_at = UTC_TIMESTAMP() WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < UTC_TIMESTAMP() - INTERVAL 1 MINUTE)', [row.id])
    return { id: row.id, username: row.username, device: row.device_id, createdAt: row.created_at }
  }

  /** Lets the request through only when someone is signed in; `req.user.device` is their data key. */
  async function requireUser(req, res, next) {
    try {
      const user = await userFor(req)
      if (!user) return res.status(401).json({ error: t.signedOut })
      req.user = user
      next()
    } catch (err) {
      next(err)
    }
  }

  function credentials(body) {
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!USERNAME.test(username)) return { error: t.username }
    if (password.length < PASSWORD_MIN) return { error: t.password }
    if (password.length > PASSWORD_MAX) return { error: t.passwordLong }
    return { username, password }
  }

