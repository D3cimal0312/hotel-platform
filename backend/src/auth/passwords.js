import bcrypt from 'bcryptjs';
import { config } from '../config.js';

export const hashPassword = (plain) => bcrypt.hash(plain, config.bcryptCost);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);


export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptCost);