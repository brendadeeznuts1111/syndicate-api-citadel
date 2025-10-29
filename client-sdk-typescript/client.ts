// Auto-generated TypeScript client for Syndicate API Citadel

export interface ApiConfig {
  baseUrl?: string;
  apiKey?: string;
}

export class ApiClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: ApiConfig = {}) {
    this.baseUrl = config.baseUrl || '/api/v3';
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
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
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Generated endpoint methods would go here
  // This is a basic template - a full implementation would generate
  // type-safe methods for each endpoint in the OpenAPI spec
}
