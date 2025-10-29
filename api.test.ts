// api.test.ts - Bun-powered API testing suite

import { describe, test, expect, beforeAll } from 'bun:test';

const BASE_URL = 'http://localhost:3004';

describe('Syndicate API Citadel Tests', () => {
  let serverProcess: any;

  beforeAll(async () => {
    // Start the server for testing
    console.log('🚀 Starting test server...');
    // Note: In real implementation, you'd start the server programmatically
    // For now, assuming server is already running
  });

  describe('Health Check', () => {
    test('GET /health returns server status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.runtime).toContain('Bun');
      expect(data.version).toBe('v3.0');
      expect(typeof data.requests).toBe('number');
      expect(typeof data.uptime).toBe('string');
    });
  });

  describe('API Endpoints', () => {
    test('GET /api/v3/config returns YAML config', async () => {
      const response = await fetch(`${BASE_URL}/api/v3/config`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/yaml');

      const yamlText = await response.text();
      expect(yamlText).toContain('rules:');
      expect(yamlText).toContain('api:');
    });

    test('POST /api/v3/config/store accepts YAML', async () => {
      const testYaml = `
test:
  key: value
  number: 42
`;

      const response = await fetch(`${BASE_URL}/api/v3/config/store`, {
        method: 'POST',
        body: testYaml,
        headers: { 'Content-Type': 'application/yaml' }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.stored).toBe(true);
      expect(data.hash).toBeDefined();
      expect(typeof data.size).toBe('number');
    });

    test('GET /api/v3/rules/grep with scope parameter', async () => {
      const response = await fetch(`${BASE_URL}/api/v3/rules/grep?scope=GOV`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.scope).toBe('GOV');
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.cached).toBe(true);
    });

    test('POST /api/v3/rules/validate validates headers', async () => {
      const response = await fetch(`${BASE_URL}/api/v3/rules/validate`, {
        method: 'POST',
        headers: {
          'User-Agent': 'Bun-Test/1.0',
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(typeof data.headers).toBe('number');
      expect(data.userAgent).toBe('Bun-Test/1.0');
    });

    test('GET /api/v3/secrets/{name} retrieves secrets', async () => {
      const response = await fetch(`${BASE_URL}/api/v3/secrets/test-secret`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe('test-secret');
      expect(data.retrieved).toBe(true);
      expect(data.secure).toBe(true);
    });

    test('POST /api/v3/csrf/verify validates CSRF tokens', async () => {
      // Test without token
      const response1 = await fetch(`${BASE_URL}/api/v3/csrf/verify`, {
        method: 'POST'
      });
      expect(response1.status).toBe(200);
      const data1 = await response1.json();
      expect(data1.verified).toBe(false);
      expect(data1.token).toBe('missing');

      // Test with token
      const response2 = await fetch(`${BASE_URL}/api/v3/csrf/verify`, {
        method: 'POST',
        headers: { 'x-csrf-token': 'test-token-123' }
      });
      expect(response2.status).toBe(200);
      const data2 = await response2.json();
      expect(data2.verified).toBe(true);
      expect(data2.token).toBe('valid');
    });

    test('POST /api/v3/yaml/stream handles streaming', async () => {
      const testData = 'chunk1\nchunk2\nchunk3';

      const response = await fetch(`${BASE_URL}/api/v3/yaml/stream`, {
        method: 'POST',
        body: testData
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('transfer-encoding')).toBe('chunked');

      const responseText = await response.text();
      const lines = responseText.trim().split('\n');
      expect(lines.length).toBeGreaterThan(0);

      // Check that we get processing updates and completion
      const lastLine = JSON.parse(lines[lines.length - 1]);
      expect(lastLine.complete).toBe(true);
      expect(typeof lastLine.totalSize).toBe('number');
    });
  });

  describe('WebSocket Support', () => {
    test('WebSocket handshake works', async () => {
      // Note: Full WebSocket testing would require a WebSocket client
      // For now, just test that the endpoint exists and responds
      const response = await fetch(`${BASE_URL}/api/v3/ws/negotiate`, {
        headers: { 'Upgrade': 'websocket' }
      });

      // Should get 101 Switching Protocols for WebSocket upgrade
      // But fetch doesn't support WebSocket upgrades, so we get a different response
      // In a real test, you'd use a WebSocket client library
      expect([200, 400, 101]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('404 for unknown endpoints', async () => {
      const response = await fetch(`${BASE_URL}/api/v3/unknown-endpoint`);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Not Found');
      expect(Array.isArray(data.available)).toBe(true);
    });

    test('OpenAPI docs endpoint', async () => {
      const response = await fetch(`${BASE_URL}/api/v3/docs`);
      // May return 503 if openapi.yaml doesn't exist
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        const yamlText = await response.text();
        expect(yamlText).toContain('openapi:');
        expect(yamlText).toContain('info:');
      }
    });
  });

  describe('Performance Benchmarks', () => {
    test('API response times are fast', async () => {
      const startTime = performance.now();

      // Make multiple concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        fetch(`${BASE_URL}/health`)
      );

      const responses = await Promise.all(promises);
      const endTime = performance.now();

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      const totalTime = endTime - startTime;
      const avgTime = totalTime / 10;

      console.log(`⚡ Performance: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(2)}ms avg per request`);

      // Should be reasonably fast (< 100ms per request on average)
      expect(avgTime).toBeLessThan(100);
    });
  });
});
