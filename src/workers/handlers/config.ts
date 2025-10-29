// src/workers/handlers/config.ts - Configuration endpoint for Cloudflare Workers

export interface Env {
  NODE_ENV: string;
  API_VERSION: string;
}

// Simplified configuration (in a real app, this might come from KV or D1)
const config = {
  version: "3.0.0",
  name: "Syndicate API Citadel",
  description: "Bun-powered API registry with OpenAPI auto-generation (Cloudflare Workers)",
  author: "API Architect",
  created: "2025-10-29",
  updated: "2025-10-29",
  license: "MIT",
  env: "production",
  runtime: "cloudflare-workers",
  features: {
    yaml: true,
    cookies: true,
    websocket: true,
    webassembly: true,
    fetch: true,
    streams: true,
    'node:test': false, // Not available in CF Workers
    'worker-threads': false, // Not available in CF Workers
    'vm': false // Not available in CF Workers
  },
  rules: {
    header: {
      schema: {
        scope: ["GOV", "SEC", "DEV", "OPS"],
        type: ["REQUIRED", "OPTIONAL", "DEPRECATED"],
        priority: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
        status: ["ACTIVE", "PENDING", "DEPRECATED", "REMOVED"]
      }
    },
    api: {
      basePath: "/api/v3",
      security: ["cookieAuth", "csrfAuth"]
    }
  },
  compression: {
    default: {
      algorithm: "gzip", // CF Workers handles compression automatically
      level: 6,
      threshold: 1024
    }
  },
  ai: {
    inference: {
      worker: "cloudflare-worker-compatible",
      models: [
        {
          name: "content-moderation",
          type: "text-classification",
          threshold: 0.8
        },
        {
          name: "sentiment-analysis",
          type: "sentiment",
          languages: ["en", "es", "fr"]
        }
      ]
    }
  }
};

export async function handleConfig(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Add runtime-specific information
  const runtimeConfig = {
    ...config,
    runtime: {
      platform: 'cloudflare-workers',
      version: env.API_VERSION,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      features: {
        ...config.features,
        'cloudflare-kv': true,
        'cloudflare-d1': true,
        'cloudflare-rate-limiting': true,
        'cloudflare-analytics': true
      }
    }
  };

  // Different content types based on Accept header
  const accept = request.headers.get('Accept') || 'application/json';

  if (accept.includes('application/yaml') || accept.includes('text/yaml')) {
    // In a real implementation, you'd convert to YAML
    // For now, return JSON with YAML content-type
    return new Response(JSON.stringify(runtimeConfig, null, 2), {
      headers: {
        'Content-Type': 'application/yaml',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
  }

  return new Response(JSON.stringify(runtimeConfig, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
    }
  });
}
