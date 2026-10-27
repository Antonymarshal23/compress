import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import apiRoutes from './routes/api.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import path from 'node:path';

const app = express();
if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '64kb' }));
app.use(
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use('/api', apiRoutes);
if (config.nodeEnv === 'production') {
  const webBuild = path.resolve(process.cwd(), '../web/dist');
  app.use(express.static(webBuild, { maxAge: '1y', immutable: true, index: false }));
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(webBuild, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
