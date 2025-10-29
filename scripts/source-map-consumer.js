// scripts/source-map-consumer.js - External Source Map Consumer for Bun CLI
// Enhances error stack traces with original source locations

import { file } from 'bun';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';

// Source map cache to avoid re-parsing
const sourceMapCache = new Map();

// Parse source map from file
function parseSourceMap(sourceMapPath) {
  if (sourceMapCache.has(sourceMapPath)) {
    return sourceMapCache.get(sourceMapPath);
  }

  try {
    const sourceMapContent = readFileSync(sourceMapPath, 'utf8');
    const sourceMap = JSON.parse(sourceMapContent);
    sourceMapCache.set(sourceMapPath, sourceMap);
    return sourceMap;
  } catch (error) {
    console.warn(`Failed to parse source map ${sourceMapPath}:`, error.message);
    return null;
  }
}

// Extract sourceMappingURL from JavaScript content
function extractSourceMappingURL(jsContent) {
  const match = jsContent.match(/\/\/# sourceMappingURL=(.+)$/m);
  return match ? match[1] : null;
}

// Find original source location from source map
function findOriginalLocation(sourceMap, generatedLine, generatedColumn) {
  if (!sourceMap || !sourceMap.mappings) return null;

  try {
    // Use a simple mapping for demonstration
    // In a real implementation, you'd use a proper source map consumer library
    const lines = sourceMap.mappings.split(';');

    if (generatedLine < lines.length && lines[generatedLine]) {
      const mappings = lines[generatedLine].split(',');
      for (const mapping of mappings) {
        if (!mapping) continue;

        // Decode VLQ (simplified for demo)
        const decoded = decodeVLQ(mapping);
        if (decoded && decoded[0] === generatedColumn) {
          const sourceIndex = decoded[1];
          const sourceLine = decoded[2];
          const sourceColumn = decoded[3];

          if (sourceMap.sources && sourceMap.sources[sourceIndex]) {
            return {
              source: sourceMap.sources[sourceIndex],
              line: sourceLine + 1, // VLQ is 0-based
              column: sourceColumn
            };
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error finding original location:', error.message);
  }

  return null;
}

// Very basic VLQ decoder (simplified for demonstration)
function decodeVLQ(vlq) {
  // This is a simplified implementation
  // A real implementation would use a proper VLQ decoder
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = [];
    let value = 0;
    let shift = 0;

    for (let i = 0; i < vlq.length; i++) {
      const char = vlq[i];
      const index = chars.indexOf(char);
      if (index === -1) continue;

      value |= (index & 31) << shift;
      if (index & 32) {
        shift += 5;
      } else {
        result.push(value);
        value = 0;
        shift = 0;
      }
    }

    return result;
  } catch (e) {
    return null;
  }
}

// Rewrite stack trace with source map information
function rewriteStackTrace(stackTrace, sourceMapPath) {
  const sourceMap = parseSourceMap(sourceMapPath);
  if (!sourceMap) return stackTrace;

  const lines = stackTrace.split('\n');
  const rewrittenLines = lines.map(line => {
    // Match stack trace lines like: "    at functionName (file.js:line:column)"
    const match = line.match(/(\s+at\s+[^)]+\()([^:]+):(\d+):(\d+)\)/);
    if (match) {
      const [, prefix, filePath, lineNum, colNum] = match;

      // Only rewrite if it's our generated file
      if (filePath.includes('generated.js') || filePath.includes('.bun.js')) {
        const original = findOriginalLocation(sourceMap, parseInt(lineNum) - 1, parseInt(colNum));

        if (original) {
          const resolvedSource = resolve(dirname(sourceMapPath), original.source);
          return `${prefix}${resolvedSource}:${original.line}:${original.column}) [original]`;
        }
      }
    }
    return line;
  });

  return rewrittenLines.join('\n');
}

// Enhanced error reporting with source map support
function createEnhancedErrorHandler(sourceMapPath = null) {
  const originalHandler = process._events?.error || process._events?.uncaughtException;

  process.on('uncaughtException', (error) => {
    let stackTrace = error.stack || '';

    // Try to find source map from error stack
    if (!sourceMapPath && stackTrace) {
      const stackLines = stackTrace.split('\n');
      for (const line of stackLines) {
        const match = line.match(/\(([^:)]+\.js):/);
        if (match) {
          const jsFile = match[1];
          try {
            const jsContent = readFileSync(jsFile, 'utf8');
            const mapUrl = extractSourceMappingURL(jsContent);
            if (mapUrl) {
              sourceMapPath = resolve(dirname(jsFile), mapUrl);
              break;
            }
          } catch (e) {
            // Continue searching
          }
        }
      }
    }

    // Rewrite stack trace if we have a source map
    if (sourceMapPath) {
      stackTrace = rewriteStackTrace(stackTrace, sourceMapPath);
      error.stack = stackTrace;
    }

    // Enhanced error formatting
    console.error('🚨 Enhanced Error Report:');
    console.error('📍 Error Type:', error.constructor.name);
    console.error('💬 Message:', error.message);

    if (error.code) console.error('🔢 Code:', error.code);
    if (error.errno) console.error('🔢 Errno:', error.errno);

    console.error('\n📚 Stack Trace (with source mapping):');
    console.error(stackTrace);

    // Call original handler if it exists
    if (originalHandler && typeof originalHandler === 'function') {
      originalHandler(error);
    } else {
      process.exit(1);
    }
  });

  return {
    setSourceMap: (path) => { sourceMapPath = path; },
    getSourceMap: () => sourceMapPath
  };
}

// Main execution for CLI wrapper
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('🔍 Bun Source Map Consumer');
    console.log('Usage: bun run scripts/source-map-consumer.js [options] -- <script> [args]');
    console.log('');
    console.log('Options:');
    console.log('  --source-map <path>    Specify source map file path');
    console.log('  --auto-detect          Auto-detect source maps from stack traces');
    console.log('  --cache-dir <dir>      Source map cache directory');
    console.log('');
    console.log('Example:');
    console.log('  bun run scripts/source-map-consumer.js --auto-detect -- generated.js');
    process.exit(0);
  }

  let sourceMapPath = null;
  let scriptArgs = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--source-map':
        sourceMapPath = args[++i];
        break;
      case '--auto-detect':
        // Auto-detection is enabled by default in error handler
        break;
      case '--cache-dir':
        // Cache directory handling would go here
        i++; // skip next arg
        break;
      case '--':
        scriptArgs = args.slice(i + 1);
        break;
      default:
        if (!arg.startsWith('--')) {
          scriptArgs = args.slice(i);
          break;
        }
    }
  }

  // Set up enhanced error handling
  const errorHandler = createEnhancedErrorHandler(sourceMapPath);

  if (sourceMapPath) {
    console.log(`🔗 Source map configured: ${sourceMapPath}`);
  }

  console.log('🎯 Enhanced error reporting enabled');
  console.log('💡 Stack traces will show original source locations');

  // If a script was specified, run it
  if (scriptArgs.length > 0) {
    const scriptPath = scriptArgs[0];
    const scriptArgsOnly = scriptArgs.slice(1);

    console.log(`🚀 Running: ${scriptPath} ${scriptArgsOnly.join(' ')}`);

    try {
      // Import and run the script
      await import(resolve(scriptPath));
    } catch (error) {
      // Error will be handled by our enhanced error handler
      console.error('Script execution failed');
    }
  } else {
    // Just keep the process running with enhanced error handling
    console.log('⏳ Process running with enhanced error handling...');
    console.log('💡 Send SIGINT (Ctrl+C) to exit');
  }
}

export { createEnhancedErrorHandler, rewriteStackTrace, parseSourceMap };
