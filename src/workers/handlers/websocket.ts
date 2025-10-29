// src/workers/handlers/websocket.ts - WebSocket negotiation endpoint for Cloudflare Workers

export interface Env {
  NODE_ENV: string;
  API_VERSION: string;
}

export async function handleWebSocket(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Check if this is a WebSocket upgrade request
  const upgrade = request.headers.get('Upgrade');

  if (upgrade !== 'websocket') {
    return new Response(JSON.stringify({
      error: 'WebSocket Upgrade Required',
      message: 'This endpoint requires WebSocket upgrade',
      instructions: 'Use WebSocket protocol to connect'
    }), {
      status: 426, // Upgrade Required
      headers: {
        'Content-Type': 'application/json',
        'Upgrade': 'websocket',
        'Connection': 'Upgrade'
      }
    });
  }

  // Parse WebSocket subprotocol negotiation
  const protocol = new URL(request.url).searchParams.get('protocol') || 'json-rpc';
  const heartbeat = parseInt(new URL(request.url).searchParams.get('heartbeat') || '30000');

  // Get supported protocols
  const requestedProtocols = request.headers.get('Sec-WebSocket-Protocol')?.split(', ') || [];
  const supportedProtocols = ['json-rpc', 'api-events'];

  let selectedProtocol = protocol;
  for (const reqProtocol of requestedProtocols) {
    if (supportedProtocols.includes(reqProtocol.trim())) {
      selectedProtocol = reqProtocol.trim();
      break;
    }
  }

  // Create WebSocket pair
  const webSocketPair = new WebSocketPair();
  const client = webSocketPair[0];
  const server = webSocketPair[1];

  // Handle server-side WebSocket
  server.accept();

  // Send welcome message
  const welcomeMessage = {
    type: 'welcome',
    message: 'Syndicate API Citadel WebSocket (Cloudflare Workers)',
    version: env.API_VERSION || '1.0.0',
    protocol: selectedProtocol,
    heartbeat: heartbeat,
    compression: 'permessage-deflate', // Cloudflare handles compression
    platform: 'cloudflare-workers',
    timestamp: new Date().toISOString()
  };

  server.send(JSON.stringify(welcomeMessage));

  // Handle messages
  server.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data.toString());
      console.log('WebSocket message received:', data);

      // Echo response
      const response = {
        type: 'echo',
        original: data,
        timestamp: new Date().toISOString(),
        server: 'Cloudflare Workers API Citadel',
        compression: true
      };

      server.send(JSON.stringify(response));
    } catch (error) {
      server.send(JSON.stringify({
        type: 'error',
        message: 'Invalid JSON format',
        timestamp: new Date().toISOString()
      }));
    }
  });

  // Handle close
  server.addEventListener('close', (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
  });

  // Handle errors
  server.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Set up heartbeat if requested
  if (heartbeat > 0) {
    const heartbeatInterval = setInterval(() => {
      if (server.readyState === WebSocket.OPEN) {
        server.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
          platform: 'cloudflare-workers'
        }));
      } else {
        clearInterval(heartbeatInterval);
      }
    }, heartbeat);

    // Clean up interval when connection closes
    server.addEventListener('close', () => {
      clearInterval(heartbeatInterval);
    });
  }

  // Return client WebSocket with appropriate headers
  return new Response(null, {
    status: 101,
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'Sec-WebSocket-Protocol': selectedProtocol,
      'Sec-WebSocket-Accept': request.headers.get('Sec-WebSocket-Key') || '',
    },
    webSocket: client,
  });
}
