// src/api/gateway.ts - Syndicate API Citadel Gateway (Bun.serve() Dynamic API Server)

import { serve } from "bun";
import {
  createRoutes,
  checkReloadSignal,
  config,
  databaseConnections,
  redisConnections,
  websocketConfigs,
  compressionConfigs,
  createSecureCookie,
  parseRequestCookies,
  createCompressedResponse,
  processRequestStream,
  spawnWebSocketProcessor
} from "../generated/api-server-config.js";
import { WebSocket } from "bun";

// =============================================================================
// 🔧 CONFIGURATION & SETUP
// =============================================================================

const PORT = process.env.PORT || config.rules.api.port || 3004;
const BASE_PATH = config.rules.api.basePath;

// Active WebSocket connections registry
const activeWebSocketConnections = new Set<WebSocket>();

// Heartbeat intervals registry for cleanup
const heartbeatIntervals = new Map<WebSocket, NodeJS.Timeout>();

// Child process registry for streaming WebSocket cleanup
const streamingProcesses = new Map<WebSocket, { process: any, controller: AbortController }>();

// Current routes (hot-reloadable)
let currentRoutes = createRoutes();

// =============================================================================
// 🌐 WEBSOCKET UPGRADE HANDLING
// =============================================================================

async function handleWebSocketUpgrade(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const upgrade = request.headers.get('upgrade');

  if (upgrade?.toLowerCase() === 'websocket') {
    // Negotiate WebSocket connection with Bun 1.3 enhancements
    if (url.pathname === `${BASE_PATH}/ws/negotiate`) {
      // Bun 1.3: Direct cookie access with Map-like API
      const sessionId = request.cookies.get('sessionId');

      const protocol = url.searchParams.get('protocol') || 'json-rpc';
      const heartbeat = parseInt(url.searchParams.get('heartbeat') || '30000');

      // Bun 1.3: RFC 6455 subprotocol negotiation
      const requestedProtocols = request.headers.get('sec-websocket-protocol')?.split(', ') || [];
      const supportedProtocols = ['json-rpc', 'api-events'];

      let selectedProtocol = protocol; // Use query param as default
      for (const reqProtocol of requestedProtocols) {
        if (supportedProtocols.includes(reqProtocol.trim())) {
          selectedProtocol = reqProtocol.trim();
          break;
        }
      }

      return new Response(null, {
        status: 101,
        headers: {
          'Sec-WebSocket-Protocol': selectedProtocol
        },
        webSocket: {
          // Bun 1.3: WebSocket compression and header overrides
          perMessageDeflate: compressionConfigs.websocket?.enabled ?? true,
          headers: {
            // Override default headers for enhanced WebSocket connections
            'User-Agent': `Bun-Citadel-Gateway/${config.version}`,
            'Sec-WebSocket-Key': request.headers.get('sec-websocket-key'), // Preserve original key
          },
          open(ws: WebSocket) {
            console.log('🔗 WebSocket connection established with Bun 1.3 compression');
            activeWebSocketConnections.add(ws);

            // Send welcome message with compression info
            const welcomeMessage = {
              type: 'welcome',
              message: 'Syndicate API Citadel WebSocket (Bun 1.3 Enhanced)',
              version: config.version,
              protocol: selectedProtocol,
              heartbeat: heartbeat,
              compression: compressionConfigs.websocket?.enabled ? 'permessage-deflate' : 'none',
              authenticated: !!sessionId,
              timestamp: Date.now()
            };

            ws.send(JSON.stringify(welcomeMessage));

            // Start heartbeat if requested (Bun 1.3 enhanced)
            if (heartbeat > 0) {
              const heartbeatInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'heartbeat',
                    timestamp: Date.now(),
                    compression: compressionConfigs.websocket?.enabled || false
                  }));
                } else {
                  // Auto-cleanup if connection is not open
                  clearInterval(heartbeatInterval);
                  heartbeatIntervals.delete(ws);
                }
              }, heartbeat);

              // Store interval for cleanup
              heartbeatIntervals.set(ws, heartbeatInterval);
            }
          },
          message(ws: WebSocket, message: string | Buffer) {
            try {
              const data = JSON.parse(message.toString());
              console.log('📨 WS Message (Bun 1.3 compressed):', data);

              // Enhanced message processing with compression awareness
              const response = {
                type: 'echo',
                original: data,
                timestamp: Date.now(),
                server: 'Bun Citadel Gateway (v1.3)',
                compressed: compressionConfigs.websocket?.enabled || false
              };

              ws.send(JSON.stringify(response));

            } catch (e) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid JSON format',
                timestamp: Date.now()
              }));
            }
          },
          close(ws: WebSocket) {
            console.log('🔌 WebSocket connection closed');
            activeWebSocketConnections.delete(ws);

            // Clean up heartbeat interval (Bun 1.3 resource management)
            const interval = heartbeatIntervals.get(ws);
            if (interval) {
              clearInterval(interval);
              heartbeatIntervals.delete(ws);
            }
          }
        }
      });
    }

    // Handle streaming WebSocket endpoints
    for (const [configName, wsConfig] of Object.entries(websocketConfigs)) {
      if (url.pathname === `${BASE_PATH}/stream/${configName}`) {
        // Only handle streaming endpoints that have a processor configured
        if (!wsConfig.processor) {
          return new Response('Streaming processor not configured', { status: 404 });
        }

        return new Response(null, {
          status: 101,
          webSocket: {
            // Bun 1.3: Enhanced WebSocket with compression and header overrides
            perMessageDeflate: wsConfig.compression === 'permessage-deflate',
            headers: {
              'User-Agent': `Bun-Citadel-Streaming/${config.version}`,
              'X-Stream-Config': JSON.stringify(wsConfig),
            },
            open(ws: WebSocket) {
              console.log(`🌊 Streaming WebSocket opened for ${configName} (Bun 1.3 enhanced)`);
              activeWebSocketConnections.add(ws);

              // Create AbortController for cleanup (Bun 1.3 resource management)
              const controller = new AbortController();

              // Spawn child processor with Bun 1.3 enhanced configuration
              const processor = Bun.spawn(['bun', 'run', wsConfig.processor], {
                stdout: 'pipe',
                stderr: 'pipe',
                signal: controller.signal, // Bun 1.3: AbortController support
                env: {
                  ...process.env,
                  WEBSOCKET_CONFIG: JSON.stringify(wsConfig),
                  COMPRESSION_CONFIG: JSON.stringify(compressionConfigs.websocket || {}),
                  STREAM_MODE: 'websocket'
                }
              });

              // Track process for cleanup
              streamingProcesses.set(ws, { process: processor, controller });

              // Pipe processor stdout to WebSocket with Bun 1.3 stream processing
              processor.stdout.pipeTo(new WritableStream({
                write(chunk) {
                  if (ws.readyState === WebSocket.OPEN) {
                    // Apply compression if enabled
                    if (compressionConfigs.websocket?.enabled && wsConfig.compression === 'permessage-deflate') {
                      // WebSocket permessage-deflate is handled at protocol level
                      ws.send(chunk);
                    } else {
                      ws.send(chunk);
                    }
                  }
                }
              })).catch(error => {
                console.error(`Stream error for ${configName}:`, error);
              });

              // Enhanced error handling with Bun 1.3 stream methods
              processor.stderr.pipeTo(new WritableStream({
                write(chunk) {
                  console.error(`Processor error for ${configName}:`, chunk.toString());
                  // Send error to WebSocket if still open
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'error',
                      message: 'Processor error',
                      details: chunk.toString(),
                      timestamp: Date.now()
                    }));
                  }
                }
              }));

              // Handle process completion
              processor.exited.then(code => {
                console.log(`Processor for ${configName} exited with code ${code}`);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'stream_end',
                    code: code,
                    timestamp: Date.now()
                  }));
                }
              }).catch(error => {
                console.error(`Processor spawn error for ${configName}:`, error);
              });
            },
            message(ws: WebSocket, message: string | Buffer) {
              // Forward messages to processor if needed
              console.log(`📨 Streaming message for ${configName}:`, message.toString());
            },
            close(ws: WebSocket) {
              console.log(`🔌 Streaming WebSocket closed for ${configName}`);
              activeWebSocketConnections.delete(ws);

              // Clean up child process (Bun 1.3 resource management)
              const streamingData = streamingProcesses.get(ws);
              if (streamingData) {
                const { process, controller } = streamingData;

                // Abort the process gracefully
                controller.abort();

                // Force kill if still running after a short delay
                setTimeout(() => {
                  if (!process.killed) {
                    process.kill('SIGTERM');
                    setTimeout(() => {
                      if (!process.killed) {
                        process.kill('SIGKILL');
                      }
                    }, 5000); // Force kill after 5 seconds
                  }
                }, 1000); // Graceful shutdown period

                streamingProcesses.delete(ws);
              }
            }
          }
        });
      }
    }
  }

  return null;
}

// =============================================================================
// 🚀 MAIN REQUEST HANDLER
// =============================================================================

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  // Handle WebSocket upgrades first
  const wsResponse = await handleWebSocketUpgrade(request);
  if (wsResponse) return wsResponse;

  // Health check endpoint with compression
  if (pathname === '/health') {
    const uptime = performance.now();
    const memory = process.memoryUsage();

    const healthData = {
      status: 'healthy',
      version: config.version,
      runtime: `Bun ${Bun.version}`,
      uptime: `${(uptime / 1000).toFixed(2)}s`,
      requests: 0, // Would need request counter
      memory: {
        rss: `${(memory.rss / 1024 / 1024).toFixed(2)}MB`,
        heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)}MB`
      },
      endpoints: Object.keys(currentRoutes).length,
      websockets: activeWebSocketConnections.size,
      databases: Object.keys(databaseConnections).length,
      redis: Object.keys(redisConnections).length,
      // Bun 1.3 features
      compression: {
        zstd: 'available',
        websocket: compressionConfigs.websocket?.enabled ? 'enabled' : 'disabled'
      },
      timestamp: new Date().toISOString()
    };

    // Bun 1.3: Automatic compression for large responses
    return await createCompressedResponse(healthData, request);
  }

  // OpenAPI spec endpoint
  if (pathname === `${BASE_PATH}/docs`) {
    try {
      const specText = await Bun.file('openapi.yaml').text();
      return new Response(specText, {
        headers: { 'Content-Type': 'application/yaml' }
      });
    } catch (e) {
      return new Response('OpenAPI spec not generated yet', { status: 503 });
    }
  }

  // Find matching route
  const routeKey = Object.keys(currentRoutes).find(routePath => {
    const route = currentRoutes[routePath];

    // Simple path matching (extend with proper routing)
    if (routePath === pathname && route.method === method) {
      return true;
    }

    // Support path parameters
    const routePattern = routePath.replace(/{[^}]+}/g, '([^/]+)');
    const regex = new RegExp(`^${routePattern}$`);
    return regex.test(pathname) && route.method === method;
  });

  if (routeKey) {
    try {
      const route = currentRoutes[routeKey];
      const response = await route.handler(request);

      // Bun 1.3: Apply automatic compression to route responses
      if (response instanceof Response && response.status === 200) {
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > (compressionConfigs.default?.threshold || 1024)) {
          // Compress the response
          const body = await response.text();
          return await createCompressedResponse(JSON.parse(body), request);
        }
      }

      return response;
    } catch (error) {
      console.error(`Route handler error for ${routeKey}:`, error);
      return Response.json({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  }

  // Not found
  return Response.json({
    error: 'Not Found',
    path: pathname,
    method: method,
    availableRoutes: Object.keys(currentRoutes),
    timestamp: new Date().toISOString()
  }, { status: 404 });
}

// =============================================================================
// 🔄 HOT RELOAD MECHANISM
// =============================================================================

async function checkForReload() {
  const shouldReload = await checkReloadSignal();
  if (shouldReload) {
    console.log('🔄 Hot reload signal detected, reloading routes...');

    try {
      // Clear require cache for the generated config
      delete require.cache[require.resolve('../generated/api-server-config.js')];

      // Re-import and recreate routes
      const { createRoutes: newCreateRoutes } = await import('../generated/api-server-config.js');
      currentRoutes = newCreateRoutes();

      console.log(`✅ Routes reloaded: ${Object.keys(currentRoutes).length} routes active`);
    } catch (error) {
      console.error('❌ Failed to reload routes:', error);
    }
  }
}

// Start reload checker
setInterval(checkForReload, 1000); // Check every second

// =============================================================================
// 🛑 GRACEFUL SHUTDOWN HANDLER (Bun 1.3 Resource Management)
// =============================================================================

async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);

  // Close all WebSocket connections
  console.log(`🔌 Closing ${activeWebSocketConnections.size} WebSocket connections...`);
  for (const ws of activeWebSocketConnections) {
    ws.close(1000, 'Server shutdown');
  }

  // Clean up heartbeat intervals
  console.log(`🕐 Cleaning up ${heartbeatIntervals.size} heartbeat intervals...`);
  for (const [ws, interval] of heartbeatIntervals) {
    clearInterval(interval);
  }
  heartbeatIntervals.clear();

  // Clean up streaming processes
  console.log(`🔧 Terminating ${streamingProcesses.size} streaming processes...`);
  const shutdownPromises = [];

  for (const [ws, { process, controller }] of streamingProcesses) {
    shutdownPromises.push(
      new Promise<void>((resolve) => {
        controller.abort();

        // Wait for process to exit or force kill
        const timeout = setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        process.exited.then(() => {
          clearTimeout(timeout);
          resolve();
        }).catch(() => {
          clearTimeout(timeout);
          resolve();
        });
      })
    );
  }

  // Wait for all processes to shut down
  await Promise.all(shutdownPromises);

  console.log('✅ Graceful shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =============================================================================
// 🚀 START THE SERVER
// =============================================================================

console.log(`🏰 Syndicate API Citadel Gateway v${config.version} (Bun 1.3 Enhanced)`);
console.log(`🚀 Starting Bun.serve() on port ${PORT}`);
console.log(`📍 Base path: ${BASE_PATH}`);
console.log(`🔗 WebSocket endpoint: ws://localhost:${PORT}${BASE_PATH}/ws/negotiate`);
console.log(`📚 OpenAPI docs: http://localhost:${PORT}${BASE_PATH}/docs`);
console.log(`💚 Health check: http://localhost:${PORT}/health`);
console.log(`🗄️  Databases configured: ${Object.keys(databaseConnections).length}`);
console.log(`🔴 Redis connections: ${Object.keys(redisConnections).length}`);
console.log(`🌐 WebSocket streams: ${Object.keys(websocketConfigs).length}`);
console.log(`🗜️  Zstandard compression: ${compressionConfigs.default?.algorithm || 'disabled'}`);
console.log(`⚡ Runtime: Bun ${Bun.version} (v1.3 features enabled)`);

serve({
  port: PORT,
  async fetch(request) {
    return handleRequest(request);
  },
  error(error) {
    console.error('🚨 Gateway server error:', error);
    return Response.json({
      error: 'Internal Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});

console.log(`✅ Citadel Gateway operational at http://localhost:${PORT}`);
console.log(`🔄 Hot reload enabled - watching for configuration changes`);
console.log(`🛡️  Graceful shutdown enabled - resources will be cleaned up on exit`);
console.log(`🚀 Bun 1.3 features: YAML parse/stringify, Map-like cookies, ReadableStream methods, WebSocket permessage-deflate, WebAssembly streaming, AbortController`);
