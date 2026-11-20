import type { ErrorRequestHandler } from 'express';
import { ApiError } from './api-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' },
    });
    return;
  }

  console.error('Unhandled API error:', error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' },
  });
};
