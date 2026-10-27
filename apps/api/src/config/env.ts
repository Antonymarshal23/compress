import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.env') });

export const config = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 60),
  uploadLimitMb: Number(process.env.UPLOAD_LIMIT_MB ?? 25),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
