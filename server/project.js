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
