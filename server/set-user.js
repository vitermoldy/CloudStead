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
