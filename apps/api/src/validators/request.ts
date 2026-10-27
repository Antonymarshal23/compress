import type { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/errors.js';

export function validateRequest<T>(schema: { body?: ZodSchema<T>; params?: ZodSchema<T>; query?: ZodSchema<T> }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      if (schema.query) {
        req.query = schema.query.parse(req.query) as typeof req.query;
      }

      if (schema.params) {
        req.params = schema.params.parse(req.params) as typeof req.params;
      }

      next();
    } catch (error) {
      next(new AppError('Validation failed', 400, error));
    }
  };
}
