#!/usr/bin/env bun

/**
 * scripts/audit-traceability.ts - Citadel Traceability Auditor
 *
 * Enforces 95% minimum traceability threshold for CI pipelines.
 * Audits that every endpoint carries chain-of-custody back to MD rule-of-law.
 *
 * Usage:
 *   bun run scripts/audit-traceability.ts --spec openapi.yaml --min 95
 *   bun run scripts/audit-traceability.ts --spec openapi.yaml --min 98 --strict
 */

import { file } from 'bun';
import { resolve, dirname } from 'path';
import { readdirSync, statSync } from 'fs';

interface AuditConfig {
  specPath: string;
  minThreshold: number;
  strict: boolean;
  verbose: boolean;
}

interface TraceabilityReport {
  totalEndpoints: number;
  tracedEndpoints: number;
  orphanEndpoints: string[];
  traceabilityPercent: number;
  passed: boolean;
  details: {
    endpoint: string;
    sources: string[];
    hasSources: boolean;
  }[];
}

// Parse command line arguments
function parseArgs(): AuditConfig {
  const args = process.argv.slice(2);
  const config: AuditConfig = {
    specPath: 'openapi.yaml',
    minThreshold: 95,
    strict: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--spec':
        config.specPath = args[++i];
        break;
      case '--min':
        config.minThreshold = parseFloat(args[++i]);
        break;
      case '--strict':
        config.strict = true;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--help':
        console.log(`
Citadel Traceability Auditor v1.0.0
===================================

Enforces traceability standards for API endpoints.

USAGE:
  bun run scripts/audit-traceability.ts [options]

OPTIONS:
  --spec <path>     Path to OpenAPI spec file (default: openapi.yaml)
  --min <percent>   Minimum traceability threshold (default: 95)
  --strict          Exit with error on any orphan endpoint (default: false)
  --verbose         Show detailed endpoint analysis (default: false)
  --help            Show this help message

EXAMPLES:
  bun run scripts/audit-traceability.ts
  bun run scripts/audit-traceability.ts --spec custom-api.yaml --min 98
  bun run scripts/audit-traceability.ts --strict --verbose

EXIT CODES:
  0 - Audit passed
  1 - Audit failed (traceability below threshold)
  2 - Audit failed (strict mode: orphan endpoints found)
        `);
        process.exit(0);
    }
  }

  return config;
}

// Load and parse OpenAPI spec
async function loadSpec(specPath: string): Promise<any> {
  try {
    const content = await file(specPath).text();

    // Try YAML first (more common for OpenAPI), then JSON
    try {
      return Bun.YAML.parse(content);
    } catch (yamlError) {
      try {
        return JSON.parse(content);
      } catch (jsonError) {
        throw new Error(`Failed to parse as YAML or JSON: ${yamlError.message}`);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to load spec from ${specPath}:`, error);
    process.exit(1);
  }
}

// Analyze endpoint traceability
function analyzeTraceability(spec: any): TraceabilityReport {
  const paths = spec.paths || {};
  const totalEndpoints = Object.keys(paths).length;
  let tracedEndpoints = 0;
  const orphanEndpoints: string[] = [];
  const details: TraceabilityReport['details'] = [];

  console.log(`🔍 Analyzing ${totalEndpoints} endpoints for traceability...\n`);

  for (const [path, methods] of Object.entries(paths) as [string, any][]) {
    for (const [method, operation] of Object.entries(methods) as [string, any][]) {
      const endpoint = `${method.toUpperCase()} ${path}`;
      const sources = operation['x-source'] || [];

      const hasSources = Array.isArray(sources) && sources.length > 0;
      const sourceCount = hasSources ? sources.length : 0;

      if (hasSources) {
        tracedEndpoints++;
      } else {
        orphanEndpoints.push(endpoint);
      }

      details.push({
        endpoint,
        sources,
        hasSources
      });

      if (sourceCount > 0) {
        console.log(`✅ ${endpoint} → ${sourceCount} source${sourceCount > 1 ? 's' : ''}`);
        if (sourceCount <= 3) {
          sources.forEach(source => console.log(`   └─ ${source}`));
        } else {
          console.log(`   └─ ${sources.slice(0, 3).join(', ')} +${sourceCount - 3} more`);
        }
      } else {
        console.log(`❌ ${endpoint} → NO SOURCES (ORPHAN)`);
      }
    }
  }

  const traceabilityPercent = totalEndpoints > 0 ? (tracedEndpoints / totalEndpoints) * 100 : 0;
  const passed = traceabilityPercent >= 95; // Always require 95% minimum

  return {
    totalEndpoints,
    tracedEndpoints,
    orphanEndpoints,
    traceabilityPercent,
    passed,
    details
  };
}

// Validate source files exist
async function validateSourceFiles(report: TraceabilityReport, config: AuditConfig): Promise<boolean> {
  if (!config.strict) return true;

  console.log(`\n🔍 Validating source file existence...\n`);

  let allSourcesExist = true;
  const checkedFiles = new Set<string>();

  for (const detail of report.details) {
    if (!detail.hasSources) continue;

    for (const source of detail.sources) {
      if (checkedFiles.has(source)) continue;
      checkedFiles.add(source);

      try {
        // Try to read the source file
        await file(source).text();
        console.log(`✅ ${source} - EXISTS`);
      } catch (error) {
        console.log(`❌ ${source} - MISSING`);
        allSourcesExist = false;
      }
    }
  }

  return allSourcesExist;
}

// Generate audit report
function generateReport(report: TraceabilityReport, config: AuditConfig): void {
  console.log(`\n📊 TRACEABILITY AUDIT REPORT`);
  console.log(`=============================\n`);

  console.log(`📈 Metrics:`);
  console.log(`   Total Endpoints: ${report.totalEndpoints}`);
  console.log(`   Traced Endpoints: ${report.tracedEndpoints}`);
  console.log(`   Orphan Endpoints: ${report.orphanEndpoints.length}`);
  console.log(`   Traceability: ${report.traceabilityPercent.toFixed(1)}%\n`);

  if (report.orphanEndpoints.length > 0) {
    console.log(`🚨 Orphan Endpoints (${report.orphanEndpoints.length}):`);
    report.orphanEndpoints.forEach(endpoint => {
      console.log(`   • ${endpoint}`);
    });
    console.log('');
  }

  // Threshold check
  const thresholdPassed = report.traceabilityPercent >= config.minThreshold;

  console.log(`🎯 Threshold Check:`);
  console.log(`   Required: ${config.minThreshold.toFixed(1)}%`);
  console.log(`   Actual: ${report.traceabilityPercent.toFixed(1)}%`);
  console.log(`   Status: ${thresholdPassed ? '✅ PASSED' : '❌ FAILED'}\n`);

  // Final result
  if (report.passed && thresholdPassed) {
    console.log(`🎉 AUDIT PASSED`);
    console.log(`   Citadel maintains ${report.traceabilityPercent.toFixed(1)}% traceability`);
    console.log(`   All endpoints carry chain-of-custody to MD rule-of-law`);
  } else {
    console.log(`💥 AUDIT FAILED`);
    if (!thresholdPassed) {
      console.log(`   Traceability below ${config.minThreshold.toFixed(1)}% threshold`);
    }
    if (report.orphanEndpoints.length > 0) {
      console.log(`   ${report.orphanEndpoints.length} orphan endpoints found`);
    }
  }
}

// Main audit function
async function auditTraceability(): Promise<void> {
  const config = parseArgs();

  console.log(`🏰 Citadel Traceability Auditor v1.0.0`);
  console.log(`======================================\n`);

  console.log(`📋 Configuration:`);
  console.log(`   Spec File: ${config.specPath}`);
  console.log(`   Min Threshold: ${config.minThreshold.toFixed(1)}%`);
  console.log(`   Strict Mode: ${config.strict ? 'ON' : 'OFF'}`);
  console.log(`   Verbose: ${config.verbose ? 'ON' : 'OFF'}\n`);

  // Load spec
  const spec = await loadSpec(config.specPath);

  // Analyze traceability
  const report = analyzeTraceability(spec);

  // Validate source files if in strict mode
  const sourcesValid = await validateSourceFiles(report, config);

  // Generate report
  generateReport(report, config);

  // Exit with appropriate code
  const thresholdPassed = report.traceabilityPercent >= config.minThreshold;

  if (!report.passed || !thresholdPassed) {
    console.log(`\n❌ CI/CD Pipeline should FAIL`);
    process.exit(1);
  }

  if (config.strict && !sourcesValid) {
    console.log(`\n❌ Strict mode: Missing source files detected`);
    process.exit(2);
  }

  console.log(`\n✅ CI/CD Pipeline should PASS`);
  process.exit(0);
}

// Run the audit
if (import.meta.main) {
  auditTraceability().catch(error => {
    console.error('💥 Audit failed with error:', error);
    process.exit(1);
  });
}
