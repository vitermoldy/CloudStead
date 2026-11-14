import { dayRange, streak } from './dates.js'

/**
 * What this app keeps in MySQL: every focus session that ran to the end (its
 * minutes and its timer preset), and a copy of the browser save.
 */
export default {
  name: 'CloudStead',
  database: 'cloudstead',
  port: 8791,
  maxSaveBytes: 256 * 1024,
  events: {
    /** A focus phase that reached zero. */
    focus(data) {
      const minutes = Number(data?.minutes)
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) return null
      const preset = typeof data?.preset === 'string' ? data.preset.slice(0, 16) : undefined
      return { minutes: Math.round(minutes * 10) / 10, ...(preset ? { preset } : {}) }
    },
  },
  async stats(pool, device, { days, today }) {
    const range = dayRange(today, days)
    const [[total]] = await pool.query(
