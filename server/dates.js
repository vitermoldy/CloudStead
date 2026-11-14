/** Day helpers for the stats. Days are the local dates the browser reported, as YYYY-MM-DD. */

/** The last `days` local dates up to `today`, oldest first, for a per-day chart with no gaps. */
export function dayRange(today, days) {
  const [y, m, d] = today.split('-').map(Number)
  const end = Date.UTC(y, m - 1, d)
  return Array.from({ length: days }, (_, i) => new Date(end - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10))
