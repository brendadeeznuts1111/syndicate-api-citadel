// src/workers/handlers/root.ts - Root endpoint for Cloudflare Workers
// Provides API overview and documentation landing page

export interface Env {
  NODE_ENV: string;
  API_VERSION: string;
}

export async function handleRoot(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const baseUrl = new URL(request.url).origin;

  // Check Accept header to determine response format
  const accept = request.headers.get('Accept') || '';

  if (accept.includes('application/json')) {
    // JSON API response
    const apiInfo = {
      name: "Syndicate API Citadel",
      description: "Bun-powered API registry with OpenAPI auto-generation (Cloudflare Workers)",
      version: env.API_VERSION || "1.0.0",
      runtime: "cloudflare-workers",
      environment: env.NODE_ENV || "production",
      endpoints: {
        health: `${baseUrl}/health`,
        config: `${baseUrl}/api/v3/config`,
        rules: {
          grep: `${baseUrl}/api/v3/rules/grep`,
          validate: `${baseUrl}/api/v3/rules/validate`
        },
        docs: `${baseUrl}/api/v3/docs`,
        websocket: `${baseUrl}/api/v3/ws/negotiate`
      },
      documentation: {
        openapi: `${baseUrl}/api/v3/docs`,
        github: "https://github.com/brendadeeznuts1111/syndicate-api-citadel",
        deployment: "https://syndicate-api-citadel.utahj4754.workers.dev"
      },
      features: [
        "OpenAPI 3.1.0 specification",
        "YAML/JSON configuration support",
        "Rule-based validation engine",
        "Real-time WebSocket connections",
        "Global edge distribution",
        "Automatic scaling",
        "Enterprise security"
      ],
      technologies: [
        "Bun 1.3 Runtime (Development)",
        "Cloudflare Workers (Production)",
        "TypeScript",
        "Web Standards APIs"
      ],
      timestamp: new Date().toISOString(),
      status: "operational"
    };

    return new Response(JSON.stringify(apiInfo, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'X-API-Version': env.API_VERSION || '1.0.0'
      }
    });
  }

  // HTML landing page
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Syndicate API Citadel - Cloudflare Workers</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
        }

        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }

        .status {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 30px;
            text-align: center;
            backdrop-filter: blur(10px);
        }

        .status h2 {
            color: white;
            margin-bottom: 10px;
        }

        .status .badge {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
        }

        .endpoints {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .endpoint-card {
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }

        .endpoint-card:hover {
            transform: translateY(-5px);
        }

        .endpoint-card h3 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 1.3rem;
        }

        .endpoint-card .method {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-right: 10px;
        }

        .endpoint-card .url {
            font-family: 'Monaco', 'Menlo', monospace;
            background: #f5f5f5;
            padding: 5px 10px;
            border-radius: 4px;
            margin: 10px 0;
            word-break: break-all;
        }

        .endpoint-card p {
            color: #666;
            margin-bottom: 15px;
        }

        .try-it {
            display: inline-block;
            background: #667eea;
            color: white;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 5px;
            font-weight: bold;
            transition: background 0.3s ease;
        }

        .try-it:hover {
            background: #5a6fd8;
        }

        .features {
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .features h2 {
            color: #333;
            margin-bottom: 20px;
            text-align: center;
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }

        .feature-item {
            display: flex;
            align-items: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .feature-item::before {
            content: "✓";
            color: #4CAF50;
            font-weight: bold;
            font-size: 1.2rem;
            margin-right: 15px;
        }

        .footer {
            text-align: center;
            color: white;
            opacity: 0.8;
            margin-top: 40px;
        }

        .footer a {
            color: white;
            text-decoration: underline;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }

            .endpoints {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>🏰 Syndicate API Citadel</h1>
            <p>Enterprise-Grade API Platform on Cloudflare Workers</p>
        </header>

        <div class="status">
            <h2>🚀 System Status</h2>
            <span class="badge">OPERATIONAL</span>
            <p>Deployed on Cloudflare's global edge network with 99.9%+ uptime SLA</p>
        </div>

        <section class="endpoints">
            <div class="endpoint-card">
                <h3><span class="method">GET</span> Health Check</h3>
                <div class="url">${baseUrl}/health</div>
                <p>Monitor system health, performance metrics, and runtime information.</p>
                <a href="${baseUrl}/health" class="try-it" target="_blank">Try It →</a>
            </div>

            <div class="endpoint-card">
                <h3><span class="method">GET</span> API Configuration</h3>
                <div class="url">${baseUrl}/api/v3/config</div>
                <p>Retrieve current API configuration, features, and runtime settings.</p>
                <a href="${baseUrl}/api/v3/config" class="try-it" target="_blank">Try It →</a>
            </div>

            <div class="endpoint-card">
                <h3><span class="method">GET</span> Rule Search</h3>
                <div class="url">${baseUrl}/api/v3/rules/grep?q=search</div>
                <p>Search and filter governance rules with advanced query capabilities.</p>
                <a href="${baseUrl}/api/v3/rules/grep?q=GOV&scope=GOV" class="try-it" target="_blank">Try It →</a>
            </div>

            <div class="endpoint-card">
                <h3><span class="method">POST</span> Request Validation</h3>
                <div class="url">${baseUrl}/api/v3/rules/validate</div>
                <p>Validate requests against governance rules and security policies.</p>
                <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    Use POST with JSON body to test validation
                </div>
            </div>

            <div class="endpoint-card">
                <h3><span class="method">GET</span> OpenAPI Specification</h3>
                <div class="url">${baseUrl}/api/v3/docs</div>
                <p>Complete OpenAPI 3.1.0 specification for integration and documentation.</p>
                <a href="${baseUrl}/api/v3/docs" class="try-it" target="_blank">Try It →</a>
            </div>

            <div class="endpoint-card">
                <h3><span class="method">WS</span> WebSocket Connection</h3>
                <div class="url">${baseUrl}/api/v3/ws/negotiate</div>
                <p>Real-time bidirectional communication with protocol negotiation.</p>
                <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                    Use WebSocket client to connect
                </div>
            </div>
        </section>

        <section class="features">
            <h2>✨ Key Features</h2>
            <div class="features-grid">
                <div class="feature-item">Global Edge Distribution (200+ locations)</div>
                <div class="feature-item">Automatic Scaling & Load Balancing</div>
                <div class="feature-item">Enterprise Security & DDoS Protection</div>
                <div class="feature-item">OpenAPI 3.1.0 Specification</div>
                <div class="feature-item">YAML/JSON Configuration Support</div>
                <div class="feature-item">Real-time WebSocket Connections</div>
                <div class="feature-item">Rule-based Validation Engine</div>
                <div class="feature-item">TypeScript & Modern JavaScript</div>
            </div>
        </section>

        <footer class="footer">
            <p>
                Built with <strong>Bun 1.3</strong> • Deployed on <strong>Cloudflare Workers</strong> •
                <a href="https://github.com/brendadeeznuts1111/syndicate-api-citadel" target="_blank">View on GitHub</a>
            </p>
            <p style="margin-top: 10px; font-size: 0.9em;">
                API Version ${env.API_VERSION || '1.0.0'} • ${env.NODE_ENV || 'production'} environment
            </p>
        </footer>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      'X-API-Version': env.API_VERSION || '1.0.0'
    }
  });
}
