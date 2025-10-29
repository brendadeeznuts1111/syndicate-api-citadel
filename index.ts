// index.ts - Syndicate API Citadel Server (Bun Native YAML!)

import { file } from 'bun';
import { readdirSync } from 'fs';
import { join } from 'path';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3004;

// Performance tracking
const startTime = performance.now();
let requestCount = 0;

// Load configuration with Bun's native YAML (blazing fast!)
console.time('config-load');
const configText = await file('bun.yaml').text();
const config = Bun.YAML.parse(configText);  // Bun's native YAML parsing!
const { rules: { api, header: { schema } } } = config;
console.timeEnd('config-load');

// Pre-load rules for faster grep operations
console.time('rules-preload');
const rulesCache = new Map();
const rulesDir = 'rules';

function loadRules() {
  const scopes = readdirSync(rulesDir);
  for (const scope of scopes) {
    const scopePath = join(rulesDir, scope);
    try {
      const files = readdirSync(scopePath);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = Bun.file(join(scopePath, file)).textSync();
          const tags = content.match(/\[([A-Z]{3}-[A-Z]+-[0-9]{3})\]/g) || [];
          tags.forEach(tag => rulesCache.set(tag, join(scopePath, file)));
        }
      }
    } catch (e) {
      // Skip invalid directories
    }
  }
}
loadRules();
console.timeEnd('rules-preload');

console.log(`🚀 Syndicate API Citadel v3.0 (Bun ${Bun.version})`);
console.log(`📋 Base path: ${api.basePath} | Port: ${PORT}`);
console.log(`🔗 Host: ${api.host} | Rules cached: ${rulesCache.size}`);
console.log(`⚡ Startup time: ${(performance.now() - startTime).toFixed(2)}ms`);

// WebSocket connections registry
const wsConnections = new Set();

// Enhanced Bun.serve with WebSocket support
Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    requestCount++;

    // Handle WebSocket upgrade for /ws/negotiate
    if (url.pathname === `${api.basePath}/ws/negotiate`) {
      const upgrade = request.headers.get('upgrade');
      if (upgrade?.toLowerCase() === 'websocket') {
        return new Response(null, {
          status: 101,
          webSocket: {
            open(ws) {
              console.log('🔗 WebSocket connection established');
              wsConnections.add(ws);

              // Send welcome message
              ws.send(JSON.stringify({
                type: 'welcome',
                message: 'Syndicate API Citadel WebSocket',
                version: 'v3.0',
                timestamp: Date.now()
              }));
            },
            message(ws, message) {
              try {
                const data = JSON.parse(message);
                console.log('📨 WS Message:', data);

                // Echo with metadata
                ws.send(JSON.stringify({
                  type: 'echo',
                  original: data,
                  timestamp: Date.now(),
                  server: 'Bun Citadel'
                }));
              } catch (e) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Invalid JSON format',
                  timestamp: Date.now()
                }));
              }
            },
            close(ws) {
              console.log('🔌 WebSocket connection closed');
              wsConnections.delete(ws);
            }
          }
        });
      }
    }

    // API endpoints routing with enhanced Bun features
    if (url.pathname.startsWith(api.basePath)) {
      const path = url.pathname.replace(api.basePath, '');

      switch (path) {
        case '/rules/validate':
          if (request.method === 'POST') {
            const headers = Object.fromEntries(request.headers.entries());
            const validation = {
              valid: true,
              headers: Object.keys(headers).length,
              timestamp: Date.now(),
              userAgent: headers['user-agent'],
              contentType: headers['content-type']
            };

            // Broadcast validation to WebSocket clients
            wsConnections.forEach(ws => {
              ws.send(JSON.stringify({
                type: 'validation',
                data: validation,
                timestamp: Date.now()
              }));
            });

            return new Response(JSON.stringify(validation), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/rules/grep':
          if (request.method === 'GET') {
            const q = url.searchParams.get('q') || '';
            const scope = url.searchParams.get('scope') || 'GOV';

            // Use cached rules for blazing fast grep
            const results = Array.from(rulesCache.entries())
              .filter(([tag, file]) => tag.includes(scope) && (!q || tag.includes(q)))
              .map(([tag, file]) => ({ tag, file }));

            return new Response(JSON.stringify({
              query: q,
              scope: scope,
              results: results,
              total: results.length,
              cached: true,
              responseTime: `${performance.now().toFixed(2)}ms`
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/config':
          if (request.method === 'GET') {
            // Use Bun's fast response creation
            return new Response(configText, {
              headers: {
                'Content-Type': 'application/yaml',
                'X-Bun-Version': Bun.version,
                'X-Generated-At': new Date().toISOString()
              }
            });
          }
          break;

        case '/config/store':
          if (request.method === 'POST') {
            const body = await request.text();
            const hash = Bun.hash(body); // Bun's native hashing

            // Store in memory for demo (in production, use database)
            const stored = {
              hash: hash.toString(16),
              size: body.length,
              storedAt: Date.now(),
              compressed: Bun.gzipSync(body).length // Bun's native compression
            };

            return new Response(JSON.stringify(stored), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case '/yaml/stream':
          if (request.method === 'POST') {
            // Streaming YAML processing with Bun
            const reader = request.body?.getReader();
            let totalSize = 0;

            return new Response(
              new ReadableStream({
                async start(controller) {
                  try {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done) break;

                      totalSize += value.length;
                      const chunk = new TextDecoder().decode(value);

                      // Process chunk and send progress
                      controller.enqueue(JSON.stringify({
                        chunk: chunk.length,
                        total: totalSize,
                        processed: true
                      }) + '\n');
                    }

                    controller.enqueue(JSON.stringify({
                      complete: true,
                      totalSize,
                      processedAt: Date.now()
                    }));
                  } finally {
                    controller.close();
                  }
                }
              }),
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Transfer-Encoding': 'chunked'
                }
              }
            );
          }
          break;

        case '/csrf/verify':
          if (request.method === 'POST') {
            const token = request.headers.get('x-csrf-token');
            return new Response(JSON.stringify({
              verified: !!token,
              token: token ? 'valid' : 'missing',
              timestamp: Date.now()
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        default:
          // Handle path parameters like /secrets/{name} with Bun's URL parsing
          const secretsMatch = path.match(/^\/secrets\/(.+)$/);
          if (secretsMatch) {
            const name = secretsMatch[1];
            // Simulate secure retrieval (in production, use actual vault)
            const value = Bun.env[`SECRET_${name.toUpperCase()}`] || `secure_value_for_${name}`;

            return new Response(JSON.stringify({
              name: name,
              retrieved: true,
              length: value.length,
              secure: true,
              timestamp: Date.now()
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
      }
    }

    // Enhanced health check with Bun metrics
    if (url.pathname === '/health') {
      const uptime = performance.now() - startTime;
      const memory = process.memoryUsage();

      return new Response(JSON.stringify({
        status: 'healthy',
        version: 'v3.0',
        runtime: `Bun ${Bun.version}`,
        uptime: `${(uptime / 1000).toFixed(2)}s`,
        requests: requestCount,
        memory: {
          rss: `${(memory.rss / 1024 / 1024).toFixed(2)}MB`,
          heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)}MB`
        },
        endpoints: config.rules.api.endpoints.length,
        rules: rulesCache.size,
        websockets: wsConnections.size,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // OpenAPI spec endpoint
    if (url.pathname === `${api.basePath}/docs`) {
      try {
        const specText = await file('openapi.yaml').text();
        return new Response(specText, {
          headers: { 'Content-Type': 'application/yaml' }
        });
      } catch (e) {
        return new Response('OpenAPI spec not generated yet', { status: 503 });
      }
    }

    return new Response(JSON.stringify({
      error: 'Not Found',
      path: url.pathname,
      available: [
        `${api.basePath}/rules/validate`,
        `${api.basePath}/rules/grep`,
        `${api.basePath}/config`,
        `${api.basePath}/config/store`,
        `${api.basePath}/secrets/{name}`,
        `${api.basePath}/csrf/verify`,
        `${api.basePath}/yaml/stream`,
        `${api.basePath}/ws/negotiate`,
        `${api.basePath}/docs`,
        '/health'
      ]
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  },

  // Bun-specific error handling
  error(error) {
    console.error('🚨 Server error:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      timestamp: Date.now(),
      runtime: `Bun ${Bun.version}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

console.log(`✅ Citadel operational at http://localhost:${PORT}`);
console.log(`🩺 Health: http://localhost:${PORT}/health`);
console.log(`📚 OpenAPI: http://localhost:${PORT}${api.basePath}/docs`);
console.log(`🔗 WebSocket: ws://localhost:${PORT}${api.basePath}/ws/negotiate`);
console.log(`⚡ Ready for battle! Bun runtime: ${Bun.version}`);
