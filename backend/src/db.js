import pg from 'pg';
import { config } from './config.js';

// pool keeps a few connection open and reuses them for future queries, instead of opening a new connection for every query
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

pool.on('error', (err) => console.error('Unexpected database error', err));

export const query = (text, params) => pool.query(text, params);