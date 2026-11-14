import express from 'express'
import project from './project.js'

/**
 * The API, the same in every app:
 *   PUT  /api/save            { device, data }  mirror the browser save
 *   GET  /api/save/:device                      the save, to restore it in another browser
