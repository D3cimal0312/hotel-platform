import express from 'express';
import cors from 'cors';
import config from './config.js';

function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}

module.exports = { createApp };
