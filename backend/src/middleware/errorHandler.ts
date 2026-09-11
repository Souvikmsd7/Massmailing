import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const context = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: (req as any).user?.userId,
  };

  if (err instanceof ZodError) {
    logger.warn('Zod validation error', { ...context, issues: err.issues });
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof ValidationError) {
    logger.warn(`Validation error: ${err.message}`, { ...context, details: err.details });
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn(`Application error: ${err.message}`, { ...context, code: err.code, statusCode: err.statusCode });
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  logger.error('Unhandled server error', context, err);

  const responseMessage =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Internal server error';

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: responseMessage,
    },
  });
}
