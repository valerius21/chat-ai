import { Env } from "./env";

// Export environment variables for use in the service.ts file
export const {
  API_ENDPOINT: apiEndpoint,
  API_KEY: apiKey,
  PORT: port,
  SERVICE_NAME: serviceName
} = Env

// CORS headers
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};