import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { query } from './db';
import { loadUser } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { originGuard } from './middleware/origin';
import { authRouter } from './routes/auth';
import { ctfRouter } from './routes/ctf';
import { eventsRouter } from './routes/events';
import { statsRouter } from './routes/stats';
import { usersRouter } from './routes/users';

export function createApp() {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: config.webOrigins, credentials: true }));
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  if (!config.isTest) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
      });
      next();
    });
  }

  app.get('/api/health', async (_req, res) => {
    try {
      await query('select 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use('/api', originGuard, loadUser);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/ctf', ctfRouter);
  app.use('/api/stats', statsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
