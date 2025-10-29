// scripts/benchmark.js - Bun performance benchmarks

const iterations = 10000;

console.log('🚀 Bun Performance Benchmarks');
console.log('==============================\n');

// Benchmark 1: YAML parsing
console.time('YAML Parse (10k iterations)');
const yaml = require('yaml');
for (let i = 0; i < iterations; i++) {
  const result = yaml.parse(`
test:
  data: ${i}
  array: [1, 2, 3]
  nested:
    value: test-${i}
`);
}
console.timeEnd('YAML Parse (10k iterations)');

// Benchmark 2: JSON operations
console.time('JSON Stringify/Parse (10k iterations)');
for (let i = 0; i < iterations; i++) {
  const obj = { id: i, data: `test-${i}`, timestamp: Date.now() };
  const json = JSON.stringify(obj);
  const parsed = JSON.parse(json);
}
console.timeEnd('JSON Stringify/Parse (10k iterations)');

// Benchmark 3: Bun's native hashing
console.time('Bun.hash (10k iterations)');
for (let i = 0; i < iterations; i++) {
  const hash = Bun.hash(`test-data-${i}`);
}
console.timeEnd('Bun.hash (10k iterations)');

// Benchmark 4: Bun's native compression
console.time('Bun.gzipSync (1k iterations)');
const largeData = 'x'.repeat(10000);
for (let i = 0; i < 1000; i++) {
  const compressed = Bun.gzipSync(largeData);
}
console.timeEnd('Bun.gzipSync (1k iterations)');

// Benchmark 5: File operations (async)
async function benchmarkFileOps() {
  console.time('Bun.file operations (1k iterations)');
  for (let i = 0; i < 1000; i++) {
    const data = await Bun.file('bun.yaml').text();
  }
  console.timeEnd('Bun.file operations (1k iterations)');
}
await benchmarkFileOps();

console.log('\n📊 Memory Usage:');
const mem = process.memoryUsage();
console.log(`  RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);

console.log('\n⚡ Runtime Info:');
console.log(`  Bun Version: ${Bun.version}`);
console.log(`  Platform: ${process.platform} ${process.arch}`);
console.log(`  Node.js Compatible: ${typeof globalThis.process !== 'undefined'}`);

console.log('\n🏆 Benchmarks complete! Bun performance is blazing fast!');
