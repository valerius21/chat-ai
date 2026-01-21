import { z } from 'zod'

// validate environment variables and set defaults
export const configSchema = z.object({
  PORT: z.coerce.number({ message: 'Port must be a number' }).default(8081),
  API_ENDPOINT: z.string().url({ message: 'Invalid Endpoint-URL' }).default('https://chat-ai.academicclound.de/v1'),
  API_KEY: z.string().min(1, { message: 'API Key is required' }),
  SERVCE_NAME: z.string().default('Custom Chat AI'),
})

export type Env = z.infer<typeof configSchema>
