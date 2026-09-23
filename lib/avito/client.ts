type JsonObject = Record<string, unknown>;

export type AvitoCredentials = {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
};

export type AvitoSelf = {
  id: number | string;
  name?: string;
  email?: string;
  phone?: string;
  profile_url?: string;
  [key: string]: unknown;
};

export type AvitoItem = {
  id: number | string;
  title?: string;
  status?: string;
  category?: unknown;
  url?: string;
  price?: number;
  [key: string]: unknown;
};

export type AvitoItemStats = Record<string, unknown>;

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`Missing required environment variable: ${name}`);
  return trimmed;
}

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export class AvitoApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "AvitoApiError";
  }
}

export class AvitoClient {
  private readonly baseUrl: string;
  private accessToken: string | null = null;

  constructor(private readonly credentials: AvitoCredentials) {
    this.baseUrl = (credentials.baseUrl || "https://api.avito.ru").replace(/\/$/, "");
  }

  static fromEnv(): AvitoClient {
    return new AvitoClient({
      clientId: required(process.env.AVITO_CLIENT_ID, "AVITO_CLIENT_ID"),
      clientSecret: required(process.env.AVITO_CLIENT_SECRET, "AVITO_CLIENT_SECRET"),
      baseUrl: process.env.AVITO_API_BASE_URL?.trim() || undefined,
    });
  }

  private async json<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, init);
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!response.ok) {
      throw new AvitoApiError(
        `Avito API request failed: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }
    return body as T;
  }

  async token(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
    });

    const token = await this.json<{ access_token?: string }>(`${this.baseUrl}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!token.access_token) throw new Error("Avito token response did not contain access_token");
    this.accessToken = token.access_token;
    return this.accessToken;
  }

  private async authorized<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await this.token();
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${accessToken}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return this.json<T>(`${this.baseUrl}${path}`, { ...init, headers });
  }

  async getSelf(): Promise<AvitoSelf> {
    return this.authorized<AvitoSelf>("/core/v1/accounts/self");
  }

  async listItems(params: { status?: string; perPage?: number; page?: number } = {}): Promise<{
    items: AvitoItem[];
    raw: unknown;
  }> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    qs.set("per_page", String(params.perPage ?? 100));
    qs.set("page", String(params.page ?? 1));

    const raw = await this.authorized<unknown>(`/core/v1/items?${qs.toString()}`);
    const obj = asObject(raw);
    const result = asObject(obj.result);
    const items = (
      asArray(obj.resources).length ? asArray(obj.resources)
      : asArray(obj.items).length ? asArray(obj.items)
      : asArray(result.items).length ? asArray(result.items)
      : asArray(result.resources)
    ).filter((item): item is AvitoItem => Boolean(item && typeof item === "object" && "id" in (item as JsonObject)));

    return { items, raw };
  }

  async getItemInfo(userId: string | number, itemId: string | number): Promise<unknown> {
    return this.authorized(`/core/v1/accounts/${encodeURIComponent(String(userId))}/items/${encodeURIComponent(String(itemId))}/`);
  }

  async getBalance(userId: string | number): Promise<unknown> {
    return this.authorized(`/core/v1/accounts/${encodeURIComponent(String(userId))}/balance/`);
  }

  async getSpendings(
    userId: string | number,
    dateFrom: string,
    dateTo: string,
    itemIds?: Array<string | number>,
  ): Promise<unknown> {
    const filter = itemIds?.length
      ? { itemIDs: itemIds.map((id) => Number.isNaN(Number(id)) ? id : Number(id)) }
      : undefined;
    return this.authorized(
      `/stats/v2/accounts/${encodeURIComponent(String(userId))}/spendings`,
      {
        method: "POST",
        body: JSON.stringify({
          dateFrom,
          dateTo,
          grouping: "month",
          spendingTypes: ["all"],
          ...(filter ? { filter } : {}),
        }),
      },
    );
  }

  async getItemStats(
    userId: string | number,
    itemIds: Array<string | number>,
    dateFrom: string,
    dateTo: string,
  ): Promise<unknown> {
    return this.authorized(
      `/stats/v1/accounts/${encodeURIComponent(String(userId))}/items`,
      {
        method: "POST",
        body: JSON.stringify({
          dateFrom,
          dateTo,
          itemIds: itemIds.map((id) => Number.isNaN(Number(id)) ? id : Number(id)),
        }),
      },
    );
  }
}
