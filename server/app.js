import express from 'express'
import project from './project.js'

/**
 * The API, the same in every app:
 *   PUT  /api/save            { device, data }  mirror the browser save
 *   GET  /api/save/:device                      the save, to restore it in another browser
 *   POST /api/events          { device, events } record what happened
 *   GET  /api/stats/:device                     the app's own summary of those events
 *   GET  /api/health
 * There are no accounts: a device is its 12-character recovery code. Anyone who
 * knows a code can read and replace that save, so the code is shown only to its owner.
 */

const CODE = /^[A-HJ-NP-Z2-9]{12}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const YEAR = 365 * 24 * 3600 * 1000

/** Writes come as JSON from this site only: no form posts, no other origin. */
function sameOriginWrites(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next()
  if (!req.is('application/json')) return res.status(415).json({ error: 'Kirim data sebagai JSON.' })
  const origin = req.headers.origin
  if (origin && req.headers.host && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Asal permintaan tidak dikenal.' })
  next()
}

/** At most `limit` writes per minute per address, enough for a busy tab and not for a script. */
function rateLimit(limit) {
  const hits = new Map()
  return (req, res, next) => {
    if (req.method === 'GET') return next()
    const now = Date.now()
    const key = req.ip ?? 'unknown'
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000)
    recent.push(now)
    hits.set(key, recent)
    if (hits.size > 5000) hits.clear()
    if (recent.length > limit) return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' })
    next()
  }
}

/** The pool appears once MySQL answers; until then the API says so instead of hanging. */
export function createApi(getPool) {
  const api = express.Router()
  api.use(express.json({ limit: project.maxSaveBytes + 64 * 1024 }))
