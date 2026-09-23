import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config/index.js';
import { errorHandler } from './middlewares/error.js';
import { authRouter } from './routes/auth.routes.js';
import { contractRouter } from './routes/contract.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { organizationRouter } from './routes/organization.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/organizations', organizationRouter);
  app.use('/api/v1/contracts', contractRouter);
  app.use('/api/v1/notifications', notificationRouter);

  app.use(errorHandler);
  return app;
}
