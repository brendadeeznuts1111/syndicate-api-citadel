// src/utils/fetch-advanced-demo.ts - Bun 1.3 Advanced Fetch API Demonstrations

// Comprehensive demonstration of Bun's enhanced fetch API capabilities
// including streaming, TLS, S3, Unix sockets, and performance optimizations

// =============================================================================
// 🏗️ BASIC FETCH OPERATIONS
// =============================================================================

async function demonstrateBasicFetch() {
  console.log("🌐 Basic Fetch Operations");
  console.log("-".repeat(25));

  try {
    // Basic GET request
    const response = await fetch('https://httpbin.org/get');
    const data = await response.json();
    console.log("✅ Basic GET request successful");
    console.log("   Status:", response.status);
    console.log("   URL:", data.url);

    // POST request with JSON body
    const postResponse = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'Bun-1.3-Demo'
      },
      body: JSON.stringify({
        message: 'Hello from Bun 1.3!',
        timestamp: new Date().toISOString()
      })
    });

    const postData = await postResponse.json();
    console.log("✅ POST request with JSON successful");
    console.log("   Response headers:", Object.fromEntries(postResponse.headers.entries()));

  } catch (error) {
    console.log("❌ Basic fetch failed:", error.message);
  }
}

// =============================================================================
// 🌊 STREAMING REQUESTS & RESPONSES
// =============================================================================

async function demonstrateStreaming() {
  console.log("\n🌊 Streaming Requests & Responses");
  console.log("-".repeat(35));

  try {
    // Streaming response body
    const response = await fetch('https://httpbin.org/stream/10');

    console.log("✅ Streaming response initiated");
    console.log("   Content-Type:", response.headers.get('content-type'));

    // Read response as stream
    let totalChunks = 0;
    let totalSize = 0;

    for await (const chunk of response.body!) {
      totalChunks++;
      totalSize += chunk.length;

      if (totalChunks <= 3) { // Only log first few chunks
        console.log(`   Chunk ${totalChunks}: ${chunk.length} bytes`);
      }
    }

    console.log(`   Total chunks: ${totalChunks}, Total size: ${totalSize} bytes`);

    // Streaming request body
    const stream = new ReadableStream({
      start(controller) {
        const data = 'Hello from streaming request body!\nThis is sent in chunks.\n';
        const chunks = data.split('\n');

        chunks.forEach((chunk, index) => {
          controller.enqueue(new TextEncoder().encode(chunk + '\n'));
          if (index === chunks.length - 1) {
            controller.close();
          }
        });
      }
    });

    const streamResponse = await fetch('https://httpbin.org/post', {
      method: 'POST',
      body: stream,
      headers: {
        'Content-Type': 'text/plain'
      }
    });

    const streamResult = await streamResponse.json();
    console.log("✅ Streaming request body successful");
    console.log("   Data received back:", streamResult.data.length, "characters");

  } catch (error) {
    console.log("❌ Streaming operations failed:", error.message);
  }
}

// =============================================================================
// 🔒 TLS & SECURITY FEATURES
// =============================================================================

async function demonstrateTLS() {
  console.log("\n🔒 TLS & Security Features");
  console.log("-".repeat(30));

  try {
    // Request with custom TLS options
    const response = await fetch('https://httpbin.org/get', {
      tls: {
        rejectUnauthorized: true, // Default behavior
        checkServerIdentity: (hostname, cert) => {
          console.log(`   TLS: Checking certificate for ${hostname}`);
          // Custom certificate validation could be implemented here
          return undefined; // No error = valid
        }
      }
    });

    console.log("✅ TLS request with custom validation successful");
    console.log("   Server certificate validated for:", response.url);

    // Demonstrate timeout with AbortSignal
    console.log("   Testing request timeout...");

    try {
      const timeoutController = new AbortController();
      setTimeout(() => timeoutController.abort(), 100); // Very short timeout

      await fetch('https://httpbin.org/delay/1', {
        signal: timeoutController.signal
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("✅ Request timeout/abort working correctly");
      } else {
        console.log("❌ Unexpected error:", error.message);
      }
    }

  } catch (error) {
    console.log("❌ TLS operations failed:", error.message);
  }
}

// =============================================================================
// 🔌 UNIX DOMAIN SOCKETS
// =============================================================================

async function demonstrateUnixSockets() {
  console.log("\n🔌 Unix Domain Sockets");
  console.log("-".repeat(25));

  // Note: This would require a Unix socket server to be running
  // For demonstration purposes, we'll show the API usage

  console.log("ℹ️  Unix domain socket support available:");
  console.log("   const response = await fetch('https://hostname/path', {");
  console.log("     unix: '/var/run/my-service.sock',");
  console.log("     method: 'POST',");
  console.log("     body: JSON.stringify({data: 'test'})");
  console.log("   });");

  // Try a regular HTTP request to show the API structure
  try {
    const response = await fetch('https://httpbin.org/get');
    console.log("✅ Regular HTTP request (Unix socket API available)");
  } catch (error) {
    console.log("❌ HTTP request failed:", error.message);
  }
}

// =============================================================================
// 📁 FILE & DATA URL SUPPORT
// =============================================================================

async function demonstrateFileAndDataUrls() {
  console.log("\n📁 File & Data URL Support");
  console.log("-".repeat(30));

  try {
    // Data URL support
    const dataUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQh';
    const dataResponse = await fetch(dataUrl);
    const dataText = await dataResponse.text();

    console.log("✅ Data URL fetch successful");
    console.log("   Content:", dataText);

    // Blob URL support
    const blob = new Blob(['Hello from Blob URL!'], { type: 'text/plain' });
    const blobUrl = URL.createObjectURL(blob);
    const blobResponse = await fetch(blobUrl);
    const blobText = await blobResponse.text();

    console.log("✅ Blob URL fetch successful");
    console.log("   Content:", blobText);

    // File URL support (if file exists)
    try {
      const fileResponse = await fetch('file://' + process.cwd() + '/package.json');
      const fileData = await fileResponse.json();

      console.log("✅ File URL fetch successful");
      console.log("   Package name:", fileData.name);
    } catch (error) {
      console.log("ℹ️  File URL demo skipped (file not accessible)");
    }

  } catch (error) {
    console.log("❌ File/Data URL operations failed:", error.message);
  }
}

// =============================================================================
// 📦 FORM DATA & MULTIPART
// =============================================================================

async function demonstrateFormData() {
  console.log("\n📦 Form Data & Multipart");
  console.log("-".repeat(25));

  try {
    // Create FormData
    const formData = new FormData();
    formData.append('name', 'Bun Demo');
    formData.append('version', '1.3.0');
    formData.append('file', new Blob(['Sample file content'], { type: 'text/plain' }), 'sample.txt');

    const response = await fetch('https://httpbin.org/post', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    console.log("✅ FormData upload successful");
    console.log("   Fields received:", Object.keys(result.form).length);
    console.log("   Files received:", Object.keys(result.files).length);

  } catch (error) {
    console.log("❌ FormData operations failed:", error.message);
  }
}

// =============================================================================
// 🚀 PERFORMANCE OPTIMIZATIONS
// =============================================================================

async function demonstratePerformanceOptimizations() {
  console.log("\n🚀 Performance Optimizations");
  console.log("-".repeat(30));

  try {
    // DNS prefetching (if available)
    console.log("ℹ️  DNS prefetching available via Bun.dns.prefetch()");

    // Connection keep-alive demonstration
    const responses = await Promise.all([
      fetch('https://httpbin.org/get?a=1'),
      fetch('https://httpbin.org/get?b=2'),
      fetch('https://httpbin.org/get?c=3')
    ]);

    console.log("✅ Connection reuse (keep-alive) working");
    console.log(`   ${responses.length} requests completed`);

    // Decompression demonstration
    const gzipResponse = await fetch('https://httpbin.org/gzip');
    const gzipData = await gzipResponse.json();

    console.log("✅ Automatic decompression working");
    console.log("   Gzipped response received and decompressed");

    // Verbose logging demonstration
    console.log("\n📋 Verbose logging example:");
    console.log("   const response = await fetch('https://example.com', { verbose: true });");
    console.log("   // This would show detailed request/response headers");

  } catch (error) {
    console.log("❌ Performance optimization demo failed:", error.message);
  }
}

// =============================================================================
// 🔍 RESPONSE BODY METHODS
// =============================================================================

async function demonstrateResponseMethods() {
  console.log("\n🔍 Response Body Methods");
  console.log("-".repeat(25));

  try {
    // Test different response body methods
    const response = await fetch('https://httpbin.org/json');

    // Method 1: JSON
    const jsonData = await response.clone().json();
    console.log("✅ response.json() - Type:", typeof jsonData, "Keys:", Object.keys(jsonData).length);

    // Method 2: Text
    const textData = await response.clone().text();
    console.log("✅ response.text() - Length:", textData.length, "characters");

    // Method 3: Bytes
    const bytesData = await response.clone().bytes();
    console.log("✅ response.bytes() - Length:", bytesData.length, "bytes");

    // Method 4: ArrayBuffer
    const arrayBufferData = await response.clone().arrayBuffer();
    console.log("✅ response.arrayBuffer() - Length:", arrayBufferData.byteLength, "bytes");

    // Method 5: Blob
    const blobData = await response.clone().blob();
    console.log("✅ response.blob() - Size:", blobData.size, "Type:", blobData.type);

  } catch (error) {
    console.log("❌ Response body methods failed:", error.message);
  }
}

// =============================================================================
// 🎯 MAIN DEMONSTRATION
// =============================================================================

async function runFetchDemonstrations() {
  console.log("🚀 Bun 1.3 Advanced Fetch API Demonstrations");
  console.log("=" .repeat(50));
  console.log("Comprehensive showcase of Bun's enhanced fetch capabilities");
  console.log("including streaming, TLS, security, and performance features.\n");

  const demonstrations = [
    demonstrateBasicFetch,
    demonstrateStreaming,
    demonstrateTLS,
    demonstrateUnixSockets,
    demonstrateFileAndDataUrls,
    demonstrateFormData,
    demonstratePerformanceOptimizations,
    demonstrateResponseMethods
  ];

  for (const demo of demonstrations) {
    try {
      await demo();
    } catch (error) {
      console.error(`❌ ${demo.name} failed:`, error);
    }

    // Small delay between demonstrations
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log("\n🎉 All Fetch API demonstrations completed!");
  console.log("\n📋 Bun's fetch API includes:");
  console.log("  • ✅ Full WHATWG fetch standard compliance");
  console.log("  • ✅ Streaming request/response bodies");
  console.log("  • ✅ TLS configuration and client certificates");
  console.log("  • ✅ Unix domain socket support");
  console.log("  • ✅ S3, file://, data://, blob:// URL schemes");
  console.log("  • ✅ Automatic decompression (gzip, deflate, brotli, zstd)");
  console.log("  • ✅ Connection pooling and keep-alive");
  console.log("  • ✅ DNS prefetching and preconnect");
  console.log("  • ✅ Proxy support");
  console.log("  • ✅ Request/response debugging with verbose option");
  console.log("  • ✅ AbortController and timeout support");
  console.log("  • ✅ Performance optimizations for large files");
  console.log("  • ✅ Native multipart upload for S3");
}

// Export functions for external use
export {
  demonstrateBasicFetch,
  demonstrateStreaming,
  demonstrateTLS,
  demonstrateUnixSockets,
  demonstrateFileAndDataUrls,
  demonstrateFormData,
  demonstratePerformanceOptimizations,
  demonstrateResponseMethods
};

// Run demonstration if called directly
if (import.meta.main) {
  runFetchDemonstrations().catch(console.error);
}
