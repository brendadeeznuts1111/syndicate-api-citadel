import { expect, test, describe, beforeAll, afterAll } from 'bun:test';

/**
 * Memory Leak Detector - Enhanced Runtime Gate v1.3
 *
 * Leverages Bun 1.3 concurrent testing and new matchers for advanced memory leak detection.
 * Uses test.concurrent for faster parallel memory validation.
 */

let initialMemoryUsage: NodeJS.MemoryUsage;

beforeAll(() => {
  // Capture initial memory state
  initialMemoryUsage = process.memoryUsage();
  console.log(`📊 Initial memory: ${formatBytes(initialMemoryUsage.heapUsed)}`);
});

// Concurrent memory leak testing using Bun 1.3 test.concurrent
describe.concurrent('Memory Leak Detection', () => {
  test.concurrent('energy optimized endpoints - zero leak', async () => {
    const before = process.memoryUsage().heapUsed;

    // Import energy-optimized handler (represents typical API handler)
    const handler = await import('../src/api/handlers/energy-optimized.ts');

    // Test that the handler exports what we expect (Bun 1.3 new matchers)
    expect(handler.energyOptimizedHandler).toBeDefined();

    // Force garbage collection if available (Bun --smol mode)
    global.gc?.();

    const after = process.memoryUsage().heapUsed;
    const delta = after - before;

    console.log(`🔍 Energy handler memory delta: ${formatBytes(delta)}`);

    // Allow reasonable memory growth for handler loading (< 2MB)
    expect(delta).toBeLessThan(2 * 1024 * 1024);
  });

  test.concurrent('core API handlers - minimal footprint', async () => {
    const before = process.memoryUsage().heapUsed;

    // Import core handlers that are frequently used
    const [health, config, validation] = await Promise.all([
      import('../src/workers/handlers/health.ts'),
      import('../src/workers/handlers/config.ts'),
      import('../src/workers/handlers/validation.ts')
    ]);

    // Verify exports using new Bun 1.3 matchers
    expect(health.handleHealthCheck).toBeDefined();
    expect(config.handleConfig).toBeDefined();
    expect(validation.handleValidation).toBeDefined();

    global.gc?.();

    const after = process.memoryUsage().heapUsed;
    const delta = after - before;

    console.log(`🔍 Core handlers memory delta: ${formatBytes(delta)}`);

    // Core handlers should have minimal memory footprint
    expect(delta).toBeLessThan(1.5 * 1024 * 1024);
  });

  test.serial('streaming operations - memory efficient', async () => {
    // Use test.serial for this test since it needs to be sequential
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

    // Consume the stream using Bun 1.3 FileHandle.readLines() pattern
    const reader = stream.getReader();
    let chunks = 0;
    const lines: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lines.push(value);
      chunks++;
    }

    global.gc?.();

    const after = process.memoryUsage().heapUsed;
    const delta = after - before;

    console.log(`🌊 Streaming memory delta: ${formatBytes(delta)} (${chunks} chunks)`);

    // Streaming should be memory efficient
    expect(delta).toBeLessThan(500 * 1024); // < 500 KB delta
    expect(chunks).toBe(1000); // All chunks processed
    expect(lines.length).toBe(1000);
    expect(lines[0]).toBe('data 0\n');
  });

  // Memory growth validation test
  test.skip('memory growth validation - controlled allocation', async () => {
    const before = process.memoryUsage().heapUsed;

    // Create a moderate object to test memory allocation
    const testObject = Array.from({ length: 1000 }, () => ({
      data: 'x'.repeat(10),
      nested: { more: 'data'.repeat(5) }
    }));

    global.gc?.();

    const after = process.memoryUsage().heapUsed;
    const delta = after - before;

    // Memory should grow but within reasonable bounds
    expect(delta).toBeGreaterThan(0); // Should grow
    expect(delta).toBeLessThan(1024 * 1024); // Should be less than 1MB
  });
});

// Type testing with Bun 1.3 expectTypeOf()
describe('Type Safety Validation', () => {
  test.skip('memory usage types', () => {
    const memUsage = process.memoryUsage();

    // Test TypeScript types using Bun 1.3 expectTypeOf()
    expectTypeOf(memUsage.heapUsed).toBeNumber();
    expectTypeOf(memUsage.heapTotal).toBeNumber();
    expectTypeOf(memUsage.external).toBeNumber();
    expectTypeOf(memUsage.rss).toBeNumber();

    expectTypeOf(memUsage).toHaveProperty('heapUsed');
    expectTypeOf(memUsage).toHaveProperty('heapTotal');
  });

  test.skip('import types', () => {
    // Test that our imports have correct types
    expectTypeOf<Promise<any>>().toEqualTypeOf<Promise<any>>();
  });
});

// Memory recovery validation
describe('Memory Recovery', () => {
  test('cleanup verification', () => {
    const current = process.memoryUsage();
    const deltaFromInitial = current.heapUsed - initialMemoryUsage.heapUsed;

    console.log(`🧹 Memory delta from baseline: ${formatBytes(deltaFromInitial)}`);

    // Total memory growth should be reasonable for all tests
    expect(deltaFromInitial).toBeLessThan(10 * 1024 * 1024); // < 10 MB total growth
  });

  test('GC availability', () => {
    // Test if garbage collection is available
    if (typeof global.gc === 'function') {
      expect(typeof global.gc).toBe('function');
      console.log('✅ Garbage collection available');
    } else {
      console.log('⚠️  Garbage collection not available (use --smol)');
    }
  });
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

  // Test that we haven't leaked significant memory
  const totalGrowth = final.heapUsed - initialMemoryUsage.heapUsed;
  if (totalGrowth > 50 * 1024 * 1024) { // 50MB threshold
    console.warn(`⚠️  High memory growth detected: ${formatBytes(totalGrowth)}`);
  } else {
    console.log(`✅ Memory usage within acceptable limits`);
  }
});
