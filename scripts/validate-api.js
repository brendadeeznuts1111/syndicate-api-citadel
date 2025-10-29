// scripts/validate-api.js - OpenAPI validation script

import { file } from 'bun';
import YAML from 'yaml';

async function validateOpenAPI() {
  try {
    // Check if openapi.yaml exists
    const openapiText = await file('openapi.yaml').text();
    const spec = YAML.parse(openapiText);

    console.log('🔍 Validating OpenAPI v3.1 spec...');

    // Basic validation checks
    const errors = [];

    // Check required fields
    if (!spec.openapi) errors.push('Missing openapi version');
    if (!spec.info) errors.push('Missing info section');
    if (!spec.info.title) errors.push('Missing info.title');
    if (!spec.info.version) errors.push('Missing info.version');
    if (!spec.paths) errors.push('Missing paths section');

    // Check paths are not empty
    const pathCount = Object.keys(spec.paths || {}).length;
    if (pathCount === 0) errors.push('No paths defined');

    // Check each path has valid operations
    for (const [path, operations] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(operations)) {
        if (!operation.summary && !operation.description) {
          errors.push(`Path ${path} ${method} missing summary/description`);
        }
        if (!operation.responses) {
          errors.push(`Path ${path} ${method} missing responses`);
        }
      }
    }

    // Check security schemes if security is defined
    if (spec.security && spec.security.length > 0) {
      if (!spec.components?.securitySchemes) {
        errors.push('Security defined but no securitySchemes in components');
      }
    }

    if (errors.length === 0) {
      console.log(`✅ OpenAPI validation passed!`);
      console.log(`📊 Stats: ${pathCount} paths, ${spec.tags?.length || 0} tags`);
      console.log(`🔐 Security: ${spec.security?.length || 0} global schemes`);
      console.log(`📝 Components: ${Object.keys(spec.components?.schemas || {}).length} schemas`);
      process.exit(0);
    } else {
      console.error('❌ OpenAPI validation failed:');
      errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Validation error:', error.message);
    process.exit(1);
  }
}

if (import.meta.main) {
  await validateOpenAPI();
}
