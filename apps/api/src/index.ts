import { config } from './config/env.js';
import app from './app.js';
import { initializeDownloadJobs, stopDownloadJobCleanup } from './services/download-jobs.js';
import { logger } from './utils/logger.js';

const start = async () => {
  await initializeDownloadJobs();
  const server = app.listen(config.port, () => {
    logger.info(`PaperPilot API listening on port ${config.port}`);
  });
  server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS ?? 120_000);
  server.headersTimeout = 30_000;

  const shutdown = () => {
    stopDownloadJobCleanup();
    server.close(() => {
      logger.info('PaperPilot API shut down gracefully');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

void start().catch((error) => {
  logger.fatal({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'PaperPilot API failed to start');
  process.exitCode = 1;
});
