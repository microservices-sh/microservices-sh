export interface WooCommerceConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  fetcher?: typeof fetch;
}

export type WooCommerceCustomer = Record<string, unknown>;
export type WooCommerceProduct = Record<string, unknown>;
export type WooCommerceOrder = Record<string, unknown>;
export type WooCommerceCategory = Record<string, unknown>;

export interface WooCommercePaginatedResponse<T> {
  data: T[];
  totalPages: number;
  totalItems: number;
}

function basicAuth(consumerKey: string, consumerSecret: string): string {
  return `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}`;
}

function paginationHeader(headers: Headers, name: string): string | null {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? headers.get(name.replaceAll("-", "").toLowerCase());
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class WooCommerceClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly fetcher: typeof fetch;

  constructor(config: WooCommerceConfig) {
    this.baseUrl = config.storeUrl.replace(/\/$/, "");
    this.authHeader = basicAuth(config.consumerKey, config.consumerSecret);
    this.fetcher = config.fetcher ?? fetch;
  }

  private url(endpoint: string, params: Record<string, string | number> = {}): string {
    const url = new URL(`${this.baseUrl}/wp-json/wc/v3${endpoint}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    return url.toString();
  }

  private async request<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const response = await this.fetcher(this.url(endpoint, params), {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`WooCommerce API error: ${response.status} - ${body}`);
    }
    return response.json() as Promise<T>;
  }

  private async paginatedRequest<T>(
    endpoint: string,
    params: Record<string, string | number> = {}
  ): Promise<WooCommercePaginatedResponse<T>> {
    const response = await this.fetcher(this.url(endpoint, params), {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`WooCommerce API error: ${response.status} - ${body}`);
    }

    const data = (await response.json()) as T[];
    const perPage = Number(params.per_page ?? 100);
    const totalPagesHeader = paginationHeader(response.headers, "X-WP-TotalPages");
    const totalItemsHeader = paginationHeader(response.headers, "X-WP-Total");
    return {
      data,
      totalPages: totalPagesHeader ? parsePositiveInt(totalPagesHeader, 1) : data.length >= perPage ? 999 : 1,
      totalItems: parsePositiveInt(totalItemsHeader, data.length)
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string; storeName?: string }> {
    try {
      const status = await this.request<{ store?: { name?: string } }>("/system_status");
      return { success: true, message: "Connected successfully", storeName: status.store?.name };
    } catch (error) {
      try {
        await this.getProducts(1, 1);
        return { success: true, message: "Connected successfully" };
      } catch {
        return { success: false, message: error instanceof Error ? error.message : "Connection failed" };
      }
    }
  }

  getCustomers(page = 1, perPage = 100, modifiedAfter?: string): Promise<WooCommercePaginatedResponse<WooCommerceCustomer>> {
    const params: Record<string, string | number> = { page, per_page: perPage, orderby: "registered_date", order: "asc" };
    if (modifiedAfter) params.modified_after = modifiedAfter;
    return this.paginatedRequest<WooCommerceCustomer>("/customers", params);
  }

  getProducts(page = 1, perPage = 100, modifiedAfter?: string): Promise<WooCommercePaginatedResponse<WooCommerceProduct>> {
    const params: Record<string, string | number> = { page, per_page: perPage, orderby: "date", order: "asc" };
    if (modifiedAfter) params.modified_after = modifiedAfter;
    return this.paginatedRequest<WooCommerceProduct>("/products", params);
  }

  getOrders(
    page = 1,
    perPage = 100,
    modifiedAfter?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<WooCommercePaginatedResponse<WooCommerceOrder>> {
    const params: Record<string, string | number> = { page, per_page: perPage, orderby: "date", order: "asc", status: "any" };
    if (modifiedAfter) params.modified_after = modifiedAfter;
    if (dateFrom) params.after = dateFrom.includes("T") ? dateFrom : `${dateFrom}T00:00:00`;
    if (dateTo) params.before = dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59`;
    return this.paginatedRequest<WooCommerceOrder>("/orders", params);
  }

  getCategories(page = 1, perPage = 100): Promise<WooCommercePaginatedResponse<WooCommerceCategory>> {
    return this.paginatedRequest<WooCommerceCategory>("/products/categories", {
      page,
      per_page: perPage,
      orderby: "name",
      order: "asc",
      hide_empty: 0
    });
  }
}

export function parseWooCommerceCredentials(credentialsJson: string): { consumerKey: string; consumerSecret: string } | null {
  try {
    const parsed = JSON.parse(credentialsJson) as { consumerKey?: unknown; consumerSecret?: unknown };
    const consumerKey = typeof parsed.consumerKey === "string" ? parsed.consumerKey.trim() : "";
    const consumerSecret = typeof parsed.consumerSecret === "string" ? parsed.consumerSecret.trim() : "";
    return consumerKey && consumerSecret ? { consumerKey, consumerSecret } : null;
  } catch {
    return null;
  }
}
