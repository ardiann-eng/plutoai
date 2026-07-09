import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config();

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export function requireEnv() {
  const missing = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'JWT_SECRET'].filter((key) => !process.env[key] || process.env[key].includes('isi_') || process.env[key].includes('ganti_'));
  if (missing.length) {
    throw new Error(`Env belum lengkap: ${missing.join(', ')}`);
  }
}
