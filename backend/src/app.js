import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { query } from './db.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.get('/health/db', async (req, res) => {
    try {
      await query('SELECT 1');
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'error', database: 'down' });
    }
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}