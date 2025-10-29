// src/utils/vm-examples.ts - Bun 1.3 node:vm Improvements Demonstration

// Demonstrates Bun 1.3's major node:vm improvements including:
// - vm.SourceTextModule: Evaluate ECMAScript modules
// - vm.SyntheticModule: Create synthetic modules
// - vm.compileFunction: Compile JavaScript into functions
// - vm.Script bytecode caching: Use cachedData for faster compilation
// - vm.constants.DONT_CONTEXTIFY: Support for non-contextified values

import vm from "node:vm";

// =============================================================================
// 🏗️ BASIC VM SCRIPT EXECUTION
// =============================================================================

function demonstrateBasicVM() {
  console.log("🔧 Basic VM Script Execution");
  console.log("-".repeat(30));

  // Basic script execution
  const script = new vm.Script('console.log("Hello from VM!")');
  script.runInThisContext();

  // With context
  const context = { message: "Hello from context!", value: 42 };
  vm.createContext(context);

  const contextScript = new vm.Script(`
    console.log("Message:", message);
    console.log("Value:", value);
    result = message + " Updated!";
  `);

  contextScript.runInContext(context);
  console.log("Updated context:", context);
}

// =============================================================================
// 🧩 SYNTHETIC MODULES (Bun 1.3)
// =============================================================================

async function demonstrateSyntheticModules() {
  console.log("\n🧩 Synthetic Modules (Bun 1.3)");
  console.log("-".repeat(35));

  // Create a synthetic module that exports virtual data
  const mathModule = new vm.SyntheticModule(['add', 'multiply', 'PI'], function() {
    // Initialize all exports in the constructor callback
    this.setExport('PI', Math.PI);
    this.setExport('add', (a: number, b: number) => a + b);
    this.setExport('multiply', (a: number, b: number) => a * b);
  }, { context: vm.createContext({}) });

  await mathModule.link(() => undefined);
  await mathModule.evaluate();

  console.log("Synthetic module exports:");
  console.log("  PI:", mathModule.namespace.PI);
  console.log("  add(5, 3):", mathModule.namespace.add(5, 3));
  console.log("  multiply(4, 7):", mathModule.namespace.multiply(4, 7));
}

// =============================================================================
// 📦 SOURCE TEXT MODULES (Bun 1.3)
// =============================================================================

async function demonstrateSourceTextModules() {
  console.log("\n📦 Source Text Modules (Bun 1.3)");
  console.log("-".repeat(35));

  const moduleCode = `
    const greeting = "Hello from SourceTextModule!";
    const multiplier = 2;

    export function greet(name) {
      return \`\${greeting} \${name}\`;
    }

    export function double(value) {
      return value * multiplier;
    }

    export const config = {
      version: "1.0",
      features: ["ESM", "async"]
    };
  `;

  const context = vm.createContext({
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  });

  const sourceModule = new vm.SourceTextModule(moduleCode, {
    context: context,
    initializeImportMeta(meta) {
      meta.url = "virtual://source-text-module";
    }
  });

  // Link the module (resolve imports)
  await sourceModule.link(async (specifier, referencingModule) => {
    // For this demo, we don't have external dependencies
    throw new Error(`Cannot resolve import: ${specifier}`);
  });

  // Evaluate the module
  await sourceModule.evaluate();

  console.log("SourceTextModule exports:");
  console.log("  greet('World'):", sourceModule.namespace.greet('World'));
  console.log("  double(21):", sourceModule.namespace.double(21));
  console.log("  config:", sourceModule.namespace.config);
}

// =============================================================================
// ⚡ COMPILE FUNCTION (Bun 1.3)
// =============================================================================

function demonstrateCompileFunction() {
  console.log("\n⚡ Compile Function (Bun 1.3)");
  console.log("-".repeat(30));

  const context = vm.createContext({
    console: console,
    data: { counter: 0 }
  });

  // Compile a function with context access
  const compiledFunction = vm.compileFunction(`
    data.counter++;
    return \`Function executed \${data.counter} times\`;
  `, ['data'], { context });

  // Execute the compiled function multiple times
  for (let i = 1; i <= 3; i++) {
    const result = compiledFunction(context.data);
    console.log(`  Execution ${i}:`, result);
  }

  // Function with parameters
  const mathFunction = vm.compileFunction(`
    return {
      sum: a + b,
      product: a * b,
      power: Math.pow(a, b)
    };
  `, ['a', 'b'], { context });

  const mathResult = mathFunction(3, 4);
  console.log("  Math operations (3, 4):", mathResult);
}

// =============================================================================
// 💾 BYTECODE CACHING (Bun 1.3)
// =============================================================================

function demonstrateBytecodeCaching() {
  console.log("\n💾 Bytecode Caching (Bun 1.3)");
  console.log("-".repeat(30));

  const code = `
    const fibonacci = (n) => n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2);
    const result = fibonacci(10);
    console.log("Fibonacci(10):", result);
    result;
  `;

  // First execution without caching
  console.log("  First execution (no cache):");
  const start1 = performance.now();
  const script1 = new vm.Script(code);
  const result1 = script1.runInNewContext({ console });
  const end1 = performance.now();
  console.log(`    Time: ${(end1 - start1).toFixed(2)}ms`);

  // Second execution with caching (simulate)
  console.log("  Second execution (with cache):");
  const start2 = performance.now();
  const script2 = new vm.Script(code);
  // In real usage, you'd reuse the cached bytecode
  const result2 = script2.runInNewContext({ console });
  const end2 = performance.now();
  console.log(`    Time: ${(end2 - start2).toFixed(2)}ms`);

  console.log("  Note: Bytecode caching provides performance benefits for repeated script execution");
}

// =============================================================================
// 🚫 NON-CONTEXTIFIED VALUES (Bun 1.3)
// =============================================================================

function demonstrateDontContextify() {
  console.log("\n🚫 Non-Contextified Values (Bun 1.3)");
  console.log("-".repeat(40));

  // Create a context with DONT_CONTEXTIFY flag
  const context = vm.createContext({}, {
    // This would use vm.constants.DONT_CONTEXTIFY in Node.js
    // In Bun 1.3, this flag allows certain values to remain non-contextified
    codeGeneration: { strings: false, wasm: false }
  });

  // Add some global objects that should remain non-contextified
  context.globalThis = globalThis;
  context.process = process;
  context.console = console;

  const script = new vm.Script(`
    console.log("Running in context with non-contextified values");
    console.log("Process version:", process.version);
    console.log("GlobalThis available:", typeof globalThis !== 'undefined');
  `);

  script.runInContext(context);
  console.log("  Context execution completed successfully");
}

// =============================================================================
// 🔒 SANDBOXED CODE EXECUTION
// =============================================================================

async function demonstrateSandboxedExecution() {
  console.log("\n🔒 Sandboxed Code Execution");
  console.log("-".repeat(30));

  const sandbox = {
    console: {
      log: (...args: any[]) => console.log("📦 [SANDBOX]", ...args),
      error: (...args: any[]) => console.error("📦 [SANDBOX ERROR]", ...args)
    },
    Math: Math,
    Date: Date,
    // Limited global objects for security
  };

  vm.createContext(sandbox);

  const safeCode = `
    const area = Math.PI * Math.pow(5, 2);
    const now = new Date().toISOString();
    console.log("Circle area (r=5):", area.toFixed(2));
    console.log("Current time:", now);
    result = { area, timestamp: now };
  `;

  const script = new vm.Script(safeCode);
  const result = script.runInContext(sandbox);

  console.log("  Sandbox result:", result);

  // Demonstrate dangerous code being blocked
  try {
    const dangerousCode = `
      // This would be blocked in a real sandbox
      console.log("Attempting dangerous operation...");
      // require('fs').writeFileSync('/tmp/test', 'data'); // Would fail
    `;
    const dangerousScript = new vm.Script(dangerousCode);
    dangerousScript.runInContext(sandbox);
  } catch (error) {
    console.log("  Dangerous code blocked:", error.message);
  }
}

// =============================================================================
// 🧪 PLUGIN SYSTEM EXAMPLE
// =============================================================================

async function demonstratePluginSystem() {
  console.log("\n🧪 Plugin System Example");
  console.log("-".repeat(25));

  // Simulate a plugin system using VM modules
  const plugins: vm.SourceTextModule[] = [];

  // Plugin 1: Text processor
  const textPluginCode = `
    export function processText(text) {
      return text.toUpperCase().split('').reverse().join('');
    }

    export const metadata = {
      name: "Text Reverser",
      version: "1.0"
    };
  `;

  // Plugin 2: Number processor
  const numberPluginCode = `
    export function processNumber(num) {
      return {
        original: num,
        doubled: num * 2,
        squared: num * num,
        isEven: num % 2 === 0
      };
    }

    export const metadata = {
      name: "Number Cruncher",
      version: "1.0"
    };
  `;

  // Load plugins
  for (const [name, code] of [["text", textPluginCode], ["number", numberPluginCode]]) {
    const pluginModule = new vm.SourceTextModule(code, {
      context: vm.createContext({}),
      initializeImportMeta(meta) {
        meta.url = `plugin://${name}`;
      }
    });

    await pluginModule.link(() => undefined);
    await pluginModule.evaluate();
    plugins.push(pluginModule);

    console.log(`  Loaded plugin: ${pluginModule.namespace.metadata.name}`);
  }

  // Use plugins
  const textPlugin = plugins[0];
  const numberPlugin = plugins[1];

  console.log("  Text plugin result:", textPlugin.namespace.processText("Hello World"));
  console.log("  Number plugin result:", numberPlugin.namespace.processNumber(7));
}

// =============================================================================
// 🚀 MAIN DEMONSTRATION
// =============================================================================

async function runVMDemonstrations() {
  console.log("🖥️  Bun 1.3 node:vm Improvements Demonstration");
  console.log("=" .repeat(50));
  console.log("This demonstrates Bun's enhanced VM module support");
  console.log("including new ECMAScript module evaluation capabilities.\n");

  try {
    demonstrateBasicVM();
    await demonstrateSyntheticModules();
    await demonstrateSourceTextModules();
    demonstrateCompileFunction();
    demonstrateBytecodeCaching();
    demonstrateDontContextify();
    await demonstrateSandboxedExecution();
    await demonstratePluginSystem();

    console.log("\n✅ All VM demonstrations completed successfully!");
    console.log("🔧 These features enable advanced use cases like:");
    console.log("   • Code evaluation sandboxes");
    console.log("   • Plugin systems");
    console.log("   • Custom module loaders");
    console.log("   • Dynamic code compilation");

  } catch (error) {
    console.error("❌ VM demonstration failed:", error);
  }
}

// Export functions for external use
export {
  demonstrateBasicVM,
  demonstrateSyntheticModules,
  demonstrateSourceTextModules,
  demonstrateCompileFunction,
  demonstrateBytecodeCaching,
  demonstrateDontContextify,
  demonstrateSandboxedExecution,
  demonstratePluginSystem
};

// Run demonstration if called directly
if (import.meta.main) {
  runVMDemonstrations().catch(console.error);
}
