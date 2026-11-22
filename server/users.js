import { config } from './config.js'
import { connect } from './db.js'
import project from './project.js'

/** `npm run users`: who has an account, when they joined, and what they have stored. */
const when = (d) => (d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-')

const pool = await connect(config.db)
const [rows] = await pool.query(
  `SELECT u.username, u.created_at, u.last_login_at, u.last_seen_at, u.login_count,
     (SELECT COUNT(*) FROM events e WHERE e.device_id = u.device_id) AS events,
     (SELECT s.bytes FROM saves s WHERE s.device_id = u.device_id) AS save_bytes,
     (SELECT s.updated_at FROM saves s WHERE s.device_id = u.device_id) AS saved_at
   FROM users u ORDER BY u.created_at`,
)
await pool.end()

if (rows.length === 0) {
  console.log(`${project.name}: belum ada akun di database ${config.db.database}.`)
} else {
  console.log(`${project.name}: ${rows.length} akun di database ${config.db.database}`)
  console.table(
    rows.map((r) => ({
      username: r.username,
      daftar: when(r.created_at),
      'terakhir masuk': when(r.last_login_at),
      'terakhir aktif': when(r.last_seen_at),
      'kali masuk': r.login_count,
      kejadian: Number(r.events),
      simpanan: r.save_bytes ? `${Math.ceil(r.save_bytes / 1024)} KB, ${when(r.saved_at)}` : '-',
    })),
