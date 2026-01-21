// Bun-native imports
import OpenAI from "openai";
import { Config } from './lib/config'

const {
  API_ENDPOINT: apiEndpoint,
  API_KEY: apiKey,
  PORT: port,
  SERVCE_NAME: serviceName
} = Config

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// Load configuration
try {
  // Helper function to create JSON response with CORS
  function jsonResponse(data: any, status = 200, additionalHeaders = {}) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
        ...additionalHeaders,
      },
    });
  }

  // Helper function to create error response
  function errorResponse(error: string, status = 500) {
    return jsonResponse({ error }, status);
  }

  // Function to process file with docling
  async function processFile(fileBlob: Blob, fileName: string, mimeType: string, inference_id: string | null) {
    const url = apiEndpoint + "/documents/convert";
    const formData = new FormData();
    formData.append("document", fileBlob, fileName);
    formData.append("extract_tables_as_images", "false");
    formData.append("image_resolution_scale", "4");

    const headers: Record<string, string> = {
      "inference-portal": serviceName,
    };

    // Only add Authorization header if apiKey is present and non-empty
    if (apiKey) {
      headers.Authorization = "Bearer " + apiKey;
    } else {
      // Only add inference-id header if apiKey is empty or non-existent
      if (inference_id) {
        headers["inference-id"] = inference_id;
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    if (response.status !== 200) {
      const text = await response.text();
      console.log(text);
    }
    console.log(response.status);
    return response;
  }

  // Main Bun server
  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      // Handle CORS preflight
      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // Route: POST /documents - Process PDF file
      if (path === "/documents" && method === "POST") {
        try {
          const contentType = req.headers.get("content-type") || "";

          // Check if request is multipart/form-data
          if (!contentType.includes("multipart/form-data")) {
            return errorResponse("Invalid content type. Expected multipart/form-data", 400);
          }

          const formData = await req.formData();
          const document = formData.get("document");

          if (!document || !(document instanceof File)) {
            return errorResponse("No file provided", 422);
          }

          // Check file size (50MB limit)
          if (document.size > 50 * 1024 * 1024) {
            return errorResponse("File size exceeds 50MB limit", 413);
          }

          const inference_id = req.headers.get("inference-id");
          const response = await processFile(
            document,
            document.name,
            document.type,
            inference_id
          );

          if (!response.ok) {
            return new Response(response.statusText, {
              status: response.status,
              headers: corsHeaders,
            });
          }

          const result = await response.json();
          return jsonResponse(result, 200);
        } catch (err) {
          console.error("Processing error:", err);
          return errorResponse(
            "An internal server error occurred while processing file",
            500
          );
        }
      }

      // Route: GET /models - Get list of models
      if (path === "/models" && method === "GET") {
        try {
          const url = apiEndpoint + "/models";
          const headers: Record<string, string> = {
            Accept: "application/json",
            Authorization: "Bearer " + apiKey,
            "inference-portal": "Chat AI",
          };
          const response = await fetch(url, { method: "GET", headers });
          const data = await response.json();
          return jsonResponse(data, 200);
        } catch (error) {
          console.error(`Error: ${error}`);
          return errorResponse("Failed to fetch models.", 500);
        }
      }

      // Route: GET /user - Get placeholder user data
      if (path === "/user" && method === "GET") {
        try {
          return jsonResponse({
            email: "user@example.com",
            firstname: "Sample",
            lastname: "User",
            org: "GWD",
            organization: "GWDG",
            username: "sample-user",
          }, 200);
        } catch (error) {
          console.error(`Error: ${error}`);
          return errorResponse("Failed to fetch models.", 500);
        }
      }

      // Route: POST /chat/completions - Chat Completions API
      if (path === "/chat/completions" && method === "POST") {
        try {
          // Parse request body with size limit check
          const contentLength = req.headers.get("content-length");
          if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
            return errorResponse("Request body too large", 413);
          }

          const body = await req.json();
          const {
            messages,
            model,
            temperature = 0.5,
            top_p = 0.5,
            arcana = null,
            timeout = 30000,
            enable_tools = null,
            tools = null,
            stream = true,
          } = body;

          const mcp_servers = body["mcp-servers"] || null;
          const inference_id = req.headers.get("inference-id");
          const uid = req.headers.get("oidc_claim_uid");

          if (!Array.isArray(messages)) {
            return errorResponse("Invalid messages provided", 422);
          }

          const validatedTimeout = Math.min(Math.max(timeout, 5000), 900000);
          let inference_service;
          let params: any;

          params = {
            model: model,
            messages: messages,
            temperature: temperature,
            top_p: top_p,
            stream: stream,
            stream_options: stream ? { include_usage: true } : null,
            timeout: timeout,
          };

          const isExternalModel = model.startsWith("openai-") && !model.startsWith("openai-gpt-oss");
          inference_service = model;

          if (arcana && arcana.id !== "") {
            params.arcana = arcana;
          }

          // Handle tools and arcana
          if (enable_tools && !isExternalModel) {
            inference_service = "saia-openai-gateway";
            params["runToolsOnServer"] = true;
            if (mcp_servers && mcp_servers.length > 0) {
              params["mcp-servers"] = mcp_servers;
            }
            if (tools && tools.length > 0) {
              params.tools = [];
              for (const tool of tools) {
                if (tool.type === "web_search_preview" || tool.type === "web_search") {
                  params.tools.push({ type: "web_search_preview" });
                }
                if (tool.type === "fetch_url") {
                  params.tools.push({ type: "fetch_url" });
                }
                if (tool.type === "image_generation") {
                  params.tools.push({ type: "image_generation" });
                }
                if (tool.type === "video_generation") {
                  params.tools.push({ type: "video_create" });
                }
                if (tool.type === "image_modify" || tool.type === "image_modification") {
                  params.tools.push({ type: "image_modify" });
                }
                if (tool.type === "audio_generation") {
                  params.tools.push({ type: "audio_generation" });
                }
                if (tool.type === "audio_transcription") {
                  params.tools.push({ type: "audio_transcription" });
                }
                if (tool.type === "runRscript") {
                  params.tools.push({ type: "runRscript" });
                }
              }
            }
          }

          const openai = new OpenAI({ baseURL: apiEndpoint, apiKey: apiKey ? apiKey : inference_id || "" });

          // Temporary workaround as middleware doesn't support timeout yet
          if (params.arcana || params.model.includes("rag") || params.model.includes("sauerkraut")) {
            delete params.timeout;
          }

          // Build headers object
          const headers: Record<string, string> = {
            "inference-service": inference_service,
            "inference-portal": serviceName,
          };

          if (uid) {
            headers["user"] = uid;
          }

          // Add inference-id only if it's not null/undefined
          if (inference_id) {
            headers["inference-id"] = inference_id;
          }

          // Get chat completion response
          const response = await openai.chat.completions.create(params, {
            headers
          }).asResponse();

          // Build response headers
          const responseHeaders: Record<string, string> = { ...corsHeaders };
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });

          // Return streaming response
          return new Response(response.body, {
            status: response.status,
            headers: responseHeaders,
          });
        } catch (err: any) {
          try {
            // Well-formed error, return
            if (err?.status && err?.error) {
              return errorResponse(
                err?.error || "An internal server error occurred",
                err?.status || 500
              );
            }

            // Couldn't extract error message, so try without openai library
            const inference_service = err?.inference_service || "unknown";
            const inference_id = req.headers.get("inference-id");

            // Get params from the error context if available
            let params: any = {};
            try {
              const body = await req.json();
              params = {
                model: body.model,
                messages: body.messages,
                temperature: body.temperature || 0.5,
                top_p: body.top_p || 0.5,
                stream: body.stream !== undefined ? body.stream : true,
              };
            } catch {
              // If we can't parse the body again, continue with empty params
            }

            const response = await fetch(apiEndpoint + "/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey ? apiKey : inference_id || ""}`,
                "Content-Type": "application/json",
                "inference-service": inference_service,
                "inference-portal": serviceName,
                ...(inference_id ? { "inference-id": inference_id } : {}),
              },
              body: JSON.stringify(params)
            });

            // Extract message and status from HTTP response
            let msg: any, status: number;
            try {
              status = response.status;
              msg = await response.text();
              msg = JSON.parse(msg);
              msg = msg?.message || msg;
              const match = msg.match(/'msg':\s*'([^']*)'/);
              if (match) {
                msg = match[1];
                console.log("Extracted message:", msg);
              }
            } catch {
              msg = "An unknown error occurred";
              status = err?.status || 500;
            }

            // Return message as best as possible
            return errorResponse(msg || "An unknown error occurred", status || err?.status || 500);
          } catch (err) {
            console.error(err);
            return errorResponse("An internal server error occurred", 500);
          }
        }
      }

      // 404 for unknown routes
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    },
  });

  console.log(`Chat AI backend listening on port ${port}`)
};

