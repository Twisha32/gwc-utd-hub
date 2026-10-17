import 'dotenv/config';
import { z } from 'zod';

const csv = (s: string) =>
  s
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET needs at least 16 characters'),
  FLAG_PEPPER: z.string().min(8, 'FLAG_PEPPER needs at least 8 characters'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  ALLOWED_EMAIL_DOMAINS: z.string().default(''),
  OFFICER_EMAILS: z.string().default(''),
  CLUB_JOIN_CODE: z.string().default(''),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(14).default(11),
  RUN_MIGRATIONS: z.enum(['true', 'false']).default('true'),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error('Bad environment config:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}
const env = parsed.data;

if (env.NODE_ENV === 'production' && /change-me/i.test(env.JWT_SECRET + env.FLAG_PEPPER)) {
  console.error('Refusing to start in production with the placeholder secrets from .env.example.');
  process.exit(1);
}

// plain mutable object on purpose, a couple of tests flip values at runtime
export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  databaseSsl: env.DATABASE_SSL === 'true',
  jwtSecret: env.JWT_SECRET,
  flagPepper: env.FLAG_PEPPER,
  webOrigins: env.WEB_ORIGIN.split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  allowedEmailDomains: csv(env.ALLOWED_EMAIL_DOMAINS),
  officerEmails: csv(env.OFFICER_EMAILS),
  joinCode: env.CLUB_JOIN_CODE,
  trustProxy: env.TRUST_PROXY,
  bcryptRounds: env.BCRYPT_ROUNDS,
  runMigrations: env.RUN_MIGRATIONS === 'true',
};
