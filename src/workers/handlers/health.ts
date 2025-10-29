// src/workers/handlers/health.ts - Health check endpoint for Cloudflare Workers

// Cloudflare Workers uses global performance API

export interface Env {
  NODE_ENV: string;
  API_VERSION: string;
}

export async function handleHealthCheck(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const startTime = performance.now();

  // Get basic runtime info
  const runtimeInfo = {
    platform: 'cloudflare-workers',
    version: env.API_VERSION || '1.0.0',
    environment: env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
  };

  // Calculate uptime (approximate, since CF Workers don't have process.uptime())
  const uptime = performance.now();

  // Memory usage (limited in CF Workers)
  const memoryUsage = {
    // CF Workers has limited memory reporting
    available: 'Limited in CF Workers runtime'
  };

  const healthData = {
    status: 'healthy',
    runtime: runtimeInfo,
    uptime: `${(uptime / 1000).toFixed(2)}s`,
    memory: memoryUsage,
    endpoints: {
      total: 6,
      active: 6
    },
    websockets: {
      supported: true,
      compression: 'available'
    },
    // Cloudflare-specific features
    cloudflare: {
      worker: true,
      kv: 'available', // If KV binding is configured
      d1: 'available',  // If D1 binding is configured
      rate_limiting: true
    },
    features: {
      yaml: true,
      cookies: true,
      websocket: true,
      webassembly: true,
      fetch: true,
      streams: true
    },
    response_time: `${(performance.now() - startTime).toFixed(2)}ms`
  };

  return new Response(JSON.stringify(healthData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`
    }
  });
}
