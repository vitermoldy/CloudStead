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
