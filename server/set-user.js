import { randomInt } from 'node:crypto'
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN, USERNAME } from './auth.js'
import { config } from './config.js'
import { connect } from './db.js'
import project from './project.js'

/**
 * `npm run set-user -- <username> <password>`: makes an account, or gives an existing
 * one a new password (there is no reset by email, so this is the reset). A new account
