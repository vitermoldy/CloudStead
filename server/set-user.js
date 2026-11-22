import { randomInt } from 'node:crypto'
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN, USERNAME } from './auth.js'
import { config } from './config.js'
import { connect } from './db.js'
import project from './project.js'

/**
 * `npm run set-user -- <username> <password>`: makes an account, or gives an existing
 * one a new password (there is no reset by email, so this is the reset). A new account
 * takes over the newest data nobody owns yet, so what this app recorded before accounts
 * existed becomes that account's.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const [username = '', password = ''] = process.argv.slice(2)
if (!USERNAME.test(username) || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
  console.error(`Pakai: npm run set-user -- <username> <kata sandi>\nUsername 3 sampai 24 karakter (huruf, angka, titik, garis bawah, minus), kata sandi ${PASSWORD_MIN} sampai ${PASSWORD_MAX} karakter.`)
  process.exit(1)
}

const pool = await connect(config.db)
const hash = await hashPassword(password)
const [[found]] = await pool.query('SELECT id, username FROM users WHERE username = ?', [username])
if (found) {
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, found.id])
  // A new password signs the account out everywhere.
  await pool.query('DELETE FROM sessions WHERE user_id = ?', [found.id])
  console.log(`${project.name}: kata sandi ${found.username} diganti. Semua sesinya dikeluarkan.`)
} else {
  const [[free]] = await pool.query(
    `SELECT d.id, (SELECT COUNT(*) FROM events e WHERE e.device_id = d.id) AS events, (SELECT COUNT(*) FROM saves s WHERE s.device_id = d.id) AS saves
     FROM devices d LEFT JOIN users u ON u.device_id = d.id WHERE u.id IS NULL ORDER BY d.last_seen DESC LIMIT 1`,
  )
  const device = free?.id ?? Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  await pool.query('INSERT INTO users (username, password_hash, device_id, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())', [username, hash, device])
