

import 'dotenv/config';
//  if required variable is missing the app crashed at start

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  // databaseUrlPooled: required('DATABASE_URL_POOLED')

  usdInr: Number(process.env.USD_INR) || 83,
};