// 💳 Stripe Checkout — 用 fetch 直接打 Stripe API（W10 D1）
//
// 設計：不裝 stripe SDK，避免增加 npm dependency
// 只實作：建立 Checkout Session（一次性付費）
//
// 後續加 webhook 簽章驗證時可考慮裝 stripe SDK

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export interface CreateCheckoutInput {
  /** Stripe secret key（sk_test_* / sk_live_*）*/
  apiKey: string;
  /** 商品名稱 */
  productName: string;
  /** 商品描述（可選）*/
  productDescription?: string;
  /** 金額（單位：cents，台幣 NT$ 1 = 100 cents → 但 Stripe TWD 是 minor unit 為 1）*/
  amountCents: number;
  /** 幣別（"twd" / "usd"）*/
  currency?: "twd" | "usd";
  /** 成功跳轉 URL */
  successUrl: string;
  /** 取消跳轉 URL */
  cancelUrl: string;
  /** 客戶 email（可選，Stripe 會預填）*/
  customerEmail?: string;
  /** metadata（自訂資料、會在 webhook 取得）*/
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  id: string;
  url: string;
  paymentStatus: string;
}

/**
 * 建立 Stripe Checkout Session（一次性付費）
 *
 * @example
 *   const session = await createCheckoutSession({
 *     apiKey: process.env.STRIPE_SECRET_KEY!,
 *     productName: "婚禮派對情境包",
 *     amountCents: 600000,  // NT$ 6,000
 *     currency: "twd",
 *     successUrl: "https://game.homi.cc/pricing/success",
 *     cancelUrl: "https://game.homi.cc/pricing",
 *     metadata: { scenarioId: "wedding", adminId: "abc123" },
 *   });
 *   res.json({ checkoutUrl: session.url });
 */
export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<CheckoutSession> {
  const {
    apiKey,
    productName,
    productDescription,
    amountCents,
    currency = "twd",
    successUrl,
    cancelUrl,
    customerEmail,
    metadata,
  } = input;

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", successUrl);
  body.set("cancel_url", cancelUrl);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", currency);
  body.set("line_items[0][price_data][product_data][name]", productName);
  if (productDescription) {
    body.set("line_items[0][price_data][product_data][description]", productDescription);
  }
  body.set("line_items[0][price_data][unit_amount]", String(amountCents));
  if (customerEmail) {
    body.set("customer_email", customerEmail);
  }
  if (metadata) {
    for (const [k, v] of Object.entries(metadata)) {
      body.set(`metadata[${k}]`, String(v));
    }
  }

  const res = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Stripe API 錯誤 (${res.status}): ${errBody.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    id: string;
    url: string;
    payment_status: string;
  };

  return {
    id: json.id,
    url: json.url,
    paymentStatus: json.payment_status,
  };
}
