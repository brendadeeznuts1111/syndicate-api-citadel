// src/ai/inference-worker.ts - AI Inference Worker Thread (Bun 1.3 Enhanced)

// This implementation demonstrates Bun 1.3's improved worker_threads compatibility
// with environmentData API for sharing configuration between parent and worker threads.

// =============================================================================
// 🔧 CONFIGURATION (Bun 1.3 environmentData API)
// =============================================================================

import { getEnvironmentData, parentPort } from "node:worker_threads";

// Get shared configuration from parent thread using Bun 1.3 environmentData API
const models = getEnvironmentData("ai_models") || [
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
];

const workerConfig = getEnvironmentData("worker_config") || {
  maxConcurrentInferences: 5,
  timeout: 30000,
  debug: false
};

// =============================================================================
// 🤖 MOCK AI INFERENCE FUNCTIONS
// =============================================================================

// Mock content moderation (replace with real ML model)
async function moderateContent(text: string): Promise<{isAllowed: boolean, confidence: number, categories: string[]}> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

  // Mock classification (in reality, this would use a trained model)
  const forbiddenWords = ['spam', 'hate', 'violence'];
  const hasForbidden = forbiddenWords.some(word => text.toLowerCase().includes(word));

  return {
    isAllowed: !hasForbidden,
    confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
    categories: hasForbidden ? ['profanity'] : []
  };
}

// Mock sentiment analysis (replace with real ML model)
async function analyzeSentiment(text: string, language: string = 'en'): Promise<{sentiment: 'positive' | 'negative' | 'neutral', confidence: number}> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 75));

  // Mock analysis (in reality, this would use a trained model)
  const positiveWords = ['good', 'great', 'excellent', 'awesome', 'love'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst'];

  const positiveCount = positiveWords.filter(word => text.toLowerCase().includes(word)).length;
  const negativeCount = negativeWords.filter(word => text.toLowerCase().includes(word)).length;

  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  let confidence = 0.5;

  if (positiveCount > negativeCount) {
    sentiment = 'positive';
    confidence = 0.6 + Math.random() * 0.4;
  } else if (negativeCount > positiveCount) {
    sentiment = 'negative';
    confidence = 0.6 + Math.random() * 0.4;
  }

  return { sentiment, confidence };
}

// =============================================================================
// 🚀 MAIN INFERENCE LOOP (Bun 1.3 Worker Threads)
// =============================================================================

if (!parentPort) {
  console.error("❌ This worker must be run as a worker thread");
  process.exit(1);
}

console.error(`🤖 AI Inference Worker Thread started with ${models.length} models (Bun 1.3)`);
console.error(`📊 Models: ${models.map(m => m.name).join(', ')}`);
console.error(`⚙️  Worker config: maxConcurrent=${workerConfig.maxConcurrentInferences}, timeout=${workerConfig.timeout}ms`);

let inferenceCount = 0;
let activeInferences = 0;

// Process inference requests from parent thread via MessagePort
parentPort.on('message', async (request) => {
  try {
    // Check concurrent inference limit
    if (activeInferences >= workerConfig.maxConcurrentInferences) {
      parentPort!.postMessage({
        requestId: request.requestId,
        error: "Too many concurrent inferences",
        status: 429,
        timestamp: new Date().toISOString()
      });
      return;
    }

    activeInferences++;
    inferenceCount++;

    if (workerConfig.debug) {
      console.error(`🧠 Processing inference request #${inferenceCount}: ${request.type} (${activeInferences} active)`);
    }

    let result: any = null;

    // Route to appropriate model with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Inference timeout')), workerConfig.timeout)
    );

    const inferencePromise = (async () => {
      switch (request.type) {
        case 'content-moderation':
          return await moderateContent(request.text);
        case 'sentiment-analysis':
          return await analyzeSentiment(request.text, request.language);
        default:
          return { error: `Unknown inference type: ${request.type}` };
      }
    })();

    result = await Promise.race([inferencePromise, timeoutPromise]);

    // Send result back to parent thread
    const response = {
      requestId: request.requestId || `req_${inferenceCount}`,
      type: request.type,
      result: result,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - (request.timestamp || Date.now()),
      workerId: process.pid
    };

    parentPort!.postMessage(response);

  } catch (e) {
    console.error("❌ Error processing inference request:", e);
    parentPort!.postMessage({
      requestId: request.requestId,
      error: "Failed to process inference request",
      message: e.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    activeInferences--;
  }
});

// =============================================================================
// 📊 HEALTH MONITORING (Worker Thread)
// =============================================================================

setInterval(() => {
  const health = {
    status: 'healthy',
    inferencesProcessed: inferenceCount,
    activeInferences: activeInferences,
    uptime: `${(Date.now() - process.uptime() * 1000) / 1000}s`,
    memory: process.memoryUsage(),
    models: models.length,
    activeModels: models.map(m => m.name),
    workerConfig: workerConfig,
    workerId: process.pid
  };

  // Send health status to parent thread
  parentPort!.postMessage({ _health: health });
}, 30000); // Every 30 seconds

// =============================================================================
// 🛑 GRACEFUL SHUTDOWN (Worker Thread)
// =============================================================================

// Worker threads handle shutdown differently - listen for parent messages
parentPort!.on('close', () => {
  console.error("🛑 AI Worker Thread received close signal, shutting down gracefully");
  // Cleanup resources here (unload models, etc.)
  process.exit(0);
});

parentPort!.on('error', (error) => {
  console.error("❌ AI Worker Thread error:", error);
  process.exit(1);
});

// Handle worker thread termination
process.on('SIGTERM', () => {
  console.error("🛑 AI Worker Thread received SIGTERM, shutting down gracefully");
  parentPort!.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error("🛑 AI Worker Thread received SIGINT, shutting down gracefully");
  parentPort!.close();
  process.exit(0);
});

console.error(`✅ AI Inference Worker Thread ready for requests (Bun 1.3)`);
console.error(`💡 Receiving requests via MessagePort, sending responses to parent thread`);
