import type { HttpClient } from "../ports";
import type { HttpResponse } from "../types";

export interface RecordedRequest {
  url: string;
  body: string;
  headers: Record<string, string>;
}

export interface MemoryHttpClient extends HttpClient {
  requests: RecordedRequest[];
}

// In-memory HTTP client for tests. Records every request and returns a
// configurable status (default 200). Inject a `respond` function to simulate
// failures (e.g. 500) without any real network call.
export function createMemoryHttpClient(
  respond: (request: RecordedRequest) => HttpResponse = () => ({ status: 200, ok: true })
): MemoryHttpClient {
  const requests: RecordedRequest[] = [];
  return {
    requests,
    async post(url, body, headers) {
      const request: RecordedRequest = { url, body, headers };
      requests.push(request);
      return respond(request);
    }
  };
}
