import { dayRange, streak } from './dates.js'

/**
 * What this app keeps in MySQL: every focus session that ran to the end (its
 * minutes and its timer preset), and a copy of the browser save.
 */
export default {
