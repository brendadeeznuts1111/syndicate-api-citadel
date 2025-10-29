// src/workers/index.ts - Cloudflare Workers Entry Point
// Adapted version of Syndicate API Citadel for Cloudflare Workers runtime

import { handleRequest } from './api-gateway';
import { corsHeaders } from './utils/cors';

export interface Env {
  // Environment variables
  NODE_ENV: string;
  API_VERSION: string;

  // Cloudflare bindings (optional)
  // CACHE: KVNamespace;
  // DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // Add environment to request for access in handlers
      (request as any).env = env;
      (request as any).ctx = ctx;

      // Route to our API gateway
      return await handleRequest(request, env, ctx);

    } catch (error) {
      console.error('Worker error:', error);

      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

// Scheduled worker for maintenance tasks (optional)
export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  console.log('Scheduled task running:', event.cron);

  // Could be used for:
  // - Health checks
  // - Cache cleanup
  // - Metrics aggregation
  // - Background processing

  ctx.waitUntil(
    Promise.resolve().then(() => {
      console.log('Scheduled maintenance completed');
    })
  );
}
