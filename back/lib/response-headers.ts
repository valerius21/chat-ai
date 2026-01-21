import { ZodError } from "zod";
import { corsHeaders } from "./config";

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export function errorResponse(error: string, status = 500): Response {
  return jsonResponse({ error }, status);
}

export function validationErrorResponse(error: ZodError): Response {
  const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return errorResponse(issues, 422);
}
