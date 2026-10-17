import type { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export class ValidationError extends HttpError {
  constructor(err: ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    super(400, Object.values(fields)[0] ?? 'Invalid request.', fields);
  }
}

export const badRequest = (msg: string, fields?: Record<string, string>) =>
  new HttpError(400, msg, fields);
export const unauthorized = (msg = 'Sign in to continue.') => new HttpError(401, msg);
export const forbidden = (msg = "You don't have access to that.") => new HttpError(403, msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, msg);
export const conflict = (msg: string, fields?: Record<string, string>) =>
  new HttpError(409, msg, fields);
export const tooMany = (msg = 'Too many requests. Try again in a bit.') =>
  new HttpError(429, msg);
