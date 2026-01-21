import { errorResponse, validationErrorResponse } from "./response-headers";
import { chatCompletionsSchema, documentUploadSchema, MAX_FILE_SIZE, TOOL_TYPE_MAP, ToolType } from "./schemata";
import { apiEndpoint, apiKey } from "./config";
import { buildHeaders } from "./utils";
import { corsHeaders } from "./config";
import { jsonResponse } from "./response-headers";
import OpenAI from "openai";

/**
 * POST /documents - Process document with docling
 */
export async function handleDocuments(req: Request): Promise<Response> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return errorResponse("Invalid content type. Expected multipart/form-data", 400);
  }

  const formData = await req.formData();
  const document = formData.get("document");

  // Validate with Zod
  const validation = documentUploadSchema.safeParse({ document });
  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  const file = validation.data.document;
  const inferenceId = req.headers.get("inference-id");

  // Build request to docling
  const doclingForm = new FormData();
  doclingForm.append("document", file, file.name);
  doclingForm.append("extract_tables_as_images", "false");
  doclingForm.append("image_resolution_scale", "4");

  const response = await fetch(`${apiEndpoint}/documents/convert`, {
    method: "POST",
    headers: buildHeaders(inferenceId, null),
    body: doclingForm,
  });

  if (!response.ok) {
    console.error("Docling error:", await response.text());
    return new Response(response.statusText, {
      status: response.status,
      headers: corsHeaders,
    });
  }

  return jsonResponse(await response.json());
}

/**
 * GET /models - Get available models
 */
export async function handleGetModels(req: Request): Promise<Response> {
  const response = await fetch(`${apiEndpoint}/models`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...buildHeaders(null, null),
    },
  });

  return jsonResponse(await response.json());
}

/**
 * GET /user - Get placeholder user data
 */
export function handleGetUser(): Response {
  return jsonResponse({
    email: "user@example.com",
    firstname: "Sample",
    lastname: "User",
    org: "GWD",
    organization: "GWDG",
    username: "sample-user",
  });
}

/**
 * POST /chat/completions - Chat completions API
 */
export async function handleChatCompletions(req: Request): Promise<Response> {
  // Check content length
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
    return errorResponse("Request body too large", 413);
  }

  // Parse and validate request body
  const rawBody = await req.json();
  const validation = chatCompletionsSchema.safeParse(rawBody);

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  const body = validation.data;
  const inferenceId = req.headers.get("inference-id");
  const uid = req.headers.get("oidc_claim_uid");

  // Determine inference service
  const isExternalModel = body.model.startsWith("openai-") && !body.model.startsWith("openai-gpt-oss");
  let inferenceService = body.model;

  // Build OpenAI params
  const params: Record<string, unknown> = {
    model: body.model,
    messages: body.messages,
    temperature: body.temperature,
    top_p: body.top_p,
    stream: body.stream,
    stream_options: body.stream ? { include_usage: true } : null,
    timeout: body.timeout,
  };

  // Add arcana if provided with non-empty id
  if (body.arcana?.id) {
    params.arcana = body.arcana;
  }

  // Handle tools configuration
  if (body.enable_tools && !isExternalModel) {
    inferenceService = "saia-openai-gateway";
    params.runToolsOnServer = true;

    const mcpServers = body['mcp-servers'];
    if (mcpServers?.length) {
      params['mcp-servers'] = mcpServers;
    }

    // Normalize and deduplicate tools
    if (body.tools?.length) {
      const normalizedTools = new Set<ToolType>();

      for (const tool of body.tools) {
        const normalizedType = TOOL_TYPE_MAP[tool.type];
        if (normalizedType) {
          normalizedTools.add(normalizedType);
        }
      }

      params.tools = Array.from(normalizedTools).map(type => ({ type }));
    }
  }

  // Remove timeout for certain model types (middleware workaround)
  if (params.arcana || body.model.includes("rag") || body.model.includes("sauerkraut")) {
    delete params.timeout;
  }

  // Create OpenAI client and make request
  const openai = new OpenAI({
    baseURL: apiEndpoint,
    apiKey: apiKey || inferenceId || "",
  });

  const headers = buildHeaders(inferenceId, uid, inferenceService);

  const response = await openai.chat.completions
    .create(params as unknown as OpenAI.ChatCompletionCreateParams, { headers })
    .asResponse();

  // Forward response with CORS headers
  const responseHeaders: Record<string, string> = { ...corsHeaders };
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export function handleNotFound(req: Request): Response {
  return new Response("Not Found", { status: 404, headers: corsHeaders });
}