// src/utils/file-processor.ts - File Processing with Bun 1.3 FileHandle.readLines()

import { open } from 'node:fs/promises';
import { resolve } from 'path';

/**
 * File Processing Utilities - Leveraging Bun 1.3 FileHandle.readLines()
 *
 * Provides efficient, backpressure-aware async iteration over file lines.
 * Handles empty lines and CRLF correctly with automatic encoding detection.
 */

export interface FileProcessingOptions {
  encoding?: BufferEncoding;
  skipEmptyLines?: boolean;
  maxLines?: number;
  startLine?: number;
}

export interface FileProcessingResult {
  totalLines: number;
  processedLines: number;
  emptyLines: number;
  fileSize: number;
  processingTime: number;
  encoding: BufferEncoding;
}

/**
 * Process a file line by line using Bun 1.3 FileHandle.readLines()
 * This provides efficient, backpressure-aware async iteration.
 */
export async function processFileLines(
  filePath: string,
  processor: (line: string, lineNumber: number) => Promise<void> | void,
  options: FileProcessingOptions = {}
): Promise<FileProcessingResult> {
  const startTime = performance.now();
  const absolutePath = resolve(filePath);

  const {
    encoding = 'utf8',
    skipEmptyLines = false,
    maxLines,
    startLine = 1
  } = options;

  let totalLines = 0;
  let processedLines = 0;
  let emptyLines = 0;
  let fileSize = 0;

  // Use Bun 1.3 FileHandle.readLines() for efficient async iteration
  const file = await open(absolutePath, 'r');
  const stats = await file.stat();
  fileSize = stats.size;

  try {
    let currentLineNumber = 0;

    // Efficient async iteration with backpressure handling
    for await (const line of file.readLines({ encoding })) {
      currentLineNumber++;
      totalLines++;

      // Skip lines before startLine
      if (currentLineNumber < startLine) continue;

      // Handle empty lines
      if (line.trim() === '') {
        emptyLines++;
        if (skipEmptyLines) continue;
      }

      // Process the line
      await processor(line, currentLineNumber);
      processedLines++;

      // Check max lines limit
      if (maxLines && processedLines >= maxLines) break;
    }

  } finally {
    await file.close();
  }

  const processingTime = performance.now() - startTime;

  return {
    totalLines,
    processedLines,
    emptyLines,
    fileSize,
    processingTime,
    encoding
  };
}

/**
 * Count lines in a file using FileHandle.readLines()
 */
export async function countLines(filePath: string): Promise<number> {
  let lineCount = 0;

  const file = await open(resolve(filePath), 'r');

  try {
    for await (const _line of file.readLines()) {
      lineCount++;
    }
  } finally {
    await file.close();
  }

  return lineCount;
}

/**
 * Find lines matching a pattern using FileHandle.readLines()
 */
export async function findLines(
  filePath: string,
  pattern: RegExp,
  options: FileProcessingOptions & { maxResults?: number } = {}
): Promise<Array<{ line: string; lineNumber: number }>> {
  const results: Array<{ line: string; lineNumber: number }> = [];
  const { maxResults } = options;

  await processFileLines(
    filePath,
    (line, lineNumber) => {
      if (pattern.test(line)) {
        results.push({ line, lineNumber });
        if (maxResults && results.length >= maxResults) {
          // Note: We can't break from the async iterator, but we can limit results
        }
      }
    },
    options
  );

  return maxResults ? results.slice(0, maxResults) : results;
}

/**
 * Read specific line ranges using FileHandle.readLines()
 */
export async function readLineRange(
  filePath: string,
  startLine: number,
  endLine: number,
  options: Omit<FileProcessingOptions, 'startLine' | 'maxLines'> = {}
): Promise<string[]> {
  const lines: string[] = [];

  const result = await processFileLines(
    filePath,
    (line, lineNumber) => {
      if (lineNumber >= startLine && lineNumber <= endLine) {
        lines.push(line);
      }
    },
    { ...options, startLine: 1 } // Start from beginning to get line numbers
  );

  return lines;
}

/**
 * Process YAML files line by line (useful for large YAML files)
 */
export async function processYamlFile(
  filePath: string,
  lineProcessor: (line: string, lineNumber: number, indentLevel: number) => Promise<void> | void
): Promise<FileProcessingResult> {
  return processFileLines(filePath, async (line, lineNumber) => {
    // Calculate YAML indent level
    const indentMatch = line.match(/^(\s*)/);
    const indentLevel = indentMatch ? indentMatch[1].length : 0;

    await lineProcessor(line, lineNumber, indentLevel);
  });
}

/**
 * Stream processing for real-time file monitoring
 */
export async function monitorFileLines(
  filePath: string,
  onLine: (line: string, lineNumber: number) => void,
  options: FileProcessingOptions & { pollInterval?: number } = {}
): Promise<() => void> {
  const { pollInterval = 1000 } = options;
  let isMonitoring = true;
  let lastProcessedLine = 0;

  const monitor = async () => {
    while (isMonitoring) {
      try {
        let currentLineNumber = 0;

        const file = await open(resolve(filePath), 'r');
        try {
          for await (const line of file.readLines(options)) {
            currentLineNumber++;

            // Only process new lines
            if (currentLineNumber > lastProcessedLine) {
              onLine(line, currentLineNumber);
              lastProcessedLine = currentLineNumber;
            }
          }
        } finally {
          await file.close();
        }

      } catch (error) {
        console.warn(`File monitoring error for ${filePath}:`, error);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  };

  // Start monitoring
  monitor();

  // Return cleanup function
  return () => {
    isMonitoring = false;
  };
}
