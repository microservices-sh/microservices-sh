// Raised by provider adapters. `status` mirrors the upstream HTTP status; 429 and
// 5xx are treated as retryable, which drives provider fallback in the service.
export class ImageProviderError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string,
  ) {
    super(message);
    this.name = "ImageProviderError";
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}
