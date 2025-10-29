# Cloudflare Workers Deployment Guide

## Overview

The Syndicate API Citadel has been adapted to run on Cloudflare Workers, providing a serverless deployment option with global distribution, automatic scaling, and edge computing capabilities.

## Architecture

### Cloudflare Workers Runtime
- **Runtime**: V8-based JavaScript runtime (different from Bun)
- **APIs**: Web Standards + Cloudflare extensions
- **Limits**: 100ms CPU time, 128MB memory
- **Storage**: KV, D1 Database, Durable Objects

### Adapted Features
- ✅ **HTTP/HTTPS endpoints** with full REST API support
- ✅ **WebSocket connections** with real-time communication
- ✅ **CORS support** for cross-origin requests
- ✅ **JSON/YAML responses** based on Accept headers
- ✅ **Rate limiting** (configurable via wrangler.toml)
- ✅ **Environment variables** for configuration
- ⚠️ **Worker threads**: Not available (different runtime)
- ⚠️ **node:test**: Not available (different runtime)
- ⚠️ **node:vm**: Not available (different runtime)

## Available Endpoints

### Core API Endpoints
- `GET /health` - Health check with runtime information
- `GET /api/v3/config` - API configuration (JSON/YAML)
- `GET /api/v3/rules/grep?q=search&scope=SCOPE` - Rule search
- `POST /api/v3/rules/validate` - Request validation
- `GET /api/v3/docs` - OpenAPI specification
- `GET /api/v3/ws/negotiate` - WebSocket negotiation

## Deployment Steps

### 1. Prerequisites
```bash
# Install Cloudflare Workers CLI
npm install -g wrangler

# Login to Cloudflare
wrangler auth login
```

### 2. Build the Worker
```bash
# Build the worker for deployment
npm run cf:build
```

### 3. Deploy to Cloudflare
```bash
# Deploy to production
npm run cf:deploy

# Or deploy with custom name
wrangler deploy --name my-custom-name
```

### 4. Development
```bash
# Run locally for development
npm run cf:dev

# This starts a local development server
# Available at: http://localhost:8787
```

## Configuration

### wrangler.toml
```toml
name = "syndicate-api-citadel"
main = "src/workers/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Environment variables
[vars]
NODE_ENV = "production"
API_VERSION = "1.0.0"

# Rate limiting
[rate_limiting]
requests_per_hour = 1000
```

### Environment Variables
- `NODE_ENV`: Environment (development/production)
- `API_VERSION`: API version string

### Optional Bindings

#### KV Storage (for caching)
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your_kv_namespace_id"
```

#### D1 Database (for data storage)
```toml
[[d1_databases]]
binding = "DB"
database_name = "syndicate-api"
database_id = "your_d1_database_id"
```

## API Usage Examples

### Health Check
```bash
curl https://your-worker.your-subdomain.workers.dev/health
```

### Get Configuration
```bash
# JSON response
curl https://your-worker.your-subdomain.workers.dev/api/v3/config

# YAML response
curl -H "Accept: application/yaml" https://your-worker.your-subdomain.workers.dev/api/v3/config
```

### Search Rules
```bash
curl "https://your-worker.your-subdomain.workers.dev/api/v3/rules/grep?q=GOV&scope=GOV"
```

### Validate Request
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/api/v3/rules/validate \
  -H "Content-Type: application/json" \
  -d '{"scope": "GOV", "data": {"test": "value"}}'
```

### WebSocket Connection
```javascript
const ws = new WebSocket('wss://your-worker.your-subdomain.workers.dev/api/v3/ws/negotiate?protocol=json-rpc');

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'hello', message: 'from client' }));
};
```

## Performance Characteristics

### Cloudflare Workers Benefits
- **Global Distribution**: Deployed to 200+ edge locations
- **Zero Cold Starts**: Always running and ready
- **Automatic Scaling**: Handles any traffic load
- **DDoS Protection**: Built-in protection
- **SSL/TLS**: Automatic HTTPS with custom certificates

### Limitations vs Bun Runtime
- **Execution Time**: 100ms CPU limit per request
- **Memory**: 128MB limit
- **Storage**: No local file system
- **Node.js APIs**: Limited subset available
- **WebAssembly**: Supported but with restrictions

## Monitoring & Analytics

### Cloudflare Dashboard
- Real-time metrics and analytics
- Request/response logs
- Performance monitoring
- Error tracking

### Custom Metrics
The health endpoint provides runtime information:
```json
{
  "status": "healthy",
  "runtime": {
    "platform": "cloudflare-workers",
    "version": "1.0.0",
    "environment": "production"
  },
  "response_time": "1.23ms"
}
```

## Development vs Production

### Local Development
```bash
# Run locally with hot reload
npm run cf:dev

# Test endpoints
curl http://localhost:8787/health
```

### Production Deployment
```bash
# Build and deploy
npm run cf:build
npm run cf:deploy

# Check deployment status
wrangler tail  # View real-time logs
```

## Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clear build cache
rm -rf dist/
npm run cf:build
```

#### Deployment Failures
```bash
# Check wrangler configuration
wrangler whoami
wrangler dev  # Test locally first
```

#### Runtime Errors
```bash
# View logs
wrangler tail

# Check for Node.js API usage
# CF Workers doesn't support all Node.js APIs
```

## Migration from Bun Runtime

### Compatible Features
- ✅ HTTP request/response handling
- ✅ WebSocket connections
- ✅ JSON/YAML processing
- ✅ Environment variables
- ✅ CORS handling
- ✅ URL routing

### Incompatible Features
- ❌ Worker threads (use Durable Objects instead)
- ❌ node:test (use other testing frameworks)
- ❌ node:vm (use WebAssembly or edge functions)
- ❌ File system access (use KV/D1/R2)
- ❌ Child processes (use fetch to other workers)

## Cost Optimization

### Free Tier Limits
- 100,000 requests/day
- 10ms CPU time per request
- 1GB data transfer/month

### Paid Tier Benefits
- Higher limits
- Analytics and monitoring
- Custom domains
- Advanced security features

## Security Considerations

### Built-in Security
- ✅ Automatic HTTPS
- ✅ DDoS protection
- ✅ Rate limiting (configurable)
- ✅ CORS protection
- ✅ Request size limits

### Best Practices
- Validate all input data
- Use environment variables for secrets
- Implement proper authentication
- Monitor for abuse patterns
- Keep dependencies updated

---

## 🚀 Ready for Deployment!

Your Syndicate API Citadel is now ready to be deployed to Cloudflare Workers. The global edge network will provide fast, reliable API access worldwide with automatic scaling and security.

**Deploy now:**
```bash
npm run cf:build && npm run cf:deploy
```
