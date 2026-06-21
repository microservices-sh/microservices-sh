import type { InvoicePaymentLinkProvider } from "../ports";

export function createMemoryInvoicePaymentLinkProvider(baseUrl = "https://pay.example"): InvoicePaymentLinkProvider {
  return {
    async createPaymentLink(input) {
      const id = `plink_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
      return {
        id,
        url: `${baseUrl.replace(/\/$/, "")}/${input.invoiceId}`,
        provider: "memory"
      };
    }
  };
}
