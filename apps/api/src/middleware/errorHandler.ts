import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      success: false,
      message: tooLarge ? 'The uploaded file exceeds the configured size limit.' : 'The upload was rejected. Check the number and size of files.',
    });
    return;
  }

  logger.error({ errorName: err instanceof Error ? err.name : 'UnknownError' }, 'Unhandled API error');
  res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
}
