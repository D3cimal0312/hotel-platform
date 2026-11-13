import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { query } from './db.js';
import { AppError } from './errors.js';
import { authRouter } from './auth/routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); 
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/health/db', async (req, res) => {
    try {
      await query('SELECT 1');
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'error', database: 'down' });
    }
  });

  app.use('/api/auth', authRouter);

  app.use((req, res, next) => next(new AppError(404, 'Not found')));
  app.use(errorHandler); // must be last
  return app;
}