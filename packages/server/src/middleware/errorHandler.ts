import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError | unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle case where err might not be a proper Error object
  let error: ApiError;
  if (err instanceof Error) {
    error = err as ApiError;
  } else {
    // Convert non-Error objects to proper Error instances
    error = new Error(String(err)) as ApiError;
    error.statusCode = 500;
  }

  console.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    rawError: err, // Log the original error for debugging
  });

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  res.status(statusCode).json({
    error: {
      message,
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  });
};

export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string
): ApiError => {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
};
