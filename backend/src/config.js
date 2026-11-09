import dotenv from 'dotenv';
dotenv.config();


//  if required variable is missing the app crashed at start
function required(name){
  const value = process.env[name];
  if(!value) throw new Error('Missing required env variable: ' + name);
  return value
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  // databaseUrlPooled: required('DATABASE_URL_POOLED')
}

export default config;