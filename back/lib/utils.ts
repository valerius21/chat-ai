// Header Builder

import { apiKey, serviceName } from "./config";

export function buildHeaders(inferenceId: string | null, uid: string | null, inferenceService?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "inference-portal": serviceName,
  };

  if (inferenceService) {
    headers["inference-service"] = inferenceService;
  }

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (inferenceId) {
    headers["inference-id"] = inferenceId;
  }

  if (uid) {
    headers["user"] = uid;
  }

  return headers;
}

