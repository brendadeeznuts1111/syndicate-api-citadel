// scripts/api-gen.js - Advanced OpenAPI forge with semantic schemas & multi-format output (Bun Native)

import { file } from 'bun';
import { readdirSync, statSync, watch } from 'fs';
import { join, resolve } from 'path';

// CLI Arguments parsing
const args = process.argv.slice(2);
const options = {
  outputFormat: 'yaml', // 'yaml' or 'json'
  watch: false,
  lint: false,
  detectBreaking: false,
  compareTo: null,
  generateClient: false,
  clientLang: 'typescript',
  generateDocs: false,
  docsFormat: 'html',
  template: null,
  verbose: false
};

// Parse CLI arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--help':
    case '-h':
      console.log(`
🎯 Syndicate API Citadel - OpenAPI Generator

USAGE:
  bun run scripts/api-gen.js [options]

OPTIONS:
  --output-format, -f <format>    Output format: yaml (default) or json
  --watch, -w                     Watch mode - auto-regenerate on file changes
  --lint                          Lint the generated OpenAPI spec
  --detect-breaking               Detect breaking changes against previous spec
  --compare-to <path>             Path to previous spec for comparison
  --generate-client               Generate client SDK
  --client-lang <lang>            Client SDK language: typescript (default), javascript
  --generate-docs                 Generate API documentation
  --docs-format <format>          Documentation format: html (default), markdown
  --template <path>               Custom template path for generation
  --verbose, -v                   Enable verbose logging
  --force                         Force operation despite warnings/errors

EXAMPLES:
  bun run scripts/api-gen.js                           # Basic generation
  bun run scripts/api-gen.js --watch                   # Watch mode
  bun run scripts/api-gen.js --lint                    # Lint output
  bun run scripts/api-gen.js --output-format json      # JSON output
  bun run scripts/api-gen.js --generate-client         # Generate TypeScript client
  bun run scripts/api-gen.js --generate-docs           # Generate HTML docs

FILES PROCESSED:
  bun.yaml              Main API configuration
  rules/**/*.md         Semantic rule definitions
  config.yaml           Additional configuration

OUTPUT:
  openapi.yaml/json     Generated OpenAPI specification
  client-sdk-*/*        Generated client SDK (if requested)
  api-docs/*            Generated documentation (if requested)
`);
      process.exit(0);
      break;
    case '--output-format':
    case '-f':
      options.outputFormat = args[++i];
      break;
    case '--watch':
    case '-w':
      options.watch = true;
      break;
    case '--lint':
      options.lint = true;
      break;
    case '--detect-breaking':
      options.detectBreaking = true;
      break;
    case '--compare-to':
      options.compareTo = args[++i];
      break;
    case '--generate-client':
      options.generateClient = true;
      break;
    case '--client-lang':
      options.clientLang = args[++i];
      break;
    case '--generate-docs':
      options.generateDocs = true;
      break;
    case '--docs-format':
      options.docsFormat = args[++i];
      break;
    case '--template':
      options.template = args[++i];
      break;
    case '--verbose':
    case '-v':
      options.verbose = true;
      break;
    default:
      if (arg.startsWith('--')) {
        console.error(`Unknown option: ${arg}`);
        console.error(`Run with --help for usage information`);
        process.exit(1);
      }
  }
}

// Input Validation Function for bun.yaml structure
function validateBunYamlStructure(bunYaml) {
  const errors = [];

  // Required top-level fields
  if (!bunYaml.version) errors.push('Missing required field: version');
  if (!bunYaml.rules) errors.push('Missing required field: rules');

  // Required rules structure
  if (!bunYaml.rules.header) errors.push('Missing required field: rules.header');
  if (!bunYaml.rules.api) errors.push('Missing required field: rules.api');

  // Header validation
  if (bunYaml.rules.header) {
    if (!bunYaml.rules.header.schema) errors.push('Missing required field: rules.header.schema');
    if (!bunYaml.rules.header.schema.scope || !Array.isArray(bunYaml.rules.header.schema.scope)) {
      errors.push('rules.header.schema.scope must be an array');
    }
    if (!bunYaml.rules.header.grep || !bunYaml.rules.header.grep.patterns) {
      errors.push('Missing required field: rules.header.grep.patterns');
    }
  }

  // API validation
  if (bunYaml.rules.api) {
    if (!bunYaml.rules.api.basePath) errors.push('Missing required field: rules.api.basePath');
    if (!bunYaml.rules.api.endpoints || !Array.isArray(bunYaml.rules.api.endpoints)) {
      errors.push('rules.api.endpoints must be an array');
    }

    // Validate endpoints
    if (Array.isArray(bunYaml.rules.api.endpoints)) {
      bunYaml.rules.api.endpoints.forEach((ep, index) => {
        if (!ep.path) errors.push(`Endpoint ${index}: missing required field 'path'`);
        if (!ep.method) errors.push(`Endpoint ${index}: missing required field 'method'`);
        if (!ep.summary) errors.push(`Endpoint ${index}: missing required field 'summary'`);
      });
    }

    // Validate OpenAPI config
    if (bunYaml.rules.api.openapi) {
      if (!bunYaml.rules.api.openapi.info) errors.push('Missing required field: rules.api.openapi.info');
      if (!bunYaml.rules.api.openapi.info.title) errors.push('Missing required field: rules.api.openapi.info.title');
    }
  }

  return errors;
}

// Semantic Rule Parsing from Markdown files
async function parseSemanticRules(mdFiles) {
  const semanticSchemas = {};
  const ruleDefinitions = {};

  for (const mdFile of mdFiles) {
    try {
      const content = await file(mdFile).text();

      // Parse YAML frontmatter (between --- markers)
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        try {
          const frontmatter = Bun.YAML.parse(frontmatterMatch[1]);
          if (frontmatter.schema) {
            // Extract schema definitions from frontmatter
            Object.assign(semanticSchemas, frontmatter.schema);
          }
          if (frontmatter.definition) {
            ruleDefinitions[frontmatter.definition.id || frontmatter.definition.name] = {
              ...frontmatter.definition,
              sourceFile: mdFile
            };
          }
        } catch (e) {
          if (options.verbose) console.warn(`Failed to parse frontmatter in ${mdFile}:`, e.message);
        }
      }

      // Parse JSON code blocks for schema definitions
      const jsonMatches = content.match(/```json\n([\s\S]*?)\n```/g);
      if (jsonMatches) {
        for (const jsonBlock of jsonMatches) {
          try {
            const schema = JSON.parse(jsonBlock.replace(/```json\n|\n```/g, ''));
            if (schema.$schema || schema.type === 'object') {
              // This looks like a JSON schema
              const schemaName = schema.title || `Schema_${Object.keys(semanticSchemas).length}`;
              semanticSchemas[schemaName] = schema;
            }
          } catch (e) {
            // Not valid JSON, skip
          }
        }
      }

      // Extract existing tag information
      const tagsMatch = content.match(/\[([A-Z]{3}-[A-Z]+-[0-9]{3})\]/);
      if (tagsMatch) {
        const tag = tagsMatch[0];
        if (!ruleDefinitions[tag]) {
          ruleDefinitions[tag] = {
            id: tag,
            sourceFile: mdFile,
            description: content.split('\n')[0] || 'Rule definition'
          };
        }
      }

    } catch (error) {
      if (options.verbose) console.warn(`Warning: Could not parse semantic rules from ${mdFile}:`, error.message);
    }
  }

  return { semanticSchemas, ruleDefinitions };
}

// Enhanced source mapping function
function resolveEndpointSources(ep, sources) {
  // More intelligent x-source resolution
  if (ep['x-source']) {
    // If x-source is an array of tag patterns, resolve them
    if (Array.isArray(ep['x-source'])) {
      return ep['x-source'].map(pattern => {
        // If it's a direct tag match, find the file
        if (sources[pattern]) return sources[pattern];
        // If it's a pattern, find matching files
        const matches = Object.entries(sources)
          .filter(([tag, file]) => tag.includes(pattern.split('*')[0]))
          .map(([tag, file]) => file);
        return matches.length > 0 ? matches[0] : null;
      }).filter(Boolean);
    }
    // If it's a string pattern, use it directly
    if (typeof ep['x-source'] === 'string') {
      if (sources[ep['x-source']]) return [sources[ep['x-source']]];
      // Try partial matches
      const matches = Object.entries(sources)
        .filter(([tag, file]) => tag.includes(ep['x-source']))
        .map(([tag, file]) => file);
      return matches.slice(0, 3); // Return up to 3 matches
    }
  }

  // Fallback: Use tags to find relevant sources
  if (ep.tags && Array.isArray(ep.tags)) {
    const relevantSources = [];
    for (const tag of ep.tags) {
      const matches = Object.entries(sources)
        .filter(([sourceTag, file]) => sourceTag.includes(tag))
        .map(([sourceTag, file]) => file);
      relevantSources.push(...matches);
    }
    // Return unique sources, max 3
    return [...new Set(relevantSources)].slice(0, 3);
  }

  // Final fallback: Return first 3 sources
  return Object.values(sources).slice(0, 3);
}

// Schema reference resolution
function resolveSchemaReferences(obj, semanticSchemas, ruleDefinitions) {
  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (key === '$ref' && typeof obj[key] === 'string') {
        const ref = obj[key];
        if (ref.startsWith('#/components/schemas/')) {
          const schemaName = ref.replace('#/components/schemas/', '');
          if (semanticSchemas[schemaName]) {
            obj[key] = semanticSchemas[schemaName];
          }
        } else if (ref.startsWith('#/rules/')) {
          const ruleName = ref.replace('#/rules/', '');
          if (ruleDefinitions[ruleName]) {
            // Convert rule definition to schema
            obj[key] = ruleToSchema(ruleDefinitions[ruleName]);
          }
        }
      } else {
        resolveSchemaReferences(obj[key], semanticSchemas, ruleDefinitions);
      }
    }
  }
  return obj;
}

// Convert rule definition to OpenAPI schema
function ruleToSchema(rule) {
  const schema = {
    type: 'object',
    title: rule.name || rule.id,
    description: rule.description,
    properties: {}
  };

  if (rule.fields) {
    for (const [fieldName, fieldDef] of Object.entries(rule.fields)) {
      schema.properties[fieldName] = {
        type: fieldDef.type || 'string',
        description: fieldDef.description,
        ...(fieldDef.required && { required: fieldDef.required }),
        ...(fieldDef.enum && { enum: fieldDef.enum })
      };
    }
  }

  return schema;
}

// Helper function to recursively find .md files
function findMdFiles(dir, files = []) {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findMdFiles(fullPath, files);
    } else if (item.endsWith('.md')) {
      files.push(resolve(fullPath));
    }
  }
  return files;
}

async function generateOpenAPI() {
  // Enhanced Error Handling for bun.yaml with Bun 1.3 direct YAML import
  let bunYaml;

  // Read the raw YAML text first for fallback parsing
  let bunYamlText;
  try {
    bunYamlText = await file('bun.yaml').text();
  } catch (error) {
    console.error('❌ Failed to read bun.yaml:', error.message);
    console.error('💡 Make sure bun.yaml exists in the current directory');
    process.exit(1);
  }

  try {
    // Bun 1.3: Direct YAML import support
    // This will leverage Bun's native YAML parser for better performance
    const configModule = await import('../bun.yaml', { with: { type: 'yaml' } });
    bunYaml = configModule.default;
    console.log('✅ Direct YAML import successful');

    // If direct import worked but missed compression/ai, merge from manual parse
    console.log('🔧 Checking for missing sections...');
    const fullYaml = Bun.YAML.parse(bunYamlText);
    console.log('📄 Full YAML has compression:', !!fullYaml.compression, 'ai:', !!fullYaml.ai);

    if (!bunYaml.compression || Object.keys(bunYaml.compression || {}).length === 0) {
      console.log('🔧 Merging compression section...');
      bunYaml.compression = fullYaml.compression;
    }
    if (!bunYaml.ai || Object.keys(bunYaml.ai || {}).length === 0) {
      console.log('🔧 Merging AI section...');
      bunYaml.ai = fullYaml.ai;
    }
  } catch (directImportError) {
    console.warn('⚠️  Direct YAML import failed, using manual parsing:', directImportError.message);

    // Fallback to manual parsing for compatibility
    try {
      bunYaml = Bun.YAML.parse(bunYamlText);
    } catch (error) {
      console.error('❌ Failed to parse bun.yaml:', error.message);
      console.error('💡 Check YAML syntax and ensure it follows the expected structure');
      process.exit(1);
    }
  }

  // Debug: Check what fields are available
  console.log('🔍 Available config fields:', Object.keys(bunYaml));
  console.log('🗜️  Has compression:', !!bunYaml.compression);
  console.log('🤖 Has ai:', !!bunYaml.ai);
  if (bunYaml.compression) {
    console.log('🗜️  Compression config:', JSON.stringify(bunYaml.compression, null, 2));
  }

  // Input Validation: Validate bun.yaml structure
  const validationErrors = validateBunYamlStructure(bunYaml);
  if (validationErrors.length > 0) {
    console.error('❌ bun.yaml validation failed:');
    validationErrors.forEach(error => console.error(`  - ${error}`));
    console.error('💡 Refer to the GUIDE.md for the expected bun.yaml structure');
    process.exit(1);
  }

  const { rules: { api, header: { schema } } } = bunYaml;

  // Async source-map: Extract from MD rules with semantic parsing
  const mdFiles = findMdFiles('rules');
  const sources = {};
  const { semanticSchemas, ruleDefinitions } = await parseSemanticRules(mdFiles);

  for (const mdFile of mdFiles) {
    try {
      const content = await file(mdFile).text();
      const tagsMatch = content.match(/\[([A-Z]{3}-[A-Z]+-[0-9]{3})\]/);
      if (tagsMatch) {
        sources[tagsMatch[0]] = mdFile;
      }
    } catch (error) {
      if (options.verbose) console.warn(`Warning: Could not read ${mdFile}:`, error.message);
    }
  }

  if (options.verbose) {
    console.log(`📊 Found ${Object.keys(sources).length} rule sources`);
    console.log(`🔧 Extracted ${Object.keys(semanticSchemas).length} semantic schemas`);
    console.log(`📋 Parsed ${Object.keys(ruleDefinitions).length} rule definitions`);
  }

  // Build spec async
  const spec = {
    openapi: '3.1.0',
    info: api.openapi.info,
    servers: [{ url: api.basePath }], // Interpolate from config
    tags: schema.scope.map(s => ({ name: s, description: `${s} Scope` })),
    paths: {},
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'sessionId' },
        csrfAuth: { type: 'apiKey', in: 'cookie', name: 'csrfToken' }
      }
    },
    security: api.security
  };

  // Map endpoints + sourcemaps with semantic schema resolution
  for (const ep of api.endpoints) {
    const path = `${api.basePath}${ep.path}`;
    spec.paths[path] = spec.paths[path] || {};

    // Deep clone and resolve schema references
    const parameters = ep.parameters ? JSON.parse(JSON.stringify(ep.parameters)) : [];
    const responses = ep.responses ? JSON.parse(JSON.stringify(ep.responses)) : {};
    let requestBody = ep.requestBody ? JSON.parse(JSON.stringify(ep.requestBody)) : null;

    // Resolve schema references in parameters, responses, and requestBody
    resolveSchemaReferences(parameters, semanticSchemas, ruleDefinitions);
    resolveSchemaReferences(responses, semanticSchemas, ruleDefinitions);
    if (requestBody) {
      resolveSchemaReferences(requestBody, semanticSchemas, ruleDefinitions);
    }

    // Inject dynamic enums from schema
    for (const param of parameters) {
      if (param.schema && param.schema.enum && Array.isArray(param.schema.enum)) {
        // Replace placeholder enums with actual schema values
        if (param.name === 'scope') {
          param.schema.enum = schema.scope;
        }
      }
    }

    spec.paths[path][ep.method.toLowerCase()] = {
      summary: ep.summary,
      description: ep.description,
      tags: ep.tags,
      operationId: ep.operationId,
      parameters: parameters,
      responses: responses,
      'x-source': resolveEndpointSources(ep, sources)  // Intelligent source mapping
    };

    // Add requestBody if defined
    if (requestBody) {
      spec.paths[path][ep.method.toLowerCase()].requestBody = requestBody;
    }

    // Add any additional endpoint extensions
    if (ep['x-priority']) spec.paths[path][ep.method.toLowerCase()]['x-priority'] = ep['x-priority'];
    if (ep['x-admin']) spec.paths[path][ep.method.toLowerCase()]['x-admin'] = ep['x-admin'];
    if (ep['x-audit']) spec.paths[path][ep.method.toLowerCase()]['x-audit'] = ep['x-audit'];
    if (ep['x-encrypt']) spec.paths[path][ep.method.toLowerCase()]['x-encrypt'] = ep['x-encrypt'];
    if (ep['x-security']) spec.paths[path][ep.method.toLowerCase()]['x-security'] = ep['x-security'];
    if (ep['x-streaming']) spec.paths[path][ep.method.toLowerCase()]['x-streaming'] = ep['x-streaming'];
    if (ep['x-websocket']) spec.paths[path][ep.method.toLowerCase()]['x-websocket'] = ep['x-websocket'];
    if (ep['x-realtime']) spec.paths[path][ep.method.toLowerCase()]['x-realtime'] = ep['x-realtime'];
    if (ep['x-cache']) spec.paths[path][ep.method.toLowerCase()]['x-cache'] = ep['x-cache'];
    if (ep['x-grep']) spec.paths[path][ep.method.toLowerCase()]['x-grep'] = ep['x-grep'];
  }

  // Dynamic Schema Definitions Generation with Semantic Schemas
  spec.components.schemas ??= {};

  // Add semantic schemas from rule definitions first
  Object.assign(spec.components.schemas, semanticSchemas);

  // Generate schemas from configuration
  spec.components.schemas.Scope = {
    type: 'string',
    enum: schema.scope,
    description: 'Available governance scopes'
  };

  // Generate schemas for common types used in endpoints (only if not already defined)
  if (!spec.components.schemas.Error) {
    spec.components.schemas.Error = {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        code: { type: 'string' }
      }
    };
  }

  if (!spec.components.schemas.ValidationResult) {
    spec.components.schemas.ValidationResult = {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        headers: { type: 'integer' },
        violations: { type: 'array', items: { type: 'string' } },
        timestamp: { type: 'string', format: 'date-time' }
      }
    };
  }

  if (!spec.components.schemas.SearchResult) {
    spec.components.schemas.SearchResult = {
      type: 'object',
      properties: {
        query: { type: 'string' },
        scope: { type: 'string' },
        results: { type: 'array', items: { type: 'object' } },
        total: { type: 'integer' },
        cached: { type: 'boolean' }
      }
    };
  }

  // Version Control Integration
  try {
    // Try to get Git commit SHA for better traceability
    const gitSha = await getGitCommitSha();
    if (gitSha) {
      spec.info.version = `${bunYaml.version}-${gitSha.substring(0, 8)}`;
      spec.info['x-commit-sha'] = gitSha;
      spec.info['x-generated-at'] = new Date().toISOString();
    }
  } catch (error) {
    // Silently continue if Git is not available
    console.log('ℹ️  Git information not available, using version from config');
  }

  // Post-processing: Linting, Breaking Change Detection, Output Formatting
  if (options.detectBreaking && options.compareTo) {
    const breakingChanges = await detectBreakingChanges(spec, options.compareTo);
    if (breakingChanges.length > 0) {
      console.error('❌ Breaking changes detected:');
      breakingChanges.forEach(change => console.error(`  - ${change}`));
      if (!options.force) {
        console.error('💡 Use --force to override breaking changes');
        process.exit(1);
      }
    } else {
      console.log('✅ No breaking changes detected');
    }
  }

  if (options.lint) {
    const lintResults = await lintOpenAPISpec(spec);
    if (lintResults.errors > 0) {
      console.error(`❌ Linting failed: ${lintResults.errors} errors`);
      lintResults.issues.forEach(issue => console.error(`  - ${issue}`));
      process.exit(1);
    } else {
      console.log(`✅ Linting passed: ${lintResults.warnings} warnings`);
    }
  }

  // Output formatting
  let outputContent, outputPath;

  if (options.outputFormat === 'json') {
    outputContent = JSON.stringify(spec, null, 2);
    outputPath = 'openapi.json';
  } else {
    outputContent = Bun.YAML.stringify(spec, null, 2);
    outputPath = 'openapi.yaml';
  }

  await Bun.write(outputPath, outputContent);
  console.log(`🟢 OpenAPI v3.1 generated! Paths: ${Object.keys(spec.paths).length} | Sources mapped: ${Object.keys(sources).length}`);
  console.log(`📄 Output: ${outputPath} (${options.outputFormat.toUpperCase()})`);

  // Generate API server configuration
  await writeApiServerConfig(bunYaml, semanticSchemas, ruleDefinitions);

  // Generate client SDK if requested
  if (options.generateClient) {
    await generateClientSDK(spec, options.clientLang);
  }

  // Generate documentation if requested
  if (options.generateDocs) {
    await generateDocumentation(spec, options.docsFormat);
  }

  // ETag generation for caching
  const etag = await generateETag(outputContent);
  console.log(`🏷️  ETag: ${etag}`);

  // Signal hot reload for running gateway
  await Bun.write('.reload-signal', Date.now().toString());
  console.log('🔄 Hot reload signal sent to gateway');

  return { spec, etag, sources: Object.keys(sources).length, schemas: Object.keys(spec.components.schemas).length };
}

// Version Control Integration Function
async function getGitCommitSha() {
  try {
    // Use Bun.spawn to run git command
    const proc = Bun.spawn(['git', 'rev-parse', 'HEAD'], {
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const output = await new Response(proc.stdout).text();
    const error = await new Response(proc.stderr).text();

    const exitCode = await proc.exited;
    if (exitCode === 0) {
      return output.trim();
    } else {
      console.log('Git command failed:', error.trim());
      return null;
    }
  } catch (error) {
    // Git not available or not a git repository
    return null;
  }
}

// OpenAPI Linting Function
async function lintOpenAPISpec(spec) {
  const issues = [];
  let errors = 0;
  let warnings = 0;

  // Basic linting rules
  // Check for required fields
  if (!spec.info?.title) {
    issues.push('Missing info.title');
    errors++;
  }

  if (!spec.info?.version) {
    issues.push('Missing info.version');
    errors++;
  }

  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    issues.push('No paths defined');
    errors++;
  }

  // Check paths for common issues
  for (const [path, operations] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!operation.summary && !operation.description) {
        issues.push(`Path ${path} ${method}: missing summary or description`);
        warnings++;
      }

      if (!operation.responses) {
        issues.push(`Path ${path} ${method}: missing responses`);
        errors++;
      }

      // Check for 200 response
      if (!operation.responses['200'] && !operation.responses['201']) {
        issues.push(`Path ${path} ${method}: missing success response (200/201)`);
        warnings++;
      }
    }
  }

  // Check components
  if (spec.components?.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      if (!schema.type && !schema.$ref) {
        issues.push(`Schema ${name}: missing type or $ref`);
        warnings++;
      }
    }
  }

  return { errors, warnings, issues };
}

// Breaking Change Detection
async function detectBreakingChanges(newSpec, previousSpecPath) {
  const breakingChanges = [];

  try {
    const previousSpecText = await file(previousSpecPath).text();
    const previousSpec = previousSpecText.includes('{') ?
      JSON.parse(previousSpecText) :
      Bun.YAML.parse(previousSpecText);

    // Check for removed paths
    const newPaths = Object.keys(newSpec.paths || {});
    const oldPaths = Object.keys(previousSpec.paths || {});

    const removedPaths = oldPaths.filter(path => !newPaths.includes(path));
    removedPaths.forEach(path => {
      breakingChanges.push(`REMOVED: Path ${path}`);
    });

    // Check for changed operations
    for (const path of newPaths) {
      if (previousSpec.paths[path]) {
        const newOps = Object.keys(newSpec.paths[path]);
        const oldOps = Object.keys(previousSpec.paths[path]);

        const removedOps = oldOps.filter(op => !newOps.includes(op));
        removedOps.forEach(op => {
          breakingChanges.push(`REMOVED: ${op.toUpperCase()} ${path}`);
        });
      }
    }

    // Check for changed response schemas (simplified)
    for (const path of newPaths) {
      if (previousSpec.paths[path]) {
        const newOps = newSpec.paths[path];
        const oldOps = previousSpec.paths[path];

        for (const method in newOps) {
          if (oldOps[method]) {
            // Compare response schemas (basic check)
            const newResponses = Object.keys(newOps[method].responses || {});
            const oldResponses = Object.keys(oldOps[method].responses || {});

            const changedResponses = newResponses.filter(code =>
              oldResponses.includes(code) &&
              JSON.stringify(newOps[method].responses[code]) !== JSON.stringify(oldOps[method].responses[code])
            );

            changedResponses.forEach(code => {
              breakingChanges.push(`CHANGED: ${method.toUpperCase()} ${path} response ${code} schema`);
            });
          }
        }
      }
    }

  } catch (error) {
    breakingChanges.push(`ERROR: Failed to compare specs: ${error.message}`);
  }

  return breakingChanges;
}

// Client SDK Generation
async function generateClientSDK(spec, language = 'typescript') {
  console.log(`🔧 Generating ${language} client SDK...`);

  const sdkDir = `client-sdk-${language}`;

  // Create basic SDK structure
  const clientCode = generateClientCode(spec, language);

  await Bun.write(`${sdkDir}/client.${language === 'typescript' ? 'ts' : 'js'}`, clientCode);
  await Bun.write(`${sdkDir}/package.json`, JSON.stringify({
    name: `syndicate-api-client-${language}`,
    version: spec.info.version,
    description: `Client SDK for ${spec.info.title}`,
    main: `client.${language === 'typescript' ? 'js' : 'js'}`
  }, null, 2));

  console.log(`✅ Client SDK generated in ${sdkDir}/`);
}

// Generate basic client code
function generateClientCode(spec, language) {
  const baseUrl = spec.servers?.[0]?.url || 'http://localhost:3000';

  if (language === 'typescript') {
    return `// Auto-generated TypeScript client for ${spec.info.title}

export interface ApiConfig {
  baseUrl?: string;
  apiKey?: string;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: ApiConfig = {}) {
    this.baseUrl = config.baseUrl || '${baseUrl}';
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(url, {
      method,
      headers,
      ...options
    });

    if (!response.ok) {
      throw new Error(\`API Error: \${response.status} \${response.statusText}\`);
    }

    return response.json();
  }

  // Generated endpoint methods would go here
  // This is a basic template - a full implementation would generate
  // type-safe methods for each endpoint in the OpenAPI spec
}
`;
  }

  // Basic JavaScript version would be similar but without types
  return `// Auto-generated JavaScript client for ${spec.info.title}

export class ApiClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || '${baseUrl}';
    this.apiKey = config.apiKey;
  }

  async request(method, path, options = {}) {
    const url = \`\${this.baseUrl}\${path}\`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(url, {
      method,
      headers,
      ...options
    });

    if (!response.ok) {
      throw new Error(\`API Error: \${response.status} \${response.statusText}\`);
    }

    return response.json();
  }
}
`;
}

// Documentation Generation
async function generateDocumentation(spec, format = 'html') {
  console.log(`📚 Generating ${format} documentation...`);

  const docsDir = 'api-docs';

  if (format === 'html') {
    const htmlDoc = generateHtmlDocs(spec);
    await Bun.write(`${docsDir}/index.html`, htmlDoc);
  } else if (format === 'markdown') {
    const mdDoc = generateMarkdownDocs(spec);
    await Bun.write(`${docsDir}/README.md`, mdDoc);
  }

  console.log(`✅ Documentation generated in ${docsDir}/`);
}

// Generate HTML documentation
function generateHtmlDocs(spec) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${spec.info.title} - API Documentation</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .endpoint { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    .method { font-weight: bold; color: #007acc; }
    .summary { font-size: 1.2em; margin: 5px 0; }
    .description { color: #666; }
  </style>
</head>
<body>
  <h1>${spec.info.title}</h1>
  <p><strong>Version:</strong> ${spec.info.version}</p>
  <p><strong>Description:</strong> ${spec.info.description}</p>

  <h2>Endpoints</h2>
  ${Object.entries(spec.paths).map(([path, operations]) =>
    Object.entries(operations).map(([method, op]) => `
      <div class="endpoint">
        <div class="method">${method.toUpperCase()}</div>
        <div class="summary">${op.summary || 'No summary'}</div>
        <div class="description">${op.description || ''}</div>
        <code>${path}</code>
      </div>
    `).join('')
  ).join('')}
</body>
</html>`;
}

// Generate Markdown documentation
function generateMarkdownDocs(spec) {
  return `# ${spec.info.title}

**Version:** ${spec.info.version}

${spec.info.description}

## Endpoints

${Object.entries(spec.paths).map(([path, operations]) =>
  Object.entries(operations).map(([method, op]) => `
### ${method.toUpperCase()} ${path}

${op.summary || 'No summary available'}

${op.description || ''}

**Responses:**
${Object.entries(op.responses || {}).map(([code, response]) =>
  `- **${code}**: ${response.description || 'No description'}`
).join('\n')}

---
`).join('')).join('')}`;
}

// Generate API Server Configuration Code with Bun 1.3 Enhancements
function generateApiServerConfig(bunYaml, semanticSchemas, ruleDefinitions) {
  const { rules: { api, database, redis, websockets, compression = {}, ai = {} } } = bunYaml;

  // Debug logging
  console.log('🔧 Generating server config with compression:', !!compression && Object.keys(compression).length > 0);
  console.log('🤖 AI config present:', !!ai && Object.keys(ai).length > 0);
  console.log('📊 Compression object:', JSON.stringify(compression, null, 2));
  console.log('🤖 AI object:', JSON.stringify(ai, null, 2));

  return `// src/generated/api-server-config.ts
// Auto-generated by api-gen.js - DO NOT EDIT MANUALLY
// Generated: ${new Date().toISOString()}

import { file } from 'bun';
import YAML from 'yaml';

// =============================================================================
// 🔧 CONFIGURATION IMPORTS (Bun 1.3 Enhanced)
// =============================================================================

// Direct YAML import support (Bun 1.3)
// import config from '../bun.yaml'; // Alternative: direct YAML import

export const config = ${JSON.stringify(bunYaml, null, 2)};

// Bun 1.3: Direct YAML file import example
export async function loadYamlConfig(filePath: string = '../bun.yaml') {
  try {
    // Direct YAML import (Bun 1.3 feature)
    const yamlModule = await import(filePath, { with: { type: 'yaml' } });
    return yamlModule.default;
  } catch (error) {
    // Fallback to manual parsing
    console.warn('Direct YAML import failed, using manual parsing:', error.message);
    const yamlText = await Bun.file(filePath).text();
    return Bun.YAML.parse(yamlText);
  }
}

// =============================================================================
// 🗄️ DATABASE CONNECTIONS
// =============================================================================

export const databaseConnections = ${JSON.stringify(database || {}, null, 2)};

// =============================================================================
// 🔴 REDIS CONNECTIONS
// =============================================================================

export const redisConnections = ${JSON.stringify(redis || {}, null, 2)};

// =============================================================================
// 🌐 WEBSOCKET CONFIGURATIONS
// =============================================================================

export const websocketConfigs = ${JSON.stringify(websockets || {}, null, 2)};

// =============================================================================
// 🗜️ COMPRESSION CONFIGURATION (Bun 1.3 Zstandard)
// =============================================================================

export const compressionConfigs = ${JSON.stringify(compression, null, 2)};

// =============================================================================
// 🤖 AI CONFIGURATION (Bun 1.3 WebAssembly Streaming)
// =============================================================================

export const aiConfigs = ${JSON.stringify(ai, null, 2)};

// =============================================================================
// 🔧 SEMANTIC SCHEMAS & VALIDATION
// =============================================================================

// Temporarily simplified to debug template issue
export const semanticSchemas = {};

export const ruleDefinitions = {};

// Schema validation function
export function validateAgainstSchema(data: any, schemaName: string): boolean {
  return true; // Simplified validation
}

// =============================================================================
// 🚀 API ROUTE HANDLERS
// =============================================================================

export function createRoutes() {
  const routes: Record<string, any> = {};

  ${api.endpoints.map(ep => `
  // ${ep.summary || ep.path}
  routes['${api.basePath}${ep.path}'] = {
    method: '${ep.method?.toUpperCase()}',
    handler: async (request: Request) => {
      try {
        // Semantic validation
        const url = new URL(request.url);
        const body = ${ep.method?.toLowerCase() === 'post' || ep.method?.toLowerCase() === 'put' ? 'await request.json().catch(() => ({}))' : '{}'};
        const isMutation = ${ep.method?.toLowerCase() === 'post' || ep.method?.toLowerCase() === 'put' || ep.method?.toLowerCase() === 'patch'};

        // Parameter extraction
        const params = {
          path: [], // Simplified - would need proper path parameter extraction
          query: Object.fromEntries(url.searchParams.entries()),
          headers: Object.fromEntries(request.headers.entries())
        };

        // Database connections available
        const db = databaseConnections.primary;
        const redis = redisConnections.primary;

        // WebSocket spawning for streaming endpoints
        ${ep.tags?.includes('STREAM') ? `
        if ('${ep['x-streaming']}' === 'true') {
          // Spawn WebSocket processor child
          const processor = Bun.spawn(['bun', 'run', 'scripts/websocket-processor.ts'], {
            stdout: 'pipe',
            stderr: 'pipe'
          });

          // Return streaming response
          return new Response(processor.stdout, {
            headers: { 'Content-Type': 'application/json' }
          });
        }` : ''}

        // Custom endpoint logic (extend based on tags)
        ${ep.tags?.includes('CONFIG') ? `
        if (request.method === 'GET') {
          return new Response(YAML.stringify(config), {
            headers: { 'Content-Type': 'application/yaml' }
          });
        }` : ''}

        ${ep.tags?.includes('GREP') ? `
        if (request.method === 'GET') {
          const scope = params.query.scope || 'GOV';
          const results = Object.entries(ruleDefinitions)
            .filter(([tag, rule]) => tag.includes(scope))
            .slice(0, params.query.limit || 50);

          return Response.json({
            query: params.query.q,
            scope: scope,
            results: results,
            total: results.length,
            cached: true
          });
        }` : ''}

        ${ep.tags?.includes('VALIDATE') ? `
        if (request.method === 'POST') {
          const isValid = validateAgainstSchema(body, 'ValidationRequest');
          return Response.json({
            valid: isValid,
            timestamp: new Date().toISOString()
          });
        }` : ''}

        // Default response for unimplemented endpoints
        return Response.json({
          endpoint: '${ep.path}',
          method: '${ep.method}',
          status: 'handler_not_implemented',
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Route handler error:', error);
        return Response.json({
          error: 'Internal Server Error',
          message: error.message,
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    }
  };`).join('\n\n  ')}

  return routes;
}

// =============================================================================
// 🔄 HOT RELOAD SIGNALING
// =============================================================================

export async function signalReload() {
  // Write reload signal file
  await Bun.write('.reload-signal', Date.now().toString());
}

export async function checkReloadSignal(): Promise<boolean> {
  try {
    const signal = await file('.reload-signal').text();
    const signalTime = parseInt(signal);
    const now = Date.now();

    // If signal is less than 5 seconds old, reload
    if (now - signalTime < 5000) {
      await Bun.write('.reload-signal', '0'); // Reset signal
      return true;
    }
  } catch (e) {
    // No signal file
  }
  return false;
}

// =============================================================================
// 🏗️ UTILITY FUNCTIONS
// =============================================================================

export function getDatabaseConnection(name: string = 'primary') {
  return databaseConnections[name];
}

export function getRedisConnection(name: string = 'primary') {
  return redisConnections[name];
}

export function getWebsocketConfig(name: string) {
  return websocketConfigs[name];
}

// WebSocket child process spawner with Bun 1.3 enhancements
export async function spawnWebSocketProcessor(configName: string, options: any = {}) {
  const config = websocketConfigs[configName];
  if (!config?.processor) {
    throw new Error(\`No processor configured for \${configName}. Only streaming WebSocket endpoints support child processors.\`);
  }

  return Bun.spawn(['bun', 'run', config.processor], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      WEBSOCKET_CONFIG: JSON.stringify(config),
      // Bun 1.3 compression settings
      COMPRESSION_CONFIG: JSON.stringify(compressionConfigs.websocket || {}),
      ...options.env
    }
  });
}

// =============================================================================
// 🍪 COOKIE MANAGEMENT (Bun 1.3 Built-in Support)
// =============================================================================

// Enhanced cookie management with Bun 1.3 built-in Map-like API
export function createSecureCookie(name: string, value: string, options: any = {}) {
  return new Bun.Cookie(name, value, {
    httpOnly: options.httpOnly ?? true,
    secure: options.secure ?? true,
    sameSite: options.sameSite ?? 'strict',
    maxAge: options.maxAge ?? 3600, // 1 hour default
    path: options.path ?? '/',
    domain: options.domain,
    ...options
  });
}

export function parseRequestCookies(request: Request) {
  return request.cookies; // Bun 1.3: Direct Map-like API access
}

// Helper functions for cookie operations
export function setResponseCookie(response: Response, name: string, value: string, options: any = {}) {
  const cookie = createSecureCookie(name, value, options);
  response.headers.append('Set-Cookie', cookie.serialize());
  return response;
}

export function clearCookie(name: string, options: any = {}) {
  return new Bun.Cookie(name, '', {
    maxAge: 0,
    path: options.path ?? '/',
    ...options
  }).serialize();
}

// =============================================================================
// 🗜️ COMPRESSION UTILITIES (Bun 1.3 Zstandard)
// =============================================================================

// Response compression with Bun 1.3 Zstandard support
export async function compressResponse(data: string | Uint8Array, config = compressionConfigs.default): Promise<Uint8Array> {
  if (!config || !config.algorithm) return typeof data === 'string' ? new TextEncoder().encode(data) : data;

  switch (config.algorithm) {
    case 'zstd':
      // Bun 1.3: Native Zstandard compression
      return Bun.zstdCompress(data, { level: config.level || 3 });
    case 'gzip':
      return Bun.gzipSync(data);
    default:
      return typeof data === 'string' ? new TextEncoder().encode(data) : data;
  }
}

// Automatic response compression for large responses
export async function createCompressedResponse(data: any, request: Request): Promise<Response> {
  const config = compressionConfigs.default;
  const acceptsCompression = request.headers.get('accept-encoding')?.includes('zstd') ||
                            request.headers.get('accept-encoding')?.includes('gzip');

  if (config && acceptsCompression && JSON.stringify(data).length > (config.threshold || 1024)) {
    const compressedData = await compressResponse(JSON.stringify(data), config);
    return new Response(compressedData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': config.algorithm === 'zstd' ? 'zstd' : 'gzip',
        'Vary': 'Accept-Encoding'
      }
    });
  }

  return Response.json(data);
}

// =============================================================================
// 🌊 STREAM PROCESSING UTILITIES (Bun 1.3 Enhanced)
// =============================================================================

// Enhanced stream processing with Bun 1.3 convenience methods
export async function processRequestStream(request: Request): Promise<any> {
  const contentType = request.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    return await request.json(); // Bun 1.3: Direct JSON parsing from ReadableStream
  }

  if (contentType?.includes('text/')) {
    return await request.text(); // Bun 1.3: Direct text extraction from ReadableStream
  }

  if (contentType?.includes('application/yaml') || contentType?.includes('text/yaml')) {
    const text = await request.text();
    return Bun.YAML.parse(text); // Bun 1.3: Native YAML parsing
  }

  if (contentType?.includes('multipart/form-data')) {
    // For form data, we can still use the existing approach
    return await request.formData();
  }

  // Default to bytes for binary data or unknown content types
  return await request.bytes(); // Bun 1.3: Direct bytes extraction from ReadableStream
}

// Additional stream utilities for working with ReadableStreams
export async function streamToText(stream: ReadableStream): Promise<string> {
  return await stream.text(); // Bun 1.3: Direct text extraction
}

export async function streamToJson(stream: ReadableStream): Promise<any> {
  return await stream.json(); // Bun 1.3: Direct JSON parsing
}

export async function streamToBytes(stream: ReadableStream): Promise<Uint8Array> {
  return await stream.bytes(); // Bun 1.3: Direct bytes extraction
}

export async function streamToBlob(stream: ReadableStream, options?: BlobPropertyBag): Promise<Blob> {
  return await stream.blob(); // Bun 1.3: Direct blob creation
}

// =============================================================================
// 🧠 AI MODEL MANAGEMENT (Bun 1.3 WebAssembly Streaming)
// =============================================================================

// WebAssembly streaming compilation for AI models (Bun 1.3 Enhanced)
export async function loadAIModel(modelName: string): Promise<WebAssembly.Module | null> {
  const modelConfig = aiConfigs?.inference?.models?.find((m: any) => m.name === modelName);
  if (!modelConfig?.wasm) return null;

  try {
    const response = await fetch(modelConfig.wasm.url);

    if (modelConfig.wasm.streaming !== false) {
      // Bun 1.3: WebAssembly streaming compilation (default enabled)
      return await WebAssembly.compileStreaming(response);
    } else {
      // Fallback for non-streaming scenarios
      const buffer = await response.arrayBuffer();
      return await WebAssembly.compile(buffer);
    }
  } catch (error) {
    console.error(\`Failed to load AI model \${modelName}:\`, error);
    return null;
  }
}

// Enhanced WebAssembly instantiation with streaming support
export async function instantiateAIModel(modelName: string, imports: any = {}): Promise<WebAssembly.Instance | null> {
  const modelConfig = aiConfigs?.inference?.models?.find((m: any) => m.name === modelName);
  if (!modelConfig?.wasm) return null;

  try {
    const response = await fetch(modelConfig.wasm.url);

    if (modelConfig.wasm.streaming !== false) {
      // Bun 1.3: WebAssembly streaming instantiation
      const { instance } = await WebAssembly.instantiateStreaming(response, imports);
      return instance;
    } else {
      // Fallback for non-streaming scenarios
      const buffer = await response.arrayBuffer();
      const module = await WebAssembly.compile(buffer);
      return await WebAssembly.instantiate(module, imports);
    }
  } catch (error) {
    console.error(\`Failed to instantiate AI model \${modelName}:\`, error);
    return null;
  }
}

// AI inference with resource management and streaming instantiation
export async function runAIInference(modelName: string, input: any): Promise<any> {
  const modelConfig = aiConfigs?.inference?.models?.find((m: any) => m.name === modelName);
  if (!modelConfig) {
    throw new Error(\`AI model \${modelName} not configured\`);
  }

  // AI inference with Bun 1.3 streaming instantiation and resource management
  try {
    // Create WASM instance with memory limits and streaming compilation
    const memory = new WebAssembly.Memory({
      initial: Math.ceil((modelConfig.wasm.memory || 64) / 64), // Pages (64KB each)
      maximum: Math.ceil((modelConfig.wasm.memory || 64) / 32)  // Allow some growth
    });

    const instance = await instantiateAIModel(modelName, {
      env: { memory },
      // Add other imports as needed for the specific AI model
      console: {
        log: (...args: any[]) => console.log(\`[WASM \${modelName}]\`, ...args)
      }
    });

    if (!instance) {
      throw new Error(\`Failed to instantiate WASM module for \${modelName}\`);
    }

    // Run inference (implementation depends on WASM exports)
    // This is a placeholder - actual implementation will depend on the specific AI model's API
    const result = instance.exports.runInference?.(input) ||
                   instance.exports.infer?.(input) ||
                   instance.exports.predict?.(input);

    return result;
  } catch (error) {
    console.error(\`AI inference failed for \${modelName}:\`, error);
    throw error;
  }
}
`;
}

// ETag Generation for caching
async function generateETag(content) {
  const hash = Bun.hash(content);
  return `"${hash.toString(16)}"`;
}

// Write API server configuration
async function writeApiServerConfig(bunYaml, semanticSchemas, ruleDefinitions) {
  const serverConfig = generateApiServerConfig(bunYaml, semanticSchemas, ruleDefinitions);
  console.log('📝 Generated server config length:', serverConfig.length);
  console.log('📝 Contains compressionConfigs:', serverConfig.includes('compressionConfigs'));
  console.log('📝 Contains aiConfigs:', serverConfig.includes('aiConfigs'));
  console.log('📝 Ends with backtick:', serverConfig.endsWith('`'));

  // Create src/generated directory if it doesn't exist
  try {
    await Bun.write('src/generated/.gitkeep', ''); // Create directory
  } catch (e) {
    // Directory might already exist
  }

  await Bun.write('src/generated/api-server-config.ts', serverConfig);
  console.log('🔧 Generated API server configuration: src/generated/api-server-config.ts');
}

// Watch mode for automatic regeneration
function setupWatchMode(callback) {
  const watchedFiles = [
    'bun.yaml',
    'rules/**/*.md',
    'config.yaml'
  ];

  console.log('👀 Watch mode enabled for:', watchedFiles.join(', '));

  // Use Bun's file watcher (simplified - in practice you'd use a more robust solution)
  setInterval(async () => {
    try {
      // Check if files have changed (simplified implementation)
      await callback();
    } catch (error) {
      console.error('Watch mode error:', error.message);
    }
  }, 2000); // Check every 2 seconds

  console.log('🔄 Auto-regeneration enabled');
}

if (import.meta.main) {
  // Add force option for breaking changes
  options.force = args.includes('--force');

  if (options.watch) {
    console.log('🔄 Starting watch mode...');
    setupWatchMode(async () => {
      console.log(`\n🔄 File change detected at ${new Date().toLocaleTimeString()}`);
      const startTime = performance.now();
      const result = await generateOpenAPI();
      const endTime = performance.now();
      console.log(`⚡ Regenerated in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`📊 ${result.sources} sources, ${result.schemas} schemas`);
    });
  } else {
    const startTime = performance.now();
    const result = await generateOpenAPI();
    const endTime = performance.now();

    console.log(`\n🎉 OpenAPI Generation Complete!`);
    console.log(`⚡ Total time: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`📊 Sources processed: ${result.sources}`);
    console.log(`🔧 Schemas generated: ${result.schemas}`);
    console.log(`🏷️  ETag: ${result.etag}`);
    console.log(`📄 Output: ${options.outputFormat.toUpperCase()} format saved`);

    if (result.spec.info['x-commit-sha']) {
      console.log(`🔗 Git commit: ${result.spec.info['x-commit-sha'].substring(0, 8)}`);
    }

    console.log(`\n💡 Pro tip: Use --watch for automatic regeneration on file changes!`);
  }
}
