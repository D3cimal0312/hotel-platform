import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

pool.on('error', (err) => console.error('Unexpected database error', err));

export const query = (text, params) => pool.query(text, params);
