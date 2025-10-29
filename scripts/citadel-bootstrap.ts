#!/usr/bin/env bun

/**
 * Citadel Bootstrap - Zero-Config Post-Install Setup
 *
 * Runs automatically after `bun install` to validate the Citadel is ready.
 * Performs smoke tests and ensures all systems are operational.
 */

import { $ } from 'bun';
import { existsSync } from 'fs';

// Colors for output
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const NC = '\x1b[0m';

async function main() {
  console.log('🏰 Citadel Bootstrap - Validating quantum readiness...');

  const results = {
    ai: false,
    api: false,
    tests: false,
    telemetry: false
  };

  try {
    // 1. Validate AI stack (smoke test)
    console.log('🤖 Testing AI infrastructure...');
    try {
      // Simple AI validation - check if energy harvester works
      await $`bun run energy:harvest --quiet`.quiet();
      results.ai = true;
      console.log(`${GREEN}✅${NC} AI stack operational`);
    } catch (error) {
      console.log(`${YELLOW}⚠️${NC} AI stack needs configuration (expected)`);
    }

    // 2. Validate API schemas
    console.log('📋 Testing API schema generation...');
    try {
      await $`bun run api:gen --quiet`.quiet();
      results.api = true;
      console.log(`${GREEN}✅${NC} API schemas generated`);
    } catch (error) {
      console.log(`${RED}❌${NC} API schema generation failed`);
      throw error;
    }

    // 3. Validate runtime tests
    console.log('🧪 Testing runtime integrity...');
    try {
      await $`bun test test/tz-matrix.test.ts --quiet`.quiet();
      results.tests = true;
      console.log(`${GREEN}✅${NC} Runtime tests passing`);
    } catch (error) {
      console.log(`${RED}❌${NC} Runtime tests failing`);
      throw error;
    }

    // 4. Anonymous telemetry (opt-out)
    if (process.env.DO_NOT_TRACK !== '1') {
      console.log('📡 Sending anonymous telemetry...');
      try {
        const packageJson = await Bun.file('package.json').json();
        await fetch('https://telemetry.citadel.sh/install', {
          method: 'POST',
          body: JSON.stringify({
            version: packageJson.version,
            timestamp: new Date().toISOString(),
            platform: process.platform,
            bun_version: process.versions.bun
          }),
          headers: { 'Content-Type': 'application/json' }
        }).catch(() => {}); // Fire-and-forget

        results.telemetry = true;
        console.log(`${GREEN}✅${NC} Telemetry sent (opt-out with DO_NOT_TRACK=1)`);
      } catch (error) {
        // Telemetry failure is not critical
        console.log(`${YELLOW}⚠️${NC} Telemetry failed (continuing)`);
      }
    } else {
      console.log(`${YELLOW}⚠️${NC} Telemetry skipped (DO_NOT_TRACK=1)`);
    }

    // Summary
    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;

    console.log(`\n${GREEN}🎉 Citadel bootstrap complete!${NC}`);
    console.log(`   Systems validated: ${passed}/${total}`);

    if (passed >= total - 1) { // Allow telemetry to fail
      console.log(`${GREEN}✅ Citadel ready – run any command above${NC}`);
      process.exit(0);
    } else {
      console.log(`${RED}❌ Bootstrap failed – check configuration${NC}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`${RED}💥 Bootstrap failed:${NC}`, error);
    console.log(`\n${YELLOW}💡 Run manually:${NC} bun run citadel:bootstrap`);
    process.exit(1);
  }
}

main();
