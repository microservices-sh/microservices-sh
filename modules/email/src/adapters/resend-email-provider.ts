import type { EmailProvider } from "../ports";
import type { EmailAttachment, EmailProviderError, SendEmailInput } from "../types";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface CreateResendEmailProviderOptions {
  apiKey: string;
  apiBaseUrl?: string;
  userAgent?: string;
  fetcher?: Fetcher;
}

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string[];
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
  tags?: Array<{ name: string; value: string }>;
  template?: {
    id: string;
    variables?: Record<string, string | number>;
  };
}

const DEFAULT_API_BASE_URL = "https://api.resend.com";
const DEFAULT_USER_AGENT = "microservices-sh-email/0.1.0";
const MAX_RESPONSE_BYTES = 64 * 1024;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === "string" ? field : null;
}

async function readSmallResponseBody(response: Response) {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel("resend-response-too-large");
      return {
        error: {
          code: "RESEND_RESPONSE_TOO_LARGE",
          message: "Resend response exceeded the module response size limit."
        }
      };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(bytes);
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function toResendPayload(input: SendEmailInput): ResendPayload {
  const payload: ResendPayload = {
    from: input.from ?? "",
    to: input.to,
    subject: input.subject
  };

  if (input.cc?.length) payload.cc = input.cc;
  if (input.bcc?.length) payload.bcc = input.bcc;
  if (input.replyTo?.length) payload.reply_to = input.replyTo;
  if (input.html) payload.html = input.html;
  if (input.text) payload.text = input.text;
  if (input.headers) payload.headers = input.headers;
  if (input.attachments?.length) payload.attachments = input.attachments;
  if (input.tags?.length) payload.tags = input.tags;
  if (input.template) payload.template = input.template;

  return payload;
}

function providerError(status: number, body: unknown): EmailProviderError {
  const source = isRecord(body) && isRecord(body.error) ? body.error : body;
  const code = stringField(source, "name") ?? stringField(source, "code") ?? stringField(source, "type");
  const message = stringField(source, "message");

  return {
    code: code ?? "RESEND_REQUEST_FAILED",
    message: message ?? "Resend request failed.",
    provider: "resend",
    status,
    raw: body
  };
}

export function createResendEmailProvider(options: CreateResendEmailProviderOptions): EmailProvider {
  if (!options.apiKey) {
    throw new Error("RESEND_API_KEY is required to create the Resend email provider.");
  }

  const fetcher = options.fetcher ?? fetch;
  const endpoint = `${trimTrailingSlash(options.apiBaseUrl ?? DEFAULT_API_BASE_URL)}/emails`;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  return {
    id: "resend",

    async sendEmail(input) {
      const headers = new Headers({
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": userAgent
      });

      if (input.idempotencyKey) {
        headers.set("Idempotency-Key", input.idempotencyKey);
      }

      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(toResendPayload(input))
        });
      } catch (error) {
        return {
          ok: false,
          status: 503,
          error: {
            code: "RESEND_NETWORK_ERROR",
            message: error instanceof Error ? error.message : "Resend request failed before receiving a response.",
            provider: "resend",
            status: 503
          }
        };
      }

      const body = await readSmallResponseBody(response);

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: providerError(response.status, body)
        };
      }

      return {
        ok: true,
        data: {
          provider: "resend",
          providerMessageId: stringField(body, "id"),
          status: "queued",
          raw: body
        }
      };
    }
  };
}
