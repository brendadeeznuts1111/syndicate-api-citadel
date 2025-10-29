// src/workers/utils/cors.ts - CORS utilities for Cloudflare Workers

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-CSRF-Token',
  'Access-Control-Max-Age': '86400',
};

export function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);

  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
