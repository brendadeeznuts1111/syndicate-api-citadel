// src/workers/handlers/openapi.ts - OpenAPI specification endpoint for Cloudflare Workers

export interface Env {
  NODE_ENV: string;
  API_VERSION: string;
}

// Simplified OpenAPI spec (in production, this might be generated or stored in KV)
const openApiSpec = {
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

export async function handleOpenAPI(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Add runtime-specific information
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

  // Different content types based on Accept header
  const accept = request.headers.get('Accept') || 'application/json';

  if (accept.includes('application/yaml') || accept.includes('text/yaml')) {
    // In a real implementation, you'd convert to YAML
    // For now, return JSON with YAML content-type
    return new Response(JSON.stringify(runtimeSpec, null, 2), {
      headers: {
        'Content-Type': 'application/yaml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  }

  return new Response(JSON.stringify(runtimeSpec, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  });
}
