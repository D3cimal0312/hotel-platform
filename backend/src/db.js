import {Pool} from 'pg';
import config from './config.js';

// pool keeps a few connection open and reuses them for future queries, instead of opening a new connection for every query
const pool = new Pool({connectionString:config.databaseUrl});

pool.on('error',(err,client)=>{
  console.error('Unexpected error on idle client',err);
  process.exit(-1);
});

const query = (text,params)=>{
  return pool.query(text,params);
}

export default {
  query,
  pool
};