import type { Request } from 'express';
import { z } from 'zod';
import { notFound, ValidationError } from './errors';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

const uuid = z.uuid();

// a malformed id is just a 404, no reason to tell the caller anything else
export function idParam(req: Request, name = 'id'): string {
  const raw = req.params[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !uuid.safeParse(value).success) throw notFound();
  return value;
}

export function intQuery(value: unknown, fallback: number, min: number, max: number) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
