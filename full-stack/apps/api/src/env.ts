import { z } from 'zod';
export const env = z.object({
  NODE_ENV:z.string().default('development'), PORT:z.coerce.number().default(4000),
  WEB_ORIGIN:z.string().default('http://localhost:5173'), DATABASE_URL:z.string(),
  JWT_ACCESS_SECRET:z.string().min(16), JWT_REFRESH_SECRET:z.string().min(16),
  ACCESS_TTL:z.string().default('15m'), REFRESH_TTL:z.string().default('30d'),
  KYC_PROVIDER:z.enum(['mock','flutterwave']).default('mock'), BANK_PROVIDER:z.enum(['mock','flutterwave']).default('mock'),
  CARD_PROVIDER:z.enum(['mock']).default('mock'), WEBHOOK_SECRET:z.string().min(8),
  FLW_BASE_URL:z.string().url().default('https://api.flutterwave.com'),
  FLW_SECRET_KEY:z.string().optional(), FLW_SECRET_HASH:z.string().optional(), FLW_KYC_REDIRECT_URL:z.string().url().optional()
}).parse(process.env);
