import dotenv from 'dotenv'
import { envSchema } from './schema'

// load env
dotenv.config();

// Load environment validables and provide type-safe config
export const Env = envSchema.parse(process.env);
