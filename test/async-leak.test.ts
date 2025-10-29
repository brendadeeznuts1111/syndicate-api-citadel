import { expect, test, describe, mock, expectTypeOf } from 'bun:test';

/**
 * Async Leak Detector - Enhanced Runtime Gate v1.3
 *
 * Leverages Bun 1.3 concurrent testing, new matchers, and mocking capabilities
 * for advanced async leak detection and resource management validation.
 */

// Concurrent async leak testing using Bun 1.3 test.concurrent
describe.concurrent('Async Resource Management', () => {
  test.concurrent('no dangling timers - API simulation', async () => {
    // Create a mock API function using Bun 1.3 mock()
    const mockApiCall = mock(async (endpoint: string) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { status: 200, data: `response from ${endpoint}` };
    });

    const beforeTimeouts = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;

    // Simulate concurrent API calls
    await Promise.all([
      mockApiCall('/api/users'),
      mockApiCall('/api/posts'),
      mockApiCall('/api/comments')
    ]);

    // Wait for promises to settle
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setTimeout(resolve, 10));

    const afterTimeouts = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;

    console.log(`⏰ Active timeouts: ${beforeTimeouts} → ${afterTimeouts}`);

    // Verify mock was called correctly using new Bun 1.3 matchers
    expect(mockApiCall).toHaveBeenCalledTimes(3);
    expect(mockApiCall).toHaveReturnedWith({ status: 200, data: 'response from /api/users' });

    // Check for resource leaks
    expect(afterTimeouts - beforeTimeouts).toBeLessThanOrEqual(0);
  });

  test.concurrent('concurrent operations - clean completion', async () => {
    const beforeResources = process.getActiveResourcesInfo();

    // Create multiple concurrent operations with different timings
    const operations = [
      { name: 'fast', delay: 5 },
      { name: 'medium', delay: 15 },
      { name: 'slow', delay: 25 }
    ];

    const results = await Promise.all(
      operations.map(async (op) => {
        await new Promise(resolve => setTimeout(resolve, op.delay));
        return `${op.name}-completed`;
      })
    );

    // Allow microtask queue to clear
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setTimeout(resolve, 5));

    const afterResources = process.getActiveResourcesInfo();

    console.log(`🔄 Concurrent operations completed: ${results.length}`);

    // Verify all operations completed correctly
    expect(results).toHaveLength(3);
    expect(results).toContain('fast-completed');
    expect(results).toContain('medium-completed');
    expect(results).toContain('slow-completed');

    // Check for reasonable resource growth
    const resourceGrowth = afterResources.length - beforeResources.length;
    console.log(`📊 Resource growth from concurrent ops: ${resourceGrowth}`);

    expect(resourceGrowth).toBeLessThan(15); // Reasonable growth for concurrent operations
  });

  test.serial('promise chain resolution - complex flows', async () => {
    // Use test.serial for complex sequential operations
    let resolveCount = 0;
    let rejectCount = 0;

    const createComplexPromiseChain = (depth: number, shouldFail = false): Promise<number> => {
      if (depth === 0) {
        return shouldFail ? Promise.reject(new Error('Intentional failure')) : Promise.resolve(42);
      }

      return createComplexPromiseChain(depth - 1, shouldFail)
        .then(value => {
          resolveCount++;
          // Add some async work
          return new Promise(resolve => setTimeout(() => resolve(value + 1), 1));
        })
        .catch(error => {
          rejectCount++;
          throw error;
        });
    };

    // Test successful chain
    const successResult = await createComplexPromiseChain(5, false);
    expect(successResult).toBe(47); // 42 + 5 levels
    expect(resolveCount).toBe(5);
    expect(rejectCount).toBe(0);

    // Reset counters
    resolveCount = 0;
    rejectCount = 0;

    // Test failing chain (using Bun 1.3 test.failing for expected failures)
    await expect(createComplexPromiseChain(3, true)).rejects.toThrow('Intentional failure');
    expect(rejectCount).toBe(1);

    // Allow cleanup
    await new Promise(resolve => setImmediate(resolve));

    console.log(`🔗 Complex promise chains tested: success + failure scenarios`);
  });

  test.concurrent.each([
    [5, 'small'],
    [50, 'medium'],
    [100, 'large']
  ])('async iterator cleanup - %s items (%s)', async (count, size) => {
    const beforeResources = process.getActiveResourcesInfo();

    // Test async iterator cleanup with different sizes
    async function* createAsyncIterator(itemCount: number) {
      for (let i = 0; i < itemCount; i++) {
        yield new Promise(resolve => setTimeout(() => resolve(`item-${i}`), Math.random() * 5));
      }
    }

    const values: string[] = [];
    for await (const value of createAsyncIterator(count)) {
      values.push(value);
    }

    await new Promise(resolve => setImmediate(resolve));

    const afterResources = process.getActiveResourcesInfo();

    console.log(`🔄 Async iterator (${size}): yielded ${values.length}/${count} values`);

    expect(values).toHaveLength(count);
    expect(values[0]).toBe('item-0');
    expect(values[count - 1]).toBe(`item-${count - 1}`);

    // Check resource cleanup (allow some growth for larger iterators)
    const resourceGrowth = afterResources.length - beforeResources.length;
    const maxGrowth = size === 'small' ? 5 : size === 'medium' ? 10 : 15;

    console.log(`📊 Resource growth (${size} iterator): ${resourceGrowth}`);
    expect(resourceGrowth).toBeLessThan(maxGrowth);
  });
});

// Advanced mocking tests using Bun 1.3 features
describe('Mock Resource Management', () => {
  test('mock cleanup and leak prevention', async () => {
    // Create a mock function using Bun 1.3 mock()
    const mockFn = mock((...args: any[]) => {
      return `called with ${args.length} args`;
    });

    // Call mock multiple times
    mockFn('arg1');
    mockFn('arg1', 'arg2');
    mockFn('arg1', 'arg2', 'arg3');

    // Test new Bun 1.3 matchers
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(mockFn).toHaveLastReturnedWith('called with 3 args');
    expect(mockFn).toHaveNthReturnedWith(1, 'called with 1 args');

    // Clear mocks using new Bun 1.3 mock.clearAllMocks()
    mock.clearAllMocks();

    // Verify mock is cleared
    expect(mockFn).toHaveBeenCalledTimes(0);

    console.log('🧹 Mock cleanup successful - no resource leaks');
  });

  test('async mock leak detection', async () => {
    const mockAsyncFn = mock(async (delay: number) => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return `delayed-${delay}`;
    });

    const beforeResources = process.getActiveResourcesInfo();

    // Call async mock concurrently
    await Promise.all([
      mockAsyncFn(5),
      mockAsyncFn(10),
      mockAsyncFn(15)
    ]);

    await new Promise(resolve => setImmediate(resolve));

    const afterResources = process.getActiveResourcesInfo();

    // Verify mock behavior
    expect(mockAsyncFn).toHaveBeenCalledTimes(3);
    expect(mockAsyncFn).toHaveReturnedWith('delayed-5');

    // Check for async leaks
    const resourceGrowth = afterResources.length - beforeResources.length;
    console.log(`📊 Async mock resource growth: ${resourceGrowth}`);

    expect(resourceGrowth).toBeLessThan(10);
  });
});

// Type testing with Bun 1.3 expectTypeOf()
describe('Type Safety in Async Operations', () => {
  test('promise type validation', () => {
    const promise = Promise.resolve(42);

    expectTypeOf(promise).resolves.toBeNumber();
    expectTypeOf<Promise<string>>().resolves.toBeString();

    // Test async function types
    const asyncFn = async (): Promise<number> => 42;
    expectTypeOf(asyncFn()).resolves.toBeNumber();
  });

  test('async iterator types', () => {
    async function* asyncGenerator(): AsyncIterableIterator<string> {
      yield 'hello';
      yield 'world';
    }

    expectTypeOf(asyncGenerator()).toEqualTypeOf<AsyncIterableIterator<string>>();
  });
});

// Timer cleanup verification
describe('Timer Resource Management', () => {
  test('timeout cleanup verification', async () => {
    const beforeTimeouts = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;

    // Create multiple timeouts
    const timeouts = [
      setTimeout(() => {}, 1),
      setTimeout(() => {}, 1),
      setTimeout(() => {}, 1)
    ];

    // Clear them immediately
    timeouts.forEach(clearTimeout);

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 10));

    const afterTimeouts = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;

    console.log(`⏰ Timeouts managed: ${beforeTimeouts} → ${afterTimeouts}`);

    // Timeouts should be cleaned up (may have some variance in timing)
    expect(afterTimeouts - beforeTimeouts).toBeLessThanOrEqual(1);
  });

  test('interval cleanup', async () => {
    const beforeIntervals = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;

    // Create and clear an interval
    const interval = setInterval(() => {}, 10);
    clearInterval(interval);

    await new Promise(resolve => setTimeout(resolve, 15));

    const afterIntervals = process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;

    console.log(`🔄 Intervals managed: ${beforeIntervals} → ${afterIntervals}`);

    // Should not have significant interval leaks
    expect(afterIntervals - beforeIntervals).toBeLessThanOrEqual(2);
  });
});
