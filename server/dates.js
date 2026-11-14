/** Day helpers for the stats. Days are the local dates the browser reported, as YYYY-MM-DD. */

/** The last `days` local dates up to `today`, oldest first, for a per-day chart with no gaps. */
export function dayRange(today, days) {
  const [y, m, d] = today.split('-').map(Number)
