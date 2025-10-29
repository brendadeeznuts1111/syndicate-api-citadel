// src/workers/handlers/grep.ts - Grep search endpoint for Cloudflare Workers

export interface Env {
  NODE_ENV: string;
  API_VERSION: string;
}

// Mock rule data (in production, this might come from KV or D1)
const mockRules = [
  {
    id: "GOV-001",
    tag: "[GOV-HEADER-001]",
    description: "Government header validation rule",
    scope: "GOV",
    type: "REQUIRED",
    priority: "CRITICAL",
    status: "ACTIVE"
  },
  {
    id: "SEC-001",
    tag: "[SEC-LEAK-001]",
    description: "Security leak prevention rule",
    scope: "SEC",
    type: "REQUIRED",
    priority: "CRITICAL",
    status: "ACTIVE"
  },
  {
    id: "DEV-001",
    tag: "[DEV-TESTING-001]",
    description: "Development testing rule",
    scope: "DEV",
    type: "OPTIONAL",
    priority: "MEDIUM",
    status: "ACTIVE"
  }
];

export async function handleGrepSearch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const scope = url.searchParams.get('scope') || 'ALL';
  const limit = parseInt(url.searchParams.get('limit') || '50');

  console.log(`Grep search: query="${query}", scope="${scope}", limit=${limit}`);

  // Filter rules based on query and scope
  let results = mockRules;

  // Apply scope filter
  if (scope !== 'ALL') {
    results = results.filter(rule => rule.scope === scope);
  }

  // Apply text search
  if (query) {
    const searchTerm = query.toLowerCase();
    results = results.filter(rule =>
      rule.description.toLowerCase().includes(searchTerm) ||
      rule.tag.toLowerCase().includes(searchTerm) ||
      rule.id.toLowerCase().includes(searchTerm)
    );
  }

  // Apply limit
  const limitedResults = results.slice(0, limit);

  const response = {
    query,
    scope,
    results: limitedResults,
    total: results.length,
    returned: limitedResults.length,
    cached: true, // In CF Workers, we might use KV for caching
    timestamp: new Date().toISOString(),
    execution_time: "fast", // CF Workers are generally fast
    platform: "cloudflare-workers"
  };

  return new Response(JSON.stringify(response, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60', // Cache for 1 minute
      'X-Query-Count': limitedResults.length.toString(),
      'X-Total-Count': results.length.toString()
    }
  });
}
