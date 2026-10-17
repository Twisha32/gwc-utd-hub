import type { ErrorRequestHandler, RequestHandler } from 'express';
import { config } from '../config';
import { HttpError, notFound } from '../lib/errors';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound('No such route.'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, fields: err.fields } });
    return;
  }

  // body-parser errors carry a status
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'Request body is not valid JSON.' } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { message: 'Request body is too large.' } });
    return;
  }

  if (!config.isTest) console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong on our end.' } });
};
