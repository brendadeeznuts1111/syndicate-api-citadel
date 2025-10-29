#!/usr/bin/env bun

/**
 * scripts/build-routes-index.ts - Ripgrep Route Index Builder
 *
 * Builds .routes.index for instant handler lookups using ripgrep.
 * Enables sub-millisecond route discovery and grep-first development.
 *
 * Usage:
 *   bun run scripts/build-routes-index.ts
 *   bun run scripts/build-routes-index.ts --watch
 */

import { $ } from 'bun';
import { file } from 'bun';
import { watch } from 'fs';

interface RouteIndex {
  timestamp: string;
  totalFiles: number;
  totalHandlers: number;
  index: Array<{
    file: string;
    exports: string[];
    path: string;
  }>;
}

// Build routes index using ripgrep
async function buildRoutesIndex(): Promise<void> {
  console.log('🔍 Building routes index with ripgrep...');

  try {
    // Use ripgrep to find all handler files and their exports
    const rgCommand = `rg --files-with-matches "export (const|function|async function)" src/ --type ts`;

    const result = await $`${{ raw: rgCommand }}`.text();
    const handlerFiles = result.trim().split('\n').filter(Boolean);

    console.log(`📁 Found ${handlerFiles.length} handler files`);

    const index: RouteIndex['index'] = [];

    // Analyze each handler file
    for (const filePath of handlerFiles) {
      try {
        const content = await file(filePath).text();

        // Extract exports
        const exportMatches = content.matchAll(/export\s+(?:const|function|async function)\s+(\w+)/g);
        const exports = Array.from(exportMatches, match => match[1]);

        if (exports.length > 0) {
          index.push({
            file: filePath,
            exports,
            path: filePath.replace('src/', '').replace('.ts', '')
          });
        }
      } catch (error) {
        console.warn(`⚠️  Failed to analyze ${filePath}:`, error);
      }
    }

    // Create index object
    const routesIndex: RouteIndex = {
      timestamp: new Date().toISOString(),
      totalFiles: handlerFiles.length,
      totalHandlers: index.reduce((sum, item) => sum + item.exports.length, 0),
      index
    };

    // Save index
    await file('.routes.index').write(JSON.stringify(routesIndex, null, 2));

    console.log(`✅ Routes index built: ${routesIndex.totalHandlers} handlers in ${routesIndex.totalFiles} files`);
    console.log(`📄 Saved to .routes.index`);

  } catch (error) {
    console.error('❌ Failed to build routes index:', error);
    process.exit(1);
  }
}

// Watch mode for automatic index rebuilding
function watchMode(): void {
  console.log('👀 Watch mode enabled - monitoring src/ for changes...');

  let rebuildTimeout: NodeJS.Timeout | null = null;

  const watcher = watch('src/', { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
      // Debounce rebuilds
      if (rebuildTimeout) clearTimeout(rebuildTimeout);

      rebuildTimeout = setTimeout(() => {
        console.log(`🔄 File changed: ${filename} - rebuilding index...`);
        buildRoutesIndex().catch(console.error);
      }, 500);
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping watch mode...');
    watcher.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Stopping watch mode...');
    watcher.close();
    process.exit(0);
  });
}

// CLI interface
function printUsage(): void {
  console.log(`
Routes Index Builder v1.0.0
==========================

Builds .routes.index for instant handler lookups using ripgrep.

USAGE:
  bun run scripts/build-routes-index.ts [options]

OPTIONS:
  --watch, -w    Watch mode - automatically rebuild on file changes
  --help, -h     Show this help message

FEATURES:
  • Ripgrep-powered handler discovery
  • Export analysis for each file
  • JSON index for fast lookups
  • Watch mode for development

EXAMPLES:
  bun run scripts/build-routes-index.ts
  bun run scripts/build-routes-index.ts --watch
`);
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  if (args.includes('--watch') || args.includes('-w')) {
    await buildRoutesIndex(); // Initial build
    watchMode(); // Start watching
  } else {
    await buildRoutesIndex();
  }
}

// Run the builder
if (import.meta.main) {
  main().catch(error => {
    console.error('💥 Routes index build failed:', error);
    process.exit(1);
  });
}
