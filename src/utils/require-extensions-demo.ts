// src/utils/require-extensions-demo.ts - Bun 1.3 require.extensions Support

// Demonstrates Bun's support for Node.js's require.extensions API
// This allows packages that rely on custom file loaders to work in Bun

import { readFileSync } from "fs";
import { extname } from "path";

// =============================================================================
// 📁 REQUIRE.EXTENSIONS DEMONSTRATION
// =============================================================================

// Example 1: Loading YAML files with require()
require.extensions[".yaml"] = (module, filename) => {
  console.log(`🔧 Loading YAML file: ${filename}`);
  const content = readFileSync(filename, "utf8");

  try {
    // Parse YAML content (using Bun.YAML for consistency with rest of codebase)
    const parsed = Bun.YAML.parse(content);
    module.exports = parsed;
  } catch (error) {
    console.error(`❌ Failed to parse YAML file ${filename}:`, error);
    module.exports = null;
  }
};

// Example 2: Loading INI configuration files
require.extensions[".ini"] = (module, filename) => {
  console.log(`🔧 Loading INI file: ${filename}`);
  const content = readFileSync(filename, "utf8");

  // Simple INI parser (in production, you'd use a proper INI library)
  const parseIni = (text: string): Record<string, any> => {
    const result: Record<string, any> = {};
    let currentSection = '';

    text.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) return;

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        result[currentSection] = {};
      } else if (trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        const parsedValue = /^\d+$/.test(value) ? parseInt(value) :
                           value === 'true' ? true :
                           value === 'false' ? false : value;

        if (currentSection) {
          result[currentSection][key.trim()] = parsedValue;
        } else {
          result[key.trim()] = parsedValue;
        }
      }
    });

    return result;
  };

  module.exports = parseIni(content);
};

// Example 3: Loading Markdown files as structured data
require.extensions[".md"] = (module, filename) => {
  console.log(`🔧 Loading Markdown file: ${filename}`);
  const content = readFileSync(filename, "utf8");

  // Extract frontmatter and content
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter = {};
  let body = content;

  if (frontmatterMatch) {
    try {
      frontmatter = Bun.YAML.parse(frontmatterMatch[1]);
      body = content.replace(frontmatterMatch[0], '').trim();
    } catch (error) {
      console.warn(`⚠️  Failed to parse frontmatter in ${filename}:`, error);
    }
  }

  module.exports = {
    frontmatter,
    body,
    filename,
    raw: content
  };
};

// Example 4: Loading environment files (.env)
require.extensions[".env"] = (module, filename) => {
  console.log(`🔧 Loading environment file: ${filename}`);
  const content = readFileSync(filename, "utf8");

  const envVars: Record<string, string> = {};

  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      // Remove quotes if present
      let value = valueParts.join('=');
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  });

  module.exports = envVars;
};

// =============================================================================
// 🧪 DEMONSTRATION
// =============================================================================

async function demonstrateRequireExtensions() {
  console.log("📁 Demonstrating Bun 1.3 require.extensions support");
  console.log("=" .repeat(55));

  try {
    // Note: In a real implementation, these files would exist
    // For demonstration, we'll create temporary files or use inline content

    console.log("\n📄 Example file loaders registered:");
    console.log("  .yaml - YAML configuration files");
    console.log("  .ini  - INI configuration files");
    console.log("  .md   - Markdown files with frontmatter");
    console.log("  .env  - Environment variable files");

    console.log("\n🔧 Usage examples:");
    console.log("  const config = require('./config.yaml');");
    console.log("  const settings = require('./app.ini');");
    console.log("  const doc = require('./README.md');");
    console.log("  const env = require('./.env');");

    // Demonstrate with inline examples (since files don't exist)
    console.log("\n🧪 Inline demonstrations:");

    // Simulate YAML loading
    console.log("📄 YAML Example:");
    const yamlExample = `
name: My App
version: 1.0.0
features:
  - authentication
  - api
  - database
config:
  port: 3000
  debug: true
`;
    const parsedYaml = Bun.YAML.parse(yamlExample);
    console.log("  Loaded YAML:", JSON.stringify(parsedYaml, null, 2));

    // Simulate INI loading
    console.log("\n📄 INI Example:");
    const iniExample = `
[database]
host=localhost
port=5432
name=myapp

[server]
port=3000
debug=true
`;
    console.log("  Would load INI as:", parseIniExample(iniExample));

    // Simulate Markdown loading
    console.log("\n📄 Markdown Example:");
    const mdExample = `---
title: My Document
author: John Doe
date: 2024-01-01
---

# Main Content

This is the body content of the markdown file.
`;
    const parsedMd = parseMarkdownExample(mdExample);
    console.log("  Loaded Markdown:");
    console.log("    Frontmatter:", parsedMd.frontmatter);
    console.log("    Body preview:", parsedMd.body.substring(0, 50) + "...");

    console.log("\n✅ require.extensions support demonstrated!");
    console.log("💡 This enables compatibility with packages that use custom file loaders");

  } catch (error) {
    console.error("❌ Error demonstrating require.extensions:", error);
  }
}

// Helper functions for inline demonstrations
function parseIniExample(text: string): Record<string, any> {
  const result: Record<string, any> = {};
  let currentSection = '';

  text.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) return;

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1);
      result[currentSection] = {};
    } else if (trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      const parsedValue = /^\d+$/.test(value) ? parseInt(value) :
                         value === 'true' ? true :
                         value === 'false' ? false : value;

      if (currentSection) {
        result[currentSection][key.trim()] = parsedValue;
      } else {
        result[key.trim()] = parsedValue;
      }
    }
  });

  return result;
}

function parseMarkdownExample(content: string) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter = {};
  let body = content;

  if (frontmatterMatch) {
    try {
      frontmatter = Bun.YAML.parse(frontmatterMatch[1]);
      body = content.replace(frontmatterMatch[0], '').trim();
    } catch (error) {
      console.warn("Failed to parse frontmatter:", error);
    }
  }

  return { frontmatter, body, raw: content };
}

// =============================================================================
// 🔧 UTILITY FUNCTIONS
// =============================================================================

// Helper to register custom extensions dynamically
export function registerCustomExtension(extension: string, loader: (module: any, filename: string) => void) {
  require.extensions[extension] = loader;
  console.log(`✅ Registered custom loader for ${extension} files`);
}

// Helper to list registered extensions
export function listRegisteredExtensions() {
  const extensions = Object.keys(require.extensions || {});
  console.log("📋 Currently registered require extensions:");
  extensions.forEach(ext => console.log(`  ${ext}`));
  return extensions;
}

// Export for use in other modules
export { demonstrateRequireExtensions };

// Run demonstration if called directly
if (import.meta.main) {
  demonstrateRequireExtensions().catch(console.error);
}
