#!/usr/bin/env bun

/**
 * scripts/auto-sync-registry.ts - Auto-Sync MD Changes → Re-Gen Spec → Push Registry
 *
 * Quantum-leap automation: Watch `rules/` directory for MD file changes, auto-regenerate
 * OpenAPI specs, and push updated registry to GitHub. Zero manual intervention required.
 *
 * Usage:
 *   bun run scripts/auto-sync-registry.ts --watch --push
 *   bun run scripts/auto-sync-registry.ts --dry-run
 *   bun run scripts/auto-sync-registry.ts --force
 */

import { file, YAML, $ } from 'bun';
import { watch, statSync, readdirSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { execSync, spawn } from 'child_process';

interface SyncConfig {
  watchMode: boolean;
  pushToRegistry: boolean;
  dryRun: boolean;
  force: boolean;
  registry: {
    type: 'github' | 'npm' | 'custom';
    repo: string;
    branch: string;
    token?: string;
  };
  debounceMs: number;
}

interface FileChange {
  path: string;
  type: 'add' | 'modify' | 'delete';
  timestamp: number;
  size: number;
}

// Parse command line arguments
function parseArgs(): SyncConfig {
  const args = process.argv.slice(2);
  const config: SyncConfig = {
    watchMode: false,
    pushToRegistry: false,
    dryRun: false,
    force: false,
    registry: {
      type: 'github',
      repo: process.env.GITHUB_REPOSITORY || 'brendadeeznuts1111/syndicate-api-citadel',
      branch: 'main',
      token: process.env.GITHUB_TOKEN
    },
    debounceMs: 1000
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--watch':
      case '-w':
        config.watchMode = true;
        break;
      case '--push':
      case '-p':
        config.pushToRegistry = true;
        break;
      case '--dry-run':
      case '-d':
        config.dryRun = true;
        break;
      case '--force':
      case '-f':
        config.force = true;
        break;
      case '--repo':
        config.registry.repo = args[++i];
        break;
      case '--branch':
        config.registry.branch = args[++i];
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }

  return config;
}

// Print usage information
function printUsage(): void {
  console.log(`
Auto-Sync Registry v1.0.0 - MD Changes → Spec Regen → Registry Push
=================================================================

Quantum automation: Watch rules/ directory, auto-regenerate OpenAPI specs,
and push updated registry. Zero manual intervention.

USAGE:
  bun run scripts/auto-sync-registry.ts [options]

OPTIONS:
  --watch, -w        Watch mode - continuously monitor for changes
  --push, -p         Push changes to registry after regeneration
  --dry-run, -d      Show what would be done without making changes
  --force, -f        Force regeneration even if no changes detected
  --repo <repo>      GitHub repository (default: from GITHUB_REPOSITORY)
  --branch <branch>  Target branch (default: main)
  --help, -h         Show this help message

ENVIRONMENT VARIABLES:
  GITHUB_TOKEN       Required for pushing to GitHub
  GITHUB_REPOSITORY  Repository name (owner/repo format)

EXAMPLES:
  bun run scripts/auto-sync-registry.ts --watch --push
  bun run scripts/auto-sync-registry.ts --dry-run
  bun run scripts/auto-sync-registry.ts --force --push
  bun run scripts/auto-sync-registry.ts --repo myorg/api-registry --branch develop

WATCH MODE FEATURES:
  • Debounced file change detection (1000ms default)
  • MD file modification tracking
  • Automatic spec regeneration
  • Registry push on successful validation
  • Git status monitoring
`);
}

// Track file changes with metadata
const fileStates = new Map<string, FileChange>();

// Get current state of MD files in rules directory
function getCurrentFileStates(): Map<string, FileChange> {
  const states = new Map<string, FileChange>();

  // Walk rules directory recursively
  function walkDir(dir: string): void {
    try {
      const items = readdirSync(dir);

      for (const item of items) {
        const fullPath = resolve(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile() && extname(fullPath).toLowerCase() === '.md') {
          states.set(fullPath, {
            path: fullPath,
            type: 'modify', // Will be determined by comparison
            timestamp: stat.mtime.getTime(),
            size: stat.size
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to scan directory ${dir}:`, error);
    }
  }

  walkDir('rules');
  return states;
}

// Detect file changes
function detectChanges(): FileChange[] {
  const currentStates = getCurrentFileStates();
  const changes: FileChange[] = [];

  // Check for modifications and deletions
  for (const [path, oldState] of fileStates) {
    const newState = currentStates.get(path);

    if (!newState) {
      // File deleted
      changes.push({
        ...oldState,
        type: 'delete'
      });
    } else if (newState.timestamp > oldState.timestamp || newState.size !== oldState.size) {
      // File modified
      changes.push({
        ...newState,
        type: 'modify'
      });
    }
  }

  // Check for additions
  for (const [path, newState] of currentStates) {
    if (!fileStates.has(path)) {
      changes.push({
        ...newState,
        type: 'add'
      });
    }
  }

  // Update tracked states
  fileStates.clear();
  for (const [path, state] of currentStates) {
    fileStates.set(path, state);
  }

  return changes;
}

// Regenerate OpenAPI spec
async function regenerateSpec(config: SyncConfig): Promise<boolean> {
  console.log('🔄 Regenerating OpenAPI specification...');

  try {
    if (config.dryRun) {
      console.log('📋 DRY RUN: Would execute: bun run api:gen');
      return true;
    }

    // Run OpenAPI generation
    const result = await $`bun run api:gen`;

    if (result.exitCode !== 0) {
      console.error('❌ OpenAPI generation failed');
      return false;
    }

    // Run validation
    const validateResult = await $`bun run audit:ci`;

    if (validateResult.exitCode !== 0) {
      console.error('❌ Specification validation failed');
      return false;
    }

    console.log('✅ OpenAPI specification regenerated and validated');
    return true;

  } catch (error) {
    console.error('💥 Spec regeneration failed:', error);
    return false;
  }
}

// Push changes to registry
async function pushToRegistry(config: SyncConfig): Promise<boolean> {
  console.log('📤 Pushing changes to registry...');

  try {
    if (config.dryRun) {
      console.log('📋 DRY RUN: Would execute: git add openapi.yaml && git commit -m "Auto-sync: Update OpenAPI spec" && git push');
      return true;
    }

    // Check git status
    const status = await $`git status --porcelain openapi.yaml`.text();

    if (!status.trim()) {
      console.log('📋 No changes to push');
      return true;
    }

    // Stage, commit, and push changes
    await $`git add openapi.yaml`;
    await $`git commit -m "🤖 Auto-sync: Update OpenAPI spec from MD changes

- Regenerated OpenAPI 3.1 specification
- Validated 100% traceability
- Source: MD rule file changes
- Timestamp: ${new Date().toISOString()}"`;

    await $`git push origin ${config.registry.branch}`;

    console.log('✅ Changes pushed to registry');
    return true;

  } catch (error) {
    console.error('💥 Registry push failed:', error);
    return false;
  }
}

// Handle file changes
let changeTimeout: NodeJS.Timeout | null = null;

function handleFileChanges(config: SyncConfig): void {
  const changes = detectChanges();

  if (changes.length === 0 && !config.force) {
    return;
  }

  console.log(`\n🔥 Detected ${changes.length} file change(s):`);
  changes.forEach(change => {
    console.log(`   ${change.type.toUpperCase()}: ${change.path}`);
  });

  // Debounce rapid changes
  if (changeTimeout) {
    clearTimeout(changeTimeout);
  }

  changeTimeout = setTimeout(async () => {
    console.log('\n🚀 Processing changes...');

    // Regenerate spec
    const specSuccess = await regenerateSpec(config);
    if (!specSuccess) {
      console.error('❌ Skipping registry push due to spec generation failure');
      return;
    }

    // Push to registry if requested
    if (config.pushToRegistry) {
      const pushSuccess = await pushToRegistry(config);
      if (pushSuccess) {
        console.log('🎉 Auto-sync cycle complete!');
      }
    } else {
      console.log('✅ Auto-sync cycle complete (no push requested)');
    }

  }, config.debounceMs);
}

// Watch mode implementation
function startWatchMode(config: SyncConfig): void {
  console.log('👀 Starting auto-sync watch mode...');
  console.log('📁 Monitoring: rules/ directory');
  console.log('🔄 Debounce: 1000ms');
  console.log('🎯 Push enabled:', config.pushToRegistry ? 'YES' : 'NO');
  console.log('📋 Dry run:', config.dryRun ? 'YES' : 'NO');
  console.log('');

  // Initialize file states
  fileStates.clear();
  const initialStates = getCurrentFileStates();
  for (const [path, state] of initialStates) {
    fileStates.set(path, state);
  }

  console.log(`📊 Initial state: ${fileStates.size} MD files tracked`);

  // Start file watcher
  const watcher = watch('rules/', { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.md')) {
      handleFileChanges(config);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping auto-sync watch mode...');
    watcher.close();
    if (changeTimeout) {
      clearTimeout(changeTimeout);
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping auto-sync watch mode...');
    watcher.close();
    if (changeTimeout) {
      clearTimeout(changeTimeout);
    }
    process.exit(0);
  });

  // Periodic status check
  setInterval(() => {
    const changes = detectChanges();
    if (changes.length > 0) {
      console.log(`📊 Status: ${fileStates.size} files tracked, ${changes.length} pending changes`);
    }
  }, 30000); // Every 30 seconds
}

// Main execution
async function main(): Promise<void> {
  const config = parseArgs();

  console.log('🤖 Auto-Sync Registry v1.0.0');
  console.log('============================');

  if (config.watchMode) {
    startWatchMode(config);
  } else {
    // One-time execution
    console.log('🎯 One-time sync execution');

    // Force regeneration if requested
    if (config.force) {
      console.log('💪 Force mode enabled');
    }

    // Initialize file states for change detection
    fileStates.clear();
    const initialStates = getCurrentFileStates();
    for (const [path, state] of initialStates) {
      fileStates.set(path, state);
    }

    handleFileChanges(config);
  }
}

// Run the auto-sync system
if (import.meta.main) {
  main().catch(error => {
    console.error('💥 Auto-sync failed:', error);
    process.exit(1);
  });
}
