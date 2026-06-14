import type { HttpClient } from "../ports";

// Real outbound HTTP client using global fetch. Framework-neutral. Tests use the
// memory client instead so they never make real network calls.
export function createFetchHttpClient(): HttpClient {
  return {
    async post(url, body, headers) {
      const response = await fetch(url, { method: "POST", body, headers });
      return { status: response.status, ok: response.ok };
    }
  };
}
