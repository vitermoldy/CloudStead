import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import express from 'express'

/**
 * Accounts: a username and a password. Each account owns one data key (`device_id`),
 * the code this app already filed its saves and events under, so signing up keeps
 * the progress the browser already has and signing in elsewhere brings it along.
 *
 *   POST /api/auth/register  { username, password, device? }  new account, signed in
 *   POST /api/auth/login     { username, password }           signed in
 *   POST /api/auth/logout
 *   GET  /api/auth/me                                         who is signed in, 401 if nobody
 *
