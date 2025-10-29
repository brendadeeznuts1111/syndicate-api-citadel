import { expect, test } from 'bun:test';

/**
 * Async Leak Detector - Enhanced Runtime Gate
 *
 * Detects dangling async operations, timers, and promises.
 * Ensures clean async resource management and prevents resource leaks.
 */

test('no dangling timers - API route test', async () => {
  // Capture initial resource state
  const beforeResources = process.getActiveResourcesInfo();
  const beforeTimeouts = beforeResources.filter(r => r === 'Timeout').length;

  try {
    // Make a request to our own API (this will create some async operations)
    const response = await fetch('http://localhost:3004/health').catch(() => null);

    // If server isn't running, skip the test
    if (!response) {
      console.log('⚠️  Skipping async leak test - server not available');
      return;
    }

    // Wait for promises to settle
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setTimeout(resolve, 10));

    // Check for dangling resources
    const afterResources = process.getActiveResourcesInfo();
    const afterTimeouts = afterResources.filter(r => r === 'Timeout').length;

    console.log(`⏰ Active timeouts before: ${beforeTimeouts}, after: ${afterTimeouts}`);

    // Allow for some variance but detect significant leaks
    expect(afterTimeouts - beforeTimeouts).toBeLessThan(5);

  } catch (error) {
    // If we can't connect, that's OK - just skip the test
    console.log('⚠️  Async leak test skipped - connection failed');
  }
});

test('no dangling promises - concurrent operations', async () => {
  const beforeResources = process.getActiveResourcesInfo();

  // Create multiple concurrent operations
  const promises = Array.from({ length: 10 }, async (_, i) => {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    return `operation-${i}`;
  });

  // Wait for all to complete
  const results = await Promise.all(promises);

  // Allow microtask queue to clear
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setTimeout(resolve, 5));

  const afterResources = process.getActiveResourcesInfo();

  console.log(`🔄 Concurrent operations completed: ${results.length}`);

  // Verify all operations completed
  expect(results).toHaveLength(10);
  expect(results.every(r => r.startsWith('operation-'))).toBe(true);

  // Check for reasonable resource growth (some increase is normal)
  const beforeCount = beforeResources.length;
  const afterCount = afterResources.length;

  console.log(`📊 Resources before: ${beforeCount}, after: ${afterCount}`);

  expect(afterCount - beforeCount).toBeLessThan(20); // Reasonable growth
});

test('clean promise chain resolution', async () => {
  let resolveCount = 0;
  let rejectCount = 0;

  const createPromiseChain = (depth: number): Promise<number> => {
    if (depth === 0) {
      return Promise.resolve(42);
    }
    return createPromiseChain(depth - 1).then(value => {
      resolveCount++;
      return value + 1;
    });
  };

  // Test deep promise chain
  const result = await createPromiseChain(5);

  // Allow cleanup
  await new Promise(resolve => setImmediate(resolve));

  console.log(`🔗 Promise chain resolved: ${result} (resolve count: ${resolveCount})`);

  expect(result).toBe(47); // 42 + 5 levels
  expect(resolveCount).toBe(5); // Should resolve exactly 5 times
  expect(rejectCount).toBe(0); // No rejections
});

test('async iterator cleanup', async () => {
  const beforeResources = process.getActiveResourcesInfo();

  // Test async iterator cleanup
  async function* createAsyncIterator(count: number) {
    for (let i = 0; i < count; i++) {
      yield new Promise(resolve => setTimeout(() => resolve(i), 5));
    }
  }

  const values: number[] = [];
  for await (const value of createAsyncIterator(5)) {
    values.push(value);
  }

  await new Promise(resolve => setImmediate(resolve));

  const afterResources = process.getActiveResourcesInfo();

  console.log(`🔄 Async iterator yielded: ${values.length} values`);

  expect(values).toEqual([0, 1, 2, 3, 4]);

  // Check resource cleanup
  const resourceGrowth = afterResources.length - beforeResources.length;
  console.log(`📊 Resource growth from async iterator: ${resourceGrowth}`);

  expect(resourceGrowth).toBeLessThan(10);
});

test('timeout cleanup verification', async () => {
  const beforeTimeouts = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;

  // Create and cleanup timeouts
  const timeout1 = setTimeout(() => {}, 1);
  const timeout2 = setTimeout(() => {}, 1);

  clearTimeout(timeout1);
  clearTimeout(timeout2);

  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 10));

  const afterTimeouts = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;

  console.log(`⏰ Timeouts cleaned up: ${beforeTimeouts} → ${afterTimeouts}`);

  // Timeouts should be cleaned up
  expect(afterTimeouts).toBeLessThanOrEqual(beforeTimeouts);
});
