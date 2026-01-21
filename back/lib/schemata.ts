import { z } from 'zod'

// Constants
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
export const MIN_TIMEOUT = 5000
export const MAX_TIMEOUT = 900000

// Environment schema
export const envSchema = z.object({
  PORT: z.coerce.number({ message: 'Port must be a number' }).default(8081),
  API_ENDPOINT: z.string().url({ message: 'Invalid Endpoint-URL' }).default('https://chat-ai.academicclound.de/v1'),
  API_KEY: z.string().min(1, { message: 'API Key is required' }),
  SERVICE_NAME: z.string().default('Custom Chat AI'),
  DEVELOPMENT: z.boolean().default(process.env.NODE_ENV === 'development'),
})

export type Env = z.infer<typeof envSchema>

// Tool types enum
export enum ToolType {
  AUDIO_GENERATION = "audio_generation",
  AUDIO_TRANSCRIPTION = "audio_transcription",
  FETCH_URL = "fetch_url",
  IMAGE_GENERATION = "image_generation",
  IMAGE_MODIFY = "image_modify",
  IMAGE_MODIFICATION = "image_modification",
  RUN_RSCRIPT = "runRscript",
  VIDEO_GENERATION = "video_generation",
  WEB_SEARCH = "web_search",
  WEB_SEARCH_PREVIEW = "web_search_preview",
}

// Tool type normalization: maps aliases to canonical types
export const TOOL_TYPE_MAP: Record<string, ToolType> = {
  [ToolType.WEB_SEARCH]: ToolType.WEB_SEARCH_PREVIEW,
  [ToolType.WEB_SEARCH_PREVIEW]: ToolType.WEB_SEARCH_PREVIEW,
  [ToolType.FETCH_URL]: ToolType.FETCH_URL,
  [ToolType.IMAGE_GENERATION]: ToolType.IMAGE_GENERATION,
  [ToolType.VIDEO_GENERATION]: ToolType.VIDEO_GENERATION,
  [ToolType.IMAGE_MODIFY]: ToolType.IMAGE_MODIFY,
  [ToolType.IMAGE_MODIFICATION]: ToolType.IMAGE_MODIFY,
  [ToolType.AUDIO_GENERATION]: ToolType.AUDIO_GENERATION,
  [ToolType.AUDIO_TRANSCRIPTION]: ToolType.AUDIO_TRANSCRIPTION,
  [ToolType.RUN_RSCRIPT]: ToolType.RUN_RSCRIPT,
}

export const toolSchema = z.object({
  type: z.nativeEnum(ToolType),
})

export type Tool = z.infer<typeof toolSchema>

// Chat message schema
const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([z.string(), z.array(z.any())]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
}).passthrough()

// Arcana schema
const arcanaSchema = z.object({
  id: z.string(),
}).passthrough()

// Chat completions request schema
export const chatCompletionsSchema = z.object({
  messages: z.array(messageSchema).min(1, 'At least one message is required'),
  model: z.string().min(1, 'Model is required'),
  temperature: z.number().min(0).max(2).default(0.5),
  top_p: z.number().min(0).max(1).default(0.5),
  stream: z.boolean().default(true),
  timeout: z.number().min(MIN_TIMEOUT).max(MAX_TIMEOUT).default(30000),
  arcana: arcanaSchema.nullable().optional(),
  enable_tools: z.boolean().nullable().optional(),
  tools: z.array(toolSchema).nullable().optional(),
  'mcp-servers': z.array(z.any()).nullable().optional(),
}).passthrough()

export type ChatCompletionsRequest = z.infer<typeof chatCompletionsSchema>

// Document upload schema (validates formData structure)
export const documentUploadSchema = z.object({
  document: z.instanceof(File, { message: 'No file provided' }),
}).refine(
  (data) => data.document.size <= MAX_FILE_SIZE,
  { message: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, path: ['document'] }
)
