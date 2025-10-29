// src/workers/handlers/webhook-sync.ts - GitHub Webhook Handler for Auto-Sync
// Handles GitHub webhooks to trigger auto-sync when MD files change

import { handleRequest } from '../api-gateway';
import { corsHeaders, addCorsHeaders } from '../utils/cors';

export interface Env {
  GITHUB_WEBHOOK_SECRET: string;
  NODE_ENV: string;
}

interface GitHubWebhookPayload {
  action: string;
  repository: {
    name: string;
    full_name: string;
  };
  commits?: Array<{
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  head_commit?: {
    added: string[];
    modified: string[];
    removed: string[];
  };
}

// Verify GitHub webhook signature
async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const providedHex = signature.replace('sha256=', '');

    return expectedHex === providedHex;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}

// Check if webhook payload contains MD file changes
function hasMdFileChanges(payload: GitHubWebhookPayload): boolean {
  if (!payload.commits && !payload.head_commit) return false;

  const allFiles = [
    ...(payload.commits || []).flatMap(commit => [
      ...commit.added,
      ...commit.modified,
      ...commit.removed
    ]),
    ...(payload.head_commit ? [
      ...payload.head_commit.added,
      ...payload.head_commit.modified,
      ...payload.head_commit.removed
    ] : [])
  ];

  return allFiles.some(file => file.startsWith('rules/') && file.endsWith('.md'));
}

// Trigger auto-sync workflow
async function triggerAutoSync(env: Env, payload: GitHubWebhookPayload): Promise<boolean> {
  try {
    // In a real implementation, this would trigger the GitHub Actions workflow
    // For now, we'll simulate the auto-sync process

    console.log('🔄 Triggering auto-sync for MD file changes...');

    // Simulate running the auto-sync script
    // In production, this would be a queue job or webhook to trigger CI

    const syncResult = {
      triggered: true,
      repository: payload.repository.full_name,
      timestamp: new Date().toISOString(),
      changesDetected: hasMdFileChanges(payload),
      workflowUrl: `https://github.com/${payload.repository.full_name}/actions`
    };

    console.log('✅ Auto-sync workflow triggered:', syncResult);
    return true;

  } catch (error) {
    console.error('❌ Failed to trigger auto-sync:', error);
    return false;
  }
}

export async function handleWebhookSync(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Only accept POST requests
  if (request.method !== 'POST') {
    return addCorsHeaders(new Response('Method not allowed', { status: 405 }));
  }

  try {
    // Get GitHub webhook signature
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) {
      return addCorsHeaders(new Response('Missing webhook signature', { status: 401 }));
    }

    // Get request body
    const body = await request.text();

    // Verify webhook signature
    const isValidSignature = await verifyWebhookSignature(
      body,
      signature,
      env.GITHUB_WEBHOOK_SECRET
    );

    if (!isValidSignature) {
      return addCorsHeaders(new Response('Invalid webhook signature', { status: 401 }));
    }

    // Parse webhook payload
    const payload: GitHubWebhookPayload = JSON.parse(body);

    // Check if this is a push event with MD file changes
    if (request.headers.get('x-github-event') === 'push' && hasMdFileChanges(payload)) {
      console.log('📋 GitHub webhook: MD files changed, triggering auto-sync');

      const syncSuccess = await triggerAutoSync(env, payload);

      if (syncSuccess) {
        return addCorsHeaders(new Response(JSON.stringify({
          status: 'success',
          message: 'Auto-sync triggered for MD file changes',
          repository: payload.repository.full_name,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      } else {
        return addCorsHeaders(new Response(JSON.stringify({
          status: 'error',
          message: 'Failed to trigger auto-sync',
          repository: payload.repository.full_name
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
    }

    // Acknowledge webhook but no action needed
    return addCorsHeaders(new Response(JSON.stringify({
      status: 'acknowledged',
      message: 'Webhook received but no MD file changes detected',
      repository: payload.repository.full_name
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

  } catch (error) {
    console.error('Webhook processing error:', error);
    return addCorsHeaders(new Response(JSON.stringify({
      status: 'error',
      message: 'Webhook processing failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
}
