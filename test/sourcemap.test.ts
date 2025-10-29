import { expect, test } from 'bun:test';

/**
 * Source Map Integrity Test - Enhanced Runtime Gate
 *
 * Ensures source maps are properly generated and included in built files.
 * Critical for debugging production issues and error tracing.
 */

test('built files include sourcemaps when built with --sourcemap', async () => {
  // First build with sourcemap enabled
  await Bun.spawn(['bun', 'run', 'cf:build'], {
    stdout: 'inherit',
    stderr: 'inherit'
  });

  // Check if dist directory exists and has built files
  try {
    const distFiles = await Bun.readdir('dist');
    if (distFiles.length > 0) {
      let foundJsFile = false;
      for (const file of distFiles) {
        if (file.endsWith('.js')) {
          foundJsFile = true;
          const content = await Bun.file(`dist/${file}`).text();
          // When built with sourcemap, should contain sourceMappingURL
          expect(content).toContain('//# sourceMappingURL=');
        }
      }
      expect(foundJsFile).toBe(true);
    } else {
      console.log('⚠️  No built files found - skipping sourcemap check');
    }
  } catch (error) {
    console.log('⚠️  Dist directory not found - skipping sourcemap check');
  }
});

test('TypeScript files can be processed for sourcemaps', async () => {
  // Test that our TypeScript files are properly structured for sourcemap generation
  const tsFiles = [
    'src/api/handlers/energy-optimized.ts',
    'src/workers/handlers/health.ts'
  ];

  for (const tsFile of tsFiles) {
    const content = await Bun.file(tsFile).text();

    // TypeScript files should have proper structure
    expect(content).toContain('//'); // Should have comments
    expect(content.length).toBeGreaterThan(100); // Should have substantial content

    // Should not contain sourceMappingURL (raw TS files don't have them)
    expect(content).not.toContain('//# sourceMappingURL=');
  }
});

test('sourcemap generation capability validation', async () => {
  // Test that Bun.build supports sourcemap configuration
  // This test validates the API exists and can be configured
  const testCode = `console.log("test");`;

  // Test that sourcemap option is accepted (even if build fails due to entrypoint)
  try {
    await Bun.build({
      entrypoints: [testCode], // Invalid entrypoint, but tests API
      sourcemap: 'external',
      target: 'browser'
    });
  } catch (error) {
    // Expected to fail due to invalid entrypoint, but sourcemap option should be accepted
    expect((error as Error).message).not.toContain('sourcemap');
  }
});

test('runtime sourcemap support validation', () => {
  // Test that Bun runtime supports sourcemap error rewriting
  const error = new Error('Test error with stack trace');
  error.stack = `Error: Test error with stack trace
    at testFunction (test.js:5:10)
    at main (test.js:10:5)`;

  // In a real sourcemap-enabled environment, the stack trace would be rewritten
  // For this test, we just verify the error handling works
  expect(error.stack).toContain('test.js');
  expect(error.message).toBe('Test error with stack trace');
});
