import dotenv from 'dotenv'
import { configSchema } from './schema'

// load env
dotenv.config();

// Load environment validables and provide type-safe config
export const Config = configSchema.parse(process.env);
