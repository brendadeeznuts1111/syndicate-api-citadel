// scripts/websocket-processor.ts - WebSocket Child Process for External Stream Processing

import { WebSocket } from "bun";

// =============================================================================
// 🔧 CONFIGURATION
// =============================================================================

// Get configuration from environment (passed by parent)
const wsConfig = process.env.WEBSOCKET_CONFIG ? JSON.parse(process.env.WEBSOCKET_CONFIG) : {
  externalUrl: "wss://plive.sportswidgets.pro/live",
  channels: ["sports", "news", "alerts"],
  filters: {
    activeEventsOnly: true,
    minPriority: 2
  },
  rateLimit: 1000
};

const STREAM_MODE = process.env.STREAM_MODE || 'pipe'; // 'pipe' or 'websocket'

// =============================================================================
// 🌐 EXTERNAL WEBSOCKET CONNECTION
// =============================================================================

let externalWs: WebSocket | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let messageCount = 0;
let lastMessageTime = Date.now();

// Connect to external WebSocket
function connectToExternalWebSocket() {
  try {
    console.error(`🔌 Connecting to external WebSocket: ${wsConfig.externalUrl}`);
    externalWs = new WebSocket(wsConfig.externalUrl);

    externalWs.onopen = () => {
      console.error("✅ Connected to external WebSocket stream");
      reconnectAttempts = 0;

      // Send subscription message if needed
      if (wsConfig.channels && wsConfig.channels.length > 0) {
        const subscription = {
          type: "subscribe",
          channels: wsConfig.channels,
          timestamp: Date.now()
        };
        externalWs?.send(JSON.stringify(subscription));
        console.error(`📡 Subscribed to channels: ${wsConfig.channels.join(', ')}`);
      }
    };

    externalWs.onmessage = (event) => {
      try {
        const rawData = typeof event.data === 'string' ? event.data : event.data.toString();
        const data = JSON.parse(rawData);

        messageCount++;
        lastMessageTime = Date.now();

        // Apply filters
        if (!passesFilters(data)) {
          return; // Skip this message
        }

        // Transform data
        const processedData = transformLiveEventData(data);

        if (processedData) {
          // Output to stdout (pipes to parent process)
          process.stdout.write(JSON.stringify({
            ...processedData,
            _processed: true,
            _timestamp: new Date().toISOString(),
            _source: 'external-websocket'
          }) + '\n');
        }

      } catch (e) {
        console.error("❌ Error processing external message:", e);
      }
    };

    externalWs.onerror = (event) => {
      console.error("🚨 External WebSocket error:", event);
    };

    externalWs.onclose = () => {
      console.error("🔌 External WebSocket connection closed");
      externalWs = null;

      // Attempt reconnection
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.error(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
        setTimeout(connectToExternalWebSocket, delay);
      } else {
        console.error("❌ Max reconnection attempts reached, exiting");
        process.exit(1);
      }
    };

  } catch (error) {
    console.error("❌ Failed to create external WebSocket connection:", error);
    process.exit(1);
  }
}

// =============================================================================
// 🔧 DATA PROCESSING & FILTERING
// =============================================================================

function passesFilters(data: any): boolean {
  // Apply configured filters
  if (wsConfig.filters?.activeEventsOnly && data.status !== 'active') {
    return false;
  }

  if (wsConfig.filters?.minPriority && data.priority < wsConfig.filters.minPriority) {
    return false;
  }

  // Rate limiting
  if (wsConfig.rateLimit) {
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTime;
    const minInterval = 1000 / wsConfig.rateLimit;

    if (timeSinceLastMessage < minInterval) {
      return false; // Skip this message to respect rate limit
    }
  }

  return true;
}

function transformLiveEventData(data: any): any {
  // Transform external data format to internal format
  // This is a placeholder - customize based on actual external API format

  try {
    // Example transformation for sports/live events
    if (data.type === 'sports_event' || data.eventType === 'live') {
      return {
        id: data.id || data.eventId,
        type: 'live_event',
        sport: data.sport || data.league,
        teams: data.teams || [data.homeTeam, data.awayTeam].filter(Boolean),
        score: data.score || `${data.homeScore || 0}-${data.awayScore || 0}`,
        status: data.status || 'live',
        priority: data.priority || 1,
        timestamp: data.timestamp || new Date().toISOString(),
        metadata: {
          source: 'plive.sportswidgets.pro',
          raw: data
        }
      };
    }

    // Example transformation for news/alerts
    if (data.type === 'news' || data.type === 'alert') {
      return {
        id: data.id || `news_${Date.now()}`,
        type: 'news_alert',
        title: data.title || data.headline,
        content: data.content || data.message,
        category: data.category || 'general',
        priority: data.priority || 2,
        timestamp: data.timestamp || new Date().toISOString(),
        metadata: {
          source: 'plive.sportswidgets.pro',
          raw: data
        }
      };
    }

    // Pass through other data types
    return {
      ...data,
      _processed: true,
      _timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error("❌ Error transforming data:", error);
    return null;
  }
}

// =============================================================================
// 📊 HEALTH MONITORING
// =============================================================================

// Health monitoring
setInterval(() => {
  const health = {
    status: externalWs?.readyState === WebSocket.OPEN ? 'healthy' : 'disconnected',
    externalConnection: externalWs?.readyState === WebSocket.OPEN,
    messageCount: messageCount,
    lastMessageTime: new Date(lastMessageTime).toISOString(),
    uptime: `${(Date.now() - process.uptime() * 1000) / 1000}s`,
    memory: process.memoryUsage()
  };

  // Send health status to stderr (doesn't interfere with data stream)
  console.error(JSON.stringify({ _health: health }));
}, 30000); // Every 30 seconds

// =============================================================================
// 🚀 START PROCESSOR
// =============================================================================

console.error(`🎯 WebSocket Processor started for: ${wsConfig.externalUrl}`);
console.error(`📡 Channels: ${wsConfig.channels?.join(', ') || 'all'}`);
console.error(`🔧 Filters: ${JSON.stringify(wsConfig.filters)}`);
console.error(`⚡ Rate limit: ${wsConfig.rateLimit || 'unlimited'} msgs/sec`);
console.error(`📺 Stream mode: ${STREAM_MODE}`);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.error("🛑 Received SIGTERM, shutting down gracefully");
  if (externalWs) {
    externalWs.close();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error("🛑 Received SIGINT, shutting down gracefully");
  if (externalWs) {
    externalWs.close();
  }
  process.exit(0);
});

// Listen for messages from parent process (if bidirectional)
if (process.stdin) {
  process.stdin.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.error(`📨 Message from parent:`, message);

      // Forward to external WebSocket if needed
      if (externalWs?.readyState === WebSocket.OPEN) {
        externalWs.send(JSON.stringify(message));
      }
    } catch (e) {
      console.error("❌ Error processing message from parent:", e);
    }
  });
}

// Start the processor
connectToExternalWebSocket();
