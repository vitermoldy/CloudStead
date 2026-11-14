import { existsSync } from 'node:fs'
import express from 'express'
import { createApi } from './app.js'
import { ROOT, config } from './config.js'
import { connect } from './db.js'
import project from './project.js'

