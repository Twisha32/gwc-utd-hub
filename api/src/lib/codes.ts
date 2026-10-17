import { randomInt } from 'node:crypto';

// no 0/O or 1/I/L, people read these off a projector
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newCheckinCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
