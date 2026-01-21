import { port, corsHeaders } from './lib/config';
import { Env } from './lib/env';
import { errorResponse } from './lib/response-headers';
import { handleDocuments, handleGetModels, handleGetUser, handleChatCompletions, handleNotFound } from './lib/routes';

Bun.serve({
  port,
  routes: {
    '/documents': handleDocuments,
    '/models': handleGetModels,
    '/user': handleGetUser,
    '/chat/completions': handleChatCompletions,
    '/:path*': handleNotFound,
  },
  async fetch(req) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    return new Response(null, {  headers: corsHeaders });
  },
  error(err) {
       console.error("Request error:", err);

      // Handle OpenAI SDK errors with status/error properties
      if (err && typeof err === 'object' && 'status' in err && 'error' in err) {
        const apiError = err as { status: number; error: unknown };
        const message = typeof apiError.error === 'string'
          ? apiError.error
          : (apiError.error as { message?: string })?.message || 'API error';
        return errorResponse(message, apiError.status);
      }

      // Generic error
      const message = err instanceof Error ? err.message : "An internal server error occurred";
      return errorResponse(message, 500);   
  },
  development: Env.DEVELOPMENT,
});

console.log(`Chat AI backend listening on port ${port}`);