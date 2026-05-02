// 📦 CHITO API v1 — TypeScript SDK
//
// 用法：
//   import { ChitoClient } from "@chito/api-client";
//   const chito = new ChitoClient({ apiKey: "ck_test_xxx" });
//   const scenarios = await chito.scenarios.list();
//   const instance = await chito.instances.create({ scenarioId: "wedding" });

import type {
  Scenario,
  ScenarioListItem,
  Instance,
  ApiKeyMetadata,
  ScenarioCategory,
  ScenarioStatus,
} from "./types";

export * from "./types";

const DEFAULT_BASE_URL = "https://game.homi.cc/api/v1";

export interface ChitoClientOptions {
  /** API key（ck_test_* / ck_live_*）*/
  apiKey: string;
  /** Base URL，預設 production */
  baseUrl?: string;
  /** 自訂 fetch 實作（測試用 / Node < 18 polyfill）*/
  fetch?: typeof globalThis.fetch;
}

export interface InstanceCreateInput {
  scenarioId: string;
  displayName?: string;
  customerEmail?: string;
  /** 24 小時內相同 key 重發回相同結果 */
  idempotencyKey?: string;
}

export interface ListScenariosInput {
  status?: ScenarioStatus;
  category?: ScenarioCategory;
}

/**
 * CHITO Public API v1 client
 */
export class ChitoClient {
  private apiKey: string;
  private baseUrl: string;
  private fetcher: typeof globalThis.fetch;

  constructor(options: ChitoClientOptions) {
    if (!options.apiKey) throw new Error("apiKey 為必要參數");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  // ════════════════════════════════════════════════════════
  // Resource: scenarios
  // ════════════════════════════════════════════════════════

  scenarios = {
    list: async (input?: ListScenariosInput): Promise<{ object: "list"; total: number; data: ScenarioListItem[] }> => {
      const url = new URL(`${this.baseUrl}/scenarios`);
      if (input?.status) url.searchParams.set("status", input.status);
      if (input?.category) url.searchParams.set("category", input.category);
      return this.request("GET", url.toString());
    },

    get: async (id: string): Promise<Scenario> => {
      return this.request("GET", `${this.baseUrl}/scenarios/${encodeURIComponent(id)}`);
    },
  };

  // ════════════════════════════════════════════════════════
  // Resource: instances
  // ════════════════════════════════════════════════════════

  instances = {
    create: async (input: InstanceCreateInput): Promise<Instance> => {
      const headers: Record<string, string> = {};
      if (input.idempotencyKey) headers["Idempotency-Key"] = input.idempotencyKey;
      return this.request(
        "POST",
        `${this.baseUrl}/instances`,
        {
          scenarioId: input.scenarioId,
          displayName: input.displayName,
          customerEmail: input.customerEmail,
        },
        headers,
      );
    },
  };

  // ════════════════════════════════════════════════════════
  // Resource: keys
  // ════════════════════════════════════════════════════════

  keys = {
    me: async (): Promise<ApiKeyMetadata> => {
      return this.request("GET", `${this.baseUrl}/keys/me`);
    },
  };

  // ════════════════════════════════════════════════════════
  // Resource: webhooks
  // ════════════════════════════════════════════════════════

  webhooks = {
    test: async (): Promise<{
      object: "webhook_test";
      dispatched: boolean;
      url: string;
      eventType: string;
      message: string;
    }> => {
      return this.request("POST", `${this.baseUrl}/webhooks/test`, {});
    },
  };

  // ════════════════════════════════════════════════════════
  // Resource: meta
  // ════════════════════════════════════════════════════════

  health = async (): Promise<{ status: string; version: string; timestamp: string }> => {
    // health 不需 key，但用同一個 fetcher
    const res = await this.fetcher(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error(`health failed: ${res.status}`);
    return res.json() as Promise<{ status: string; version: string; timestamp: string }>;
  };

  // ════════════════════════════════════════════════════════
  // 共用 fetch helper
  // ════════════════════════════════════════════════════════

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      ...extraHeaders,
    };
    if (body) headers["Content-Type"] = "application/json";

    const res = await this.fetcher(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: { code: "invalid_json", message: text.slice(0, 200) } };
    }

    if (!res.ok) {
      const err = data as { error?: { code: string; message: string } };
      const code = err?.error?.code ?? "unknown_error";
      const message = err?.error?.message ?? `HTTP ${res.status}`;
      throw new ChitoApiError(message, code, res.status);
    }

    return data as T;
  }
}

// ════════════════════════════════════════════════════════════
// Error class
// ════════════════════════════════════════════════════════════

export class ChitoApiError extends Error {
  public code: string;
  public status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ChitoApiError";
    this.code = code;
    this.status = status;
  }
}
