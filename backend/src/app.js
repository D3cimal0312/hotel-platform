import express from 'express';
import cors from 'cors';
import config from './config.js';
import db from './db.js';

function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health/db', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok', database: 'up' });
    } catch (err) {
      res.status(503).json({ status: 'error', database: 'down' });
    }
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}

export default createApp;
