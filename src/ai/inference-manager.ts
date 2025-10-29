// src/ai/inference-manager.ts - AI Inference Manager with Worker Threads (Bun 1.3)

// Demonstrates Bun 1.3's improved worker_threads compatibility with environmentData API

import { Worker, setEnvironmentData, getEnvironmentData } from "node:worker_threads";
import { join } from "path";

// =============================================================================
// 🔧 WORKER THREAD MANAGEMENT (Bun 1.3 Enhanced)
// =============================================================================

class InferenceManager {
  private workers: Worker[] = [];
  private workerQueue: Map<Worker, any[]> = new Map();
  private maxWorkers: number;
  private workerPath: string;

  constructor(maxWorkers: number = 2) {
    this.maxWorkers = maxWorkers;
    this.workerPath = join(process.cwd(), "src/ai/inference-worker.ts");
  }

  // Initialize worker pool with shared configuration
  async initialize() {
    console.log(`🤖 Initializing AI Inference Manager with ${this.maxWorkers} workers (Bun 1.3)`);

    // Set shared configuration using Bun 1.3 environmentData API
    setEnvironmentData("ai_models", [
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
    ]);

    setEnvironmentData("worker_config", {
      maxConcurrentInferences: 3,
      timeout: 15000,
      debug: process.env.NODE_ENV === "development"
    });

    // Create worker pool
    for (let i = 0; i < this.maxWorkers; i++) {
      await this.createWorker();
    }

    console.log(`✅ AI Inference Manager ready with ${this.workers.length} workers`);
  }

  private async createWorker(): Promise<Worker> {
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker(this.workerPath, {
          // Worker options
          env: { ...process.env },
          resourceLimits: {
            maxOldGenerationSizeMb: 512,
            maxYoungGenerationSizeMb: 128
          }
        });

        // Set up message handling
        worker.on('message', (message) => {
          if (message._health) {
            // Health check message
            console.log(`💚 Worker ${worker.threadId} health:`, message._health);
          } else {
            // Inference result - handle via queue system
            this.handleWorkerResponse(worker, message);
          }
        });

        worker.on('error', (error) => {
          console.error(`❌ Worker ${worker.threadId} error:`, error);
          this.handleWorkerError(worker, error);
        });

        worker.on('exit', (code) => {
          console.log(`🛑 Worker ${worker.threadId} exited with code ${code}`);
          this.handleWorkerExit(worker);
        });

        worker.on('online', () => {
          console.log(`🟢 Worker ${worker.threadId} is online`);
          resolve(worker);
        });

        this.workers.push(worker);
        this.workerQueue.set(worker, []);

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleWorkerResponse(worker: Worker, response: any) {
    // In a real implementation, this would route responses back to waiting requests
    console.log(`📨 Response from worker ${worker.threadId}:`, response);
  }

  private handleWorkerError(worker: Worker, error: Error) {
    // Remove failed worker and create replacement
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
      this.workerQueue.delete(worker);
      console.log(`🔄 Recreating failed worker ${worker.threadId}`);
      this.createWorker();
    }
  }

  private handleWorkerExit(worker: Worker) {
    // Clean up worker references
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
      this.workerQueue.delete(worker);
    }
  }

  // Run inference using worker pool
  async runInference(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Find available worker
      const availableWorker = this.workers.find(worker =>
        !worker.terminate && this.workerQueue.get(worker)!.length === 0
      );

      if (!availableWorker) {
        reject(new Error("No available workers"));
        return;
      }

      const request = {
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        ...data,
        timestamp: Date.now()
      };

      // Queue request
      this.workerQueue.get(availableWorker)!.push({ request, resolve, reject });

      // Send to worker
      availableWorker.postMessage(request);
    });
  }

  // Graceful shutdown
  async shutdown() {
    console.log("🛑 Shutting down AI Inference Manager...");

    const shutdownPromises = this.workers.map(worker =>
      new Promise<void>((resolve) => {
        worker.once('exit', () => resolve());
        worker.terminate();
      })
    );

    await Promise.all(shutdownPromises);
    this.workers = [];
    this.workerQueue.clear();

    console.log("✅ AI Inference Manager shut down");
  }

  // Get manager stats
  getStats() {
    return {
      totalWorkers: this.workers.length,
      activeWorkers: this.workers.filter(w => !w.terminate).length,
      queueLengths: Array.from(this.workerQueue.values()).map(q => q.length),
      environmentData: {
        ai_models: getEnvironmentData("ai_models"),
        worker_config: getEnvironmentData("worker_config")
      }
    };
  }
}

// =============================================================================
// 🚀 DEMONSTRATION
// =============================================================================

async function demonstrateWorkerThreads() {
  console.log("🧪 Demonstrating Bun 1.3 Worker Threads with environmentData API");
  console.log("=" .repeat(60));

  const manager = new InferenceManager(2);

  try {
    // Initialize workers
    await manager.initialize();

    // Show environment data sharing
    console.log("\n📊 Environment Data Sharing:");
    console.log("Shared AI models:", getEnvironmentData("ai_models"));
    console.log("Shared worker config:", getEnvironmentData("worker_config"));

    // Run some test inferences
    console.log("\n🧠 Running Test Inferences:");

    const testCases = [
      { type: "content-moderation", text: "This is a clean message" },
      { type: "content-moderation", text: "This contains spam content" },
      { type: "sentiment-analysis", text: "I love this product!", language: "en" },
      { type: "sentiment-analysis", text: "This is terrible", language: "en" }
    ];

    for (const testCase of testCases) {
      try {
        const result = await manager.runInference(testCase.type, testCase);
        console.log(`✅ ${testCase.type}:`, result);
      } catch (error) {
        console.log(`❌ ${testCase.type}:`, error.message);
      }
    }

    // Show manager stats
    console.log("\n📈 Manager Stats:", manager.getStats());

    // Wait a bit for health checks
    await new Promise(resolve => setTimeout(resolve, 32000));

  } finally {
    await manager.shutdown();
  }

  console.log("\n🎉 Worker Threads demonstration complete!");
}

// Export for use in other modules
export { InferenceManager };

// Run demonstration if called directly
if (import.meta.main) {
  demonstrateWorkerThreads().catch(console.error);
}
