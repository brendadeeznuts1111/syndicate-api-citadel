// src/workers/api-gateway.ts - Cloudflare Workers API Gateway
// Adapted version of our Bun-based gateway for Cloudflare Workers runtime

import { handleHealthCheck } from './handlers/health';
import { handleConfig } from './handlers/config';
import { handleGrepSearch } from './handlers/grep';
import { handleValidation } from './handlers/validation';
import { handleOpenAPI } from './handlers/openapi';
import { handleWebSocket } from './handlers/websocket';
import { handleRoot } from './handlers/root';
import { handleWebhookSync } from './handlers/webhook-sync';
import { corsHeaders, addCorsHeaders } from './utils/cors';

export interface Env {
  NODE_ENV: string;
  API_VERSION: string;
}

const BASE_PATH = '/api/v3';

// Route handlers mapping
const routes: Record<string, (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>> = {
  '/': handleRoot,
  '/health': handleHealthCheck,
  '/webhooks/github': handleWebhookSync,
  [`${BASE_PATH}/config`]: handleConfig,
  [`${BASE_PATH}/rules/grep`]: handleGrepSearch,
  [`${BASE_PATH}/rules/validate`]: handleValidation,
  [`${BASE_PATH}/docs`]: handleOpenAPI,
  [`${BASE_PATH}/ws/negotiate`]: handleWebSocket,
};

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  console.log(`${request.method} ${pathname}`);

  // Find matching route
  const handler = routes[pathname];
  if (handler) {
    try {
      const response = await handler(request, env, ctx);
      return addCorsHeaders(response);
    } catch (error) {
      console.error(`Handler error for ${pathname}:`, error);
      return addCorsHeaders(new Response(JSON.stringify({
        error: 'Handler Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        path: pathname,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  }

  // 404 handler
  const notFoundResponse = new Response(JSON.stringify({
    error: 'Not Found',
    message: `Route ${pathname} not found`,
    availableRoutes: Object.keys(routes),
    timestamp: new Date().toISOString()
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });

  return addCorsHeaders(notFoundResponse);
}
