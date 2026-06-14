import type { EmailProvider } from "../ports";
import type { EmailProviderError, SendEmailInput } from "../types";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface CreateStacksuiteEmailProviderOptions {
  /** API key issued by the StackSuite email service (API Gateway `X-Api-Key`). */
  apiKey: string;
  /**
   * Base URL of the deployed StackSuite email service, e.g.
   * `https://{api-id}.execute-api.{region}.amazonaws.com/production`.
   * The adapter appends `/send`.
   */
  apiBaseUrl: string;
  userAgent?: string;
  fetcher?: Fetcher;
}

interface StacksuitePayload {
  to: string[];
  subject: string;
  body?: string;
  html?: string;
  replyTo?: string[];
  fromName?: string;
  fromEmail?: string;
}

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
      await reader.cancel("stacksuite-response-too-large");
      return {
        error: {
          code: "STACKSUITE_RESPONSE_TOO_LARGE",
          message: "StackSuite email response exceeded the module response size limit."
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

/**
 * Splits a sender address into the `fromName`/`fromEmail` fields the StackSuite
 * service expects. Accepts both a bare address and the friendly
 * `Name <sender@example.com>` form.
 */
function splitSender(from: string): { fromName?: string; fromEmail: string } {
  const friendly = /^(.*?)\s*<([^<>\s@]+@[^<>\s@]+)>$/.exec(from);
  if (friendly) {
    const name = friendly[1].trim();
    return { fromName: name || undefined, fromEmail: friendly[2] };
  }
  return { fromEmail: from };
}

function toStacksuitePayload(input: SendEmailInput): StacksuitePayload {
  const payload: StacksuitePayload = {
    to: input.to,
    subject: input.subject
  };

  if (input.text) payload.body = input.text;
  if (input.html) payload.html = input.html;
  if (input.replyTo?.length) payload.replyTo = input.replyTo;

  if (input.from) {
    const { fromName, fromEmail } = splitSender(input.from);
    payload.fromEmail = fromEmail;
    if (fromName) payload.fromName = fromName;
  }

  // The StackSuite service does not accept cc, bcc, headers, attachments,
  // tags, or templates. The module schema permits them, so they are dropped
  // here rather than silently mutating the caller's input.
  return payload;
}

function providerError(status: number, body: unknown): EmailProviderError {
  const source = isRecord(body) && isRecord(body.error) ? body.error : body;
  const message =
    stringField(body, "error") ?? stringField(source, "message") ?? stringField(source, "error");

  return {
    code: stringField(source, "code") ?? "STACKSUITE_REQUEST_FAILED",
    message: message ?? "StackSuite email request failed.",
    provider: "stacksuite",
    status,
    raw: body
  };
}

export function createStacksuiteEmailProvider(
  options: CreateStacksuiteEmailProviderOptions
): EmailProvider {
  if (!options.apiKey) {
    throw new Error("EMAIL_SERVICE_API_KEY is required to create the StackSuite email provider.");
  }
  if (!options.apiBaseUrl) {
    throw new Error("apiBaseUrl is required to create the StackSuite email provider.");
  }

  const fetcher = options.fetcher ?? fetch;
  const endpoint = `${trimTrailingSlash(options.apiBaseUrl)}/send`;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  return {
    id: "stacksuite",

    async sendEmail(input) {
      const headers = new Headers({
        "X-Api-Key": options.apiKey,
        "Content-Type": "application/json",
        "User-Agent": userAgent
      });

      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(toStacksuitePayload(input))
        });
      } catch (error) {
        return {
          ok: false,
          status: 503,
          error: {
            code: "STACKSUITE_NETWORK_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "StackSuite email request failed before receiving a response.",
            provider: "stacksuite",
            status: 503
          }
        };
      }

      const body = await readSmallResponseBody(response);

      // The service returns HTTP 200 with { success: false, error } for some
      // failures, so treat a falsey `success` flag as a failure too.
      const succeeded = response.ok && (!isRecord(body) || body.success !== false);

      if (!succeeded) {
        return {
          ok: false,
          status: response.ok ? 502 : response.status,
          error: providerError(response.status, body)
        };
      }

      return {
        ok: true,
        data: {
          provider: "stacksuite",
          providerMessageId: stringField(body, "messageId"),
          status: "queued",
          raw: body
        }
      };
    }
  };
}
