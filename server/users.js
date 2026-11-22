import { config } from './config.js'
import { connect } from './db.js'
import project from './project.js'

/** `npm run users`: who has an account, when they joined, and what they have stored. */
const when = (d) => (d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-')

const pool = await connect(config.db)
