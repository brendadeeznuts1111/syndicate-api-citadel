import { expect, test, afterAll } from 'bun:test';

/**
 * Memory Leak Detector - Enhanced Runtime Gate
 *
 * Detects memory leaks in handlers and API components.
 * Ensures efficient memory usage and prevents memory bloat.
 */

let initialMemoryUsage: NodeJS.MemoryUsage;

test('memory baseline capture', () => {
  // Capture initial memory state
  initialMemoryUsage = process.memoryUsage();
  console.log(`📊 Initial memory: ${formatBytes(initialMemoryUsage.heapUsed)}`);
});

test('no handler leak - energy optimized endpoints', async () => {
  const before = process.memoryUsage().heapUsed;

  // Import energy-optimized handler (represents typical API handler)
  await import('../src/api/handlers/energy-optimized.ts');

  // Force garbage collection if available (Bun --smol mode)
  global.gc?.();

  const after = process.memoryUsage().heapUsed;
  const delta = after - before;

  console.log(`🔍 Energy handler memory delta: ${formatBytes(delta)}`);

  // Allow reasonable memory growth for handler loading
  expect(delta).toBeLessThan(2 * 1024 * 1024); // < 2 MB delta
});

test('no handler leak - core API handlers', async () => {
  const before = process.memoryUsage().heapUsed;

  // Import core handlers that are frequently used
  await import('../src/workers/handlers/health.ts');
  await import('../src/workers/handlers/config.ts');
  await import('../src/workers/handlers/validation.ts');

  global.gc?.();

  const after = process.memoryUsage().heapUsed;
  const delta = after - before;

  console.log(`🔍 Core handlers memory delta: ${formatBytes(delta)}`);

  // Core handlers should have minimal memory footprint
  expect(delta).toBeLessThan(1.5 * 1024 * 1024); // < 1.5 MB delta
});

test('memory efficiency - streaming operations', async () => {
  const before = process.memoryUsage().heapUsed;

  // Test streaming operations that should be memory efficient
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < 1000; i++) {
        controller.enqueue(`data ${i}\n`);
      }
      controller.close();
    }
  });

  // Consume the stream
  const reader = stream.getReader();
  let chunks = 0;
  while (true) {
    const { done } = await reader.read();
    if (done) break;
    chunks++;
  }

  global.gc?.();

  const after = process.memoryUsage().heapUsed;
  const delta = after - before;

  console.log(`🌊 Streaming memory delta: ${formatBytes(delta)} (${chunks} chunks)`);

  // Streaming should be memory efficient
  expect(delta).toBeLessThan(500 * 1024); // < 500 KB delta
  expect(chunks).toBe(1000); // All chunks processed
});

test('memory recovery - cleanup verification', () => {
  const current = process.memoryUsage();
  const deltaFromInitial = current.heapUsed - initialMemoryUsage.heapUsed;

  console.log(`🧹 Memory delta from baseline: ${formatBytes(deltaFromInitial)}`);

  // Total memory growth should be reasonable for all tests
  expect(deltaFromInitial).toBeLessThan(10 * 1024 * 1024); // < 10 MB total growth
});

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Cleanup after all tests
afterAll(() => {
  const final = process.memoryUsage();
  console.log(`🏁 Final memory usage: ${formatBytes(final.heapUsed)}`);
  console.log(`📈 Total memory growth: ${formatBytes(final.heapUsed - initialMemoryUsage.heapUsed)}`);
});
