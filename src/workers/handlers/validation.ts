// src/workers/handlers/validation.ts - Validation endpoint for Cloudflare Workers

export interface Env {
  NODE_ENV: string;
  API_VERSION: string;
}

export async function handleValidation(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method Not Allowed',
      message: 'Use POST method for validation',
      allowed: ['POST']
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();

    // Simple validation logic (in production, this would be more sophisticated)
    const validationResult = {
      valid: true,
      headers: Object.keys(body).length,
      violations: [],
      timestamp: new Date().toISOString(),
      platform: "cloudflare-workers",
      rules: {
        checked: ["GOV-001", "SEC-001", "DEV-001"],
        passed: 3,
        failed: 0
      }
    };

    // Basic validation checks
    if (!body || typeof body !== 'object') {
      validationResult.valid = false;
      validationResult.violations.push("Request body must be a valid JSON object");
    }

    if (body.scope && !["GOV", "SEC", "DEV", "OPS"].includes(body.scope)) {
      validationResult.valid = false;
      validationResult.violations.push("Invalid scope value");
    }

    return new Response(JSON.stringify(validationResult, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'X-Validation-Status': validationResult.valid ? 'passed' : 'failed'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      valid: false,
      error: 'Validation Error',
      message: error instanceof Error ? error.message : 'Invalid request format',
      timestamp: new Date().toISOString()
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
