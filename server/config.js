import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import project from './project.js'

/** Repo root, one level above /server. */
export const ROOT = fileURLToPath(new URL('..', import.meta.url))

// .env is optional: a real deployment can set the variables directly.
