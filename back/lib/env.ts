import dotenv from 'dotenv'
import { envSchema } from './schemata'

// load env
dotenv.config({
    path: ['.env.back', '../.env.back'],
    override: true,
});

// Load environment validables and provide type-safe config
export const Env = envSchema.parse(process.env);

