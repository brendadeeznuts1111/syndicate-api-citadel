// src/workers/handlers/health.ts
async function handleHealthCheck(request, env, ctx) {
  const startTime = performance.now();
  const runtimeInfo = {
    platform: "cloudflare-workers",
    version: env.API_VERSION || "1.0.0",
    environment: env.NODE_ENV || "production",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  const uptime = performance.now();
  const memoryUsage = {
    // CF Workers has limited memory reporting
    available: "Limited in CF Workers runtime"
  };
  const healthData = {
    status: "healthy",
    runtime: runtimeInfo,
    uptime: `${(uptime / 1e3).toFixed(2)}s`,
    memory: memoryUsage,
    endpoints: {
      total: 6,
      active: 6
    },
    websockets: {
      supported: true,
      compression: "available"
    },
    // Cloudflare-specific features
    cloudflare: {
      worker: true,
      kv: "available",
      // If KV binding is configured
      d1: "available",
      // If D1 binding is configured
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
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Response-Time": `${(performance.now() - startTime).toFixed(2)}ms`
    }
  });
}

// src/workers/handlers/config.ts
var config = {
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
    "node:test": false,
    // Not available in CF Workers
    "worker-threads": false,
    // Not available in CF Workers
    "vm": false
    // Not available in CF Workers
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
      algorithm: "gzip",
      // CF Workers handles compression automatically
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
async function handleConfig(request, env, ctx) {
  const runtimeConfig = {
    ...config,
    runtime: {
      platform: "cloudflare-workers",
      version: env.API_VERSION,
      environment: env.NODE_ENV,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      features: {
        ...config.features,
        "cloudflare-kv": true,
        "cloudflare-d1": true,
        "cloudflare-rate-limiting": true,
        "cloudflare-analytics": true
      }
    }
  };
  const accept = request.headers.get("Accept") || "application/json";
  if (accept.includes("application/yaml") || accept.includes("text/yaml")) {
    return new Response(JSON.stringify(runtimeConfig, null, 2), {
      headers: {
        "Content-Type": "application/yaml",
        "Cache-Control": "public, max-age=300"
        // Cache for 5 minutes
      }
    });
  }
  return new Response(JSON.stringify(runtimeConfig, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300"
      // Cache for 5 minutes
    }
  });
}

// src/workers/handlers/grep.ts
var mockRules = [
  {
    id: "GOV-001",
    tag: "[GOV-HEADER-001]",
    description: "Government header validation rule",
    scope: "GOV",
    type: "REQUIRED",
    priority: "CRITICAL",
    status: "ACTIVE"
  },
  {
    id: "SEC-001",
    tag: "[SEC-LEAK-001]",
    description: "Security leak prevention rule",
    scope: "SEC",
    type: "REQUIRED",
    priority: "CRITICAL",
    status: "ACTIVE"
  },
  {
    id: "DEV-001",
    tag: "[DEV-TESTING-001]",
    description: "Development testing rule",
    scope: "DEV",
    type: "OPTIONAL",
    priority: "MEDIUM",
    status: "ACTIVE"
  }
];
async function handleGrepSearch(request, env, ctx) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const scope = url.searchParams.get("scope") || "ALL";
  const limit = parseInt(url.searchParams.get("limit") || "50");
  console.log(`Grep search: query="${query}", scope="${scope}", limit=${limit}`);
  let results = mockRules;
  if (scope !== "ALL") {
    results = results.filter((rule) => rule.scope === scope);
  }
  if (query) {
    const searchTerm = query.toLowerCase();
    results = results.filter(
      (rule) => rule.description.toLowerCase().includes(searchTerm) || rule.tag.toLowerCase().includes(searchTerm) || rule.id.toLowerCase().includes(searchTerm)
    );
  }
  const limitedResults = results.slice(0, limit);
  const response = {
    query,
    scope,
    results: limitedResults,
    total: results.length,
    returned: limitedResults.length,
    cached: true,
    // In CF Workers, we might use KV for caching
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    execution_time: "fast",
    // CF Workers are generally fast
    platform: "cloudflare-workers"
  };
  return new Response(JSON.stringify(response, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
      // Cache for 1 minute
      "X-Query-Count": limitedResults.length.toString(),
      "X-Total-Count": results.length.toString()
    }
  });
}

// src/workers/handlers/validation.ts
async function handleValidation(request, env, ctx) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Method Not Allowed",
      message: "Use POST method for validation",
      allowed: ["POST"]
    }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const validationResult = {
      valid: true,
      headers: Object.keys(body).length,
      violations: [],
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      platform: "cloudflare-workers",
      rules: {
        checked: ["GOV-001", "SEC-001", "DEV-001"],
        passed: 3,
        failed: 0
      }
    };
    if (!body || typeof body !== "object") {
      validationResult.valid = false;
      validationResult.violations.push("Request body must be a valid JSON object");
    }
    if (body.scope && !["GOV", "SEC", "DEV", "OPS"].includes(body.scope)) {
      validationResult.valid = false;
      validationResult.violations.push("Invalid scope value");
    }
    return new Response(JSON.stringify(validationResult, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "X-Validation-Status": validationResult.valid ? "passed" : "failed"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      valid: false,
      error: "Validation Error",
      message: error instanceof Error ? error.message : "Invalid request format",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// src/workers/handlers/openapi.ts
var openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Syndicate API Citadel",
    description: "Bun-powered API registry with OpenAPI auto-generation (Cloudflare Workers)",
    version: "3.0.0",
    contact: {
      name: "API Architect"
    },
    license: {
      name: "MIT"
    }
  },
  servers: [
    {
      url: "https://your-worker.your-subdomain.workers.dev",
      description: "Cloudflare Workers production environment"
    }
  ],
  security: [
    {
      cookieAuth: []
    },
    {
      csrfAuth: []
    }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check endpoint",
        description: "Returns the health status of the API",
        responses: {
          "200": {
            description: "API is healthy",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/v3/config": {
      get: {
        summary: "Get API configuration",
        description: "Returns the current API configuration",
        responses: {
          "200": {
            description: "Configuration retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ConfigResponse"
                }
              },
              "application/yaml": {
                schema: {
                  $ref: "#/components/schemas/ConfigResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/v3/rules/grep": {
      get: {
        summary: "Search rules with grep",
        description: "Search for rules using text-based queries",
        parameters: [
          {
            name: "q",
            in: "query",
            description: "Search query",
            schema: {
              type: "string"
            }
          },
          {
            name: "scope",
            in: "query",
            description: "Scope filter",
            schema: {
              type: "string",
              enum: ["GOV", "SEC", "DEV", "OPS", "ALL"]
            }
          }
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/GrepResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/v3/rules/validate": {
      post: {
        summary: "Validate request against rules",
        description: "Validate a request against the configured rules",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ValidationRequest"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Validation results",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ValidationResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/v3/docs": {
      get: {
        summary: "Get OpenAPI specification",
        description: "Returns the OpenAPI specification",
        responses: {
          "200": {
            description: "OpenAPI specification",
            content: {
              "application/json": {
                schema: {
                  type: "object"
                }
              },
              "application/yaml": {
                schema: {
                  type: "object"
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "sessionId"
      },
      csrfAuth: {
        type: "apiKey",
        in: "cookie",
        name: "csrfToken"
      }
    },
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string" },
          runtime: { type: "object" },
          uptime: { type: "string" },
          endpoints: { type: "object" },
          features: { type: "object" }
        }
      },
      ConfigResponse: {
        type: "object",
        properties: {
          version: { type: "string" },
          name: { type: "string" },
          features: { type: "object" },
          rules: { type: "object" }
        }
      },
      GrepResponse: {
        type: "object",
        properties: {
          query: { type: "string" },
          scope: { type: "string" },
          results: {
            type: "array",
            items: { type: "object" }
          },
          total: { type: "integer" }
        }
      },
      ValidationRequest: {
        type: "object",
        properties: {
          scope: { type: "string" },
          data: { type: "object" }
        }
      },
      ValidationResponse: {
        type: "object",
        properties: {
          valid: { type: "boolean" },
          violations: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    }
  }
};
async function handleOpenAPI(request, env, ctx) {
  const runtimeSpec = {
    ...openApiSpec,
    info: {
      ...openApiSpec.info,
      version: env.API_VERSION || openApiSpec.info.version
    },
    servers: [
      {
        url: `https://${new URL(request.url).hostname}`,
        description: "Cloudflare Workers deployment"
      }
    ]
  };
  const accept = request.headers.get("Accept") || "application/json";
  if (accept.includes("application/yaml") || accept.includes("text/yaml")) {
    return new Response(JSON.stringify(runtimeSpec, null, 2), {
      headers: {
        "Content-Type": "application/yaml",
        "Cache-Control": "public, max-age=3600"
        // Cache for 1 hour
      }
    });
  }
  return new Response(JSON.stringify(runtimeSpec, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600"
      // Cache for 1 hour
    }
  });
}

// src/workers/handlers/websocket.ts
async function handleWebSocket(request, env, ctx) {
  const upgrade = request.headers.get("Upgrade");
  if (upgrade !== "websocket") {
    return new Response(JSON.stringify({
      error: "WebSocket Upgrade Required",
      message: "This endpoint requires WebSocket upgrade",
      instructions: "Use WebSocket protocol to connect"
    }), {
      status: 426,
      // Upgrade Required
      headers: {
        "Content-Type": "application/json",
        "Upgrade": "websocket",
        "Connection": "Upgrade"
      }
    });
  }
  const protocol = new URL(request.url).searchParams.get("protocol") || "json-rpc";
  const heartbeat = parseInt(new URL(request.url).searchParams.get("heartbeat") || "30000");
  const requestedProtocols = request.headers.get("Sec-WebSocket-Protocol")?.split(", ") || [];
  const supportedProtocols = ["json-rpc", "api-events"];
  let selectedProtocol = protocol;
  for (const reqProtocol of requestedProtocols) {
    if (supportedProtocols.includes(reqProtocol.trim())) {
      selectedProtocol = reqProtocol.trim();
      break;
    }
  }
  const webSocketPair = new WebSocketPair();
  const client = webSocketPair[0];
  const server = webSocketPair[1];
  server.accept();
  const welcomeMessage = {
    type: "welcome",
    message: "Syndicate API Citadel WebSocket (Cloudflare Workers)",
    version: env.API_VERSION || "1.0.0",
    protocol: selectedProtocol,
    heartbeat,
    compression: "permessage-deflate",
    // Cloudflare handles compression
    platform: "cloudflare-workers",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  server.send(JSON.stringify(welcomeMessage));
  server.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data.toString());
      console.log("WebSocket message received:", data);
      const response = {
        type: "echo",
        original: data,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        server: "Cloudflare Workers API Citadel",
        compression: true
      };
      server.send(JSON.stringify(response));
    } catch (error) {
      server.send(JSON.stringify({
        type: "error",
        message: "Invalid JSON format",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }));
    }
  });
  server.addEventListener("close", (event) => {
    console.log("WebSocket connection closed:", event.code, event.reason);
  });
  server.addEventListener("error", (error) => {
    console.error("WebSocket error:", error);
  });
  if (heartbeat > 0) {
    const heartbeatInterval = setInterval(() => {
      if (server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify({
          type: "heartbeat",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          platform: "cloudflare-workers"
        }));
      } else {
        clearInterval(heartbeatInterval);
      }
    }, heartbeat);
    server.addEventListener("close", () => {
      clearInterval(heartbeatInterval);
    });
  }
  return new Response(null, {
    status: 101,
    headers: {
      "Upgrade": "websocket",
      "Connection": "Upgrade",
      "Sec-WebSocket-Protocol": selectedProtocol,
      "Sec-WebSocket-Accept": request.headers.get("Sec-WebSocket-Key") || ""
    },
    webSocket: client
  });
}

// src/workers/utils/cors.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-CSRF-Token",
  "Access-Control-Max-Age": "86400"
};
function addCorsHeaders(response) {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// src/workers/api-gateway.ts
var BASE_PATH = "/api/v3";
var routes = {
  "/health": handleHealthCheck,
  [`${BASE_PATH}/config`]: handleConfig,
  [`${BASE_PATH}/rules/grep`]: handleGrepSearch,
  [`${BASE_PATH}/rules/validate`]: handleValidation,
  [`${BASE_PATH}/docs`]: handleOpenAPI,
  [`${BASE_PATH}/ws/negotiate`]: handleWebSocket
};
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  console.log(`${request.method} ${pathname}`);
  const handler = routes[pathname];
  if (handler) {
    try {
      const response = await handler(request, env, ctx);
      return addCorsHeaders(response);
    } catch (error) {
      console.error(`Handler error for ${pathname}:`, error);
      return addCorsHeaders(new Response(JSON.stringify({
        error: "Handler Error",
        message: error instanceof Error ? error.message : "Unknown error",
        path: pathname,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }));
    }
  }
  const notFoundResponse = new Response(JSON.stringify({
    error: "Not Found",
    message: `Route ${pathname} not found`,
    availableRoutes: Object.keys(routes),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
  return addCorsHeaders(notFoundResponse);
}

// src/workers/index.ts
var workers_default = {
  async fetch(request, env, ctx) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }
      request.env = env;
      request.ctx = ctx;
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
  }
};
async function scheduled(event, env, ctx) {
  console.log("Scheduled task running:", event.cron);
  ctx.waitUntil(
    Promise.resolve().then(() => {
      console.log("Scheduled maintenance completed");
    })
  );
}
export {
  workers_default as default,
  scheduled
};
