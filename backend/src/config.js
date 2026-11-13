import dotenv from 'dotenv';
dotenv.config();


//  if required variable is missing the app crashed at start
function required(name){
  const value = process.env[name];
  if(!value) throw new Error('Missing required env variable: ' + name);
  return value
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  usdInr: Number(process.env.USD_INR) || 83,
  jwtSecret,
  accessTtl: '15m',
  refreshTtlDays: 7,
  bcryptCost: Number(process.env.BCRYPT_COST) || 12,
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT) || 20,
}
