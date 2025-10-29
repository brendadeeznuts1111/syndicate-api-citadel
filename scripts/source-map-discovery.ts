// scripts/source-map-discovery.ts - Source Map Discovery for Enhanced Debugging

// This script demonstrates how source maps could be used to enhance error reporting
// by mapping generated code back to original source files.

import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// =============================================================================
// 🔍 SOURCE MAP DISCOVERY
// =============================================================================

interface SourceMapInfo {
  file: string;
  sources: string[];
  mappings?: string;
  version: number;
}

async function discoverSourceMaps(dir: string, results: SourceMapInfo[] = []): Promise<SourceMapInfo[]> {
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively search subdirectories
      await discoverSourceMaps(fullPath, results);
    } else if (item.endsWith('.map')) {
      // Found a source map file
      try {
        const content = await Bun.file(fullPath).text();
        const mapData = JSON.parse(content);

        results.push({
          file: fullPath,
          sources: mapData.sources || [],
          mappings: mapData.mappings,
          version: mapData.version || 3
        });

        console.log(`📍 Found source map: ${fullPath}`);
        console.log(`   Sources: ${mapData.sources?.length || 0}`);
        console.log(`   Version: ${mapData.version || 3}`);

      } catch (e) {
        console.warn(`⚠️  Failed to parse source map: ${fullPath}`, e.message);
      }
    }
  }

  return results;
}

// =============================================================================
// 🔧 ERROR ENHANCEMENT UTILITIES
// =============================================================================

function enhanceStackTrace(stackTrace: string, sourceMaps: SourceMapInfo[]): string {
  // This is a simplified example. A real implementation would:
  // 1. Parse the stack trace
  // 2. Find corresponding source map for each frame
  // 3. Map generated positions back to original positions
  // 4. Return enhanced stack trace with original file/line info

  let enhanced = stackTrace;

  // Example enhancement (placeholder)
  enhanced = enhanced.replace(
    /(src\/generated\/api-server-config\.ts):(\d+):(\d+)/g,
    (match, file, line, col) => {
      // In a real implementation, this would look up the source map
      // and return the original file/line/column
      return `${file} (original: bun.yaml:${line}:${col})`;
    }
  );

  return enhanced;
}

// =============================================================================
// 🚀 MAIN DISCOVERY PROCESS
// =============================================================================

async function main() {
  console.log('🔍 Source Map Discovery Tool');
  console.log('============================\n');

  // Discover source maps in the project
  const sourceMaps = await discoverSourceMaps('.');

  if (sourceMaps.length === 0) {
    console.log('❌ No source maps found in the project');
    console.log('💡 Generate source maps with: bun build --sourcemap');
    return;
  }

  console.log(`\n📊 Found ${sourceMaps.length} source map(s)\n`);

  // Show source map details
  sourceMaps.forEach((map, index) => {
    console.log(`${index + 1}. ${map.file}`);
    console.log(`   Original sources: ${map.sources.length}`);
    map.sources.slice(0, 5).forEach(source => {
      console.log(`     - ${source}`);
    });
    if (map.sources.length > 5) {
      console.log(`     ... and ${map.sources.length - 5} more`);
    }
    console.log('');
  });

  // Example error enhancement
  console.log('🔧 Error Enhancement Example');
  console.log('=============================\n');

  const exampleError = `Error: Validation failed
    at validateHeaders (src/generated/api-server-config.ts:45:12)
    at processRequest (src/generated/api-server-config.ts:78:23)
    at handleRequest (src/api/gateway.ts:67:15)`;

  console.log('Original stack trace:');
  console.log(exampleError);
  console.log('');

  const enhanced = enhanceStackTrace(exampleError, sourceMaps);
  console.log('Enhanced stack trace:');
  console.log(enhanced);
  console.log('');

  console.log('💡 This tool helps debug by mapping generated code back to source files');
  console.log('💡 In production, use source maps for better error reporting');
}

// =============================================================================
// 🚀 CLI ENTRY POINT
// =============================================================================

if (import.meta.main) {
  main().catch(console.error);
}
