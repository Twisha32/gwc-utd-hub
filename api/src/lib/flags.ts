import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

// flags are stored as an HMAC so a database dump doesn't hand out the answers
export function hashFlag(flag: string): string {
  return createHmac('sha256', config.flagPepper).update(flag.trim()).digest('hex');
}

export function flagMatches(input: string, storedHash: string): boolean {
  const a = Buffer.from(hashFlag(input), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
