import type { InvoicePaymentLinkProvider } from "../ports";

type FetchLike = typeof fetch;

function appendOptional(body: URLSearchParams, key: string, value: string | undefined) {
  if (value) body.set(key, value);
}

async function postStripe<T>(
  fetchImpl: FetchLike,
  secretKey: string,
  path: string,
  body: URLSearchParams,
  idempotencyKey?: string
): Promise<T> {
  const response = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: body.toString()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe ${path} failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export function createStripeInvoicePaymentLinkProvider(
  secretKey: string,
  fetchImpl: FetchLike = fetch
): InvoicePaymentLinkProvider {
  return {
    async createPaymentLink(input) {
      const priceBody = new URLSearchParams();
      priceBody.set("unit_amount", String(input.amountCents));
      priceBody.set("currency", input.currency.toLowerCase());
      priceBody.set("product_data[name]", `Invoice ${input.invoiceNumber}`);
      priceBody.set("product_data[metadata][invoiceId]", input.invoiceId);
      priceBody.set("product_data[metadata][invoiceNumber]", input.invoiceNumber);

      const price = await postStripe<{ id: string }>(
        fetchImpl,
        secretKey,
        "prices",
        priceBody,
        `${input.idempotencyKey}:price`
      );

      const linkBody = new URLSearchParams();
      linkBody.set("line_items[0][price]", price.id);
      linkBody.set("line_items[0][quantity]", "1");
      linkBody.set("metadata[invoiceId]", input.invoiceId);
      linkBody.set("metadata[invoiceNumber]", input.invoiceNumber);
      linkBody.set("metadata[customerId]", input.customerId);
      appendOptional(linkBody, "metadata[customerEmail]", input.customerEmail);
      if (input.successUrl) {
        linkBody.set("after_completion[type]", "redirect");
        linkBody.set("after_completion[redirect][url]", input.successUrl);
      }
      linkBody.set("allow_promotion_codes", "false");
      linkBody.set("billing_address_collection", "auto");
      linkBody.set("customer_creation", "if_required");

      const link = await postStripe<{ id: string; url: string }>(
        fetchImpl,
        secretKey,
        "payment_links",
        linkBody,
        `${input.idempotencyKey}:payment-link`
      );
      return { id: link.id, url: link.url, provider: "stripe" };
    }
  };
}
