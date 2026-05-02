// 📖 ApiDocs — Public API 文件頁（W11 D4）
//
// 路徑：/api-docs（公開、給代理商看）
// 用途：API 介紹 + curl 範例 + OpenAPI 規格下載

import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, ExternalLink, Code, Shield, Zap, Repeat } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://game.homi.cc";

const CURL_EXAMPLES = {
  health: `curl ${BASE_URL}/api/v1/health`,
  listScenarios: `curl -H "Authorization: Bearer ck_test_xxx" \\
  ${BASE_URL}/api/v1/scenarios?status=live`,
  scenarioDetail: `curl -H "Authorization: Bearer ck_test_xxx" \\
  ${BASE_URL}/api/v1/scenarios/wedding`,
  createInstance: `curl -X POST ${BASE_URL}/api/v1/instances \\
  -H "Authorization: Bearer ck_test_xxx" \\
  -H "Idempotency-Key: agency-order-001" \\
  -H "Content-Type: application/json" \\
  -d '{
    "scenarioId": "wedding",
    "displayName": "Hung & Anita 5/15 婚禮",
    "customerEmail": "couple@example.com"
  }'`,
};

export default function ApiDocs() {
  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `✅ 已複製 ${label}` });
    } catch {
      toast({ title: "❌ 複製失敗", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b safe-top">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="p-2 hover:bg-muted rounded-lg" data-testid="btn-back">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="font-display font-bold text-lg">📖 API 文件</h1>
              <p className="text-xs text-muted-foreground">CHITO Public API v1</p>
            </div>
          </div>
          <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" data-testid="btn-openapi">
              <Code className="w-4 h-4 mr-1" />
              OpenAPI JSON
            </Button>
          </a>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-12">
        {/* Hero */}
        <section className="text-center space-y-4 py-8">
          <h2 className="text-3xl md:text-5xl font-display font-bold">
            CHITO <span className="text-primary">Public API v1</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            讓代理商整合 CHITO 12 情境模板、自動建場 — 客戶不用離開您的網站
          </p>
          <div className="flex justify-center gap-2 pt-2 flex-wrap">
            <Badge variant="secondary"><Shield className="w-3 h-3 mr-1" />Bearer Auth</Badge>
            <Badge variant="secondary"><Zap className="w-3 h-3 mr-1" />60 req/min</Badge>
            <Badge variant="secondary"><Repeat className="w-3 h-3 mr-1" />Idempotent</Badge>
          </div>
        </section>

        {/* 認證 */}
        <Section title="🔑 認證" icon={Shield}>
          <p className="text-sm">
            所有需認證的 endpoint 都用 <strong>Bearer token</strong>：
          </p>
          <CodeBlock onCopy={handleCopy}>{`Authorization: Bearer ck_test_xxx`}</CodeBlock>
          <p className="text-sm">
            API key 格式：
          </p>
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            <li><code className="bg-muted px-1 rounded">ck_test_*</code> — 測試環境（不建立真實 game）</li>
            <li><code className="bg-muted px-1 rounded">ck_live_*</code> — 生產環境（建立真實 game）</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            如何取得？聯絡 CHITO 業務（LINE / Email），審核後提供。
          </p>
        </Section>

        {/* 速率限制 */}
        <Section title="🚦 速率限制" icon={Zap}>
          <p className="text-sm">每個 API key 每分鐘最多 60 個請求。</p>
          <p className="text-sm">回應 headers：</p>
          <CodeBlock onCopy={handleCopy}>{`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1735693200
Retry-After: 35  # 達上限時`}</CodeBlock>
          <p className="text-sm text-muted-foreground">
            超過上限回 <code className="bg-muted px-1 rounded">429</code> + 結構化 error，請依 Retry-After 退避。
          </p>
        </Section>

        {/* Idempotency */}
        <Section title="🔁 Idempotency" icon={Repeat}>
          <p className="text-sm">
            POST 端點可帶 <code className="bg-muted px-1 rounded">Idempotency-Key</code> header，
            24 小時內相同 key 重發回相同結果（含原 status code）。
          </p>
          <p className="text-sm">用途：網路不穩重試、避免重複建場 / 扣款。</p>
          <p className="text-sm text-muted-foreground">
            cache 隔離：不同 API key 用同一個 idempotency key 視為不同請求。
          </p>
        </Section>

        {/* Endpoints */}
        <Section title="🌐 Endpoints" icon={Code}>
          <p className="text-sm text-muted-foreground">
            完整規格請看 <a href="/api/v1/openapi.json" className="underline" target="_blank" rel="noopener noreferrer">OpenAPI JSON</a> 或匯入 Postman / Insomnia。
          </p>
          <EndpointBlock
            method="GET"
            path="/api/v1/health"
            note="公開、不需認證"
            example={CURL_EXAMPLES.health}
            onCopy={handleCopy}
          />
          <EndpointBlock
            method="GET"
            path="/api/v1/scenarios"
            note="列出 12 情境（可加 ?status=live / ?category=social 過濾）"
            example={CURL_EXAMPLES.listScenarios}
            onCopy={handleCopy}
          />
          <EndpointBlock
            method="GET"
            path="/api/v1/scenarios/:id"
            note="單一情境詳情（含完整元件清單）"
            example={CURL_EXAMPLES.scenarioDetail}
            onCopy={handleCopy}
          />
          <EndpointBlock
            method="POST"
            path="/api/v1/instances"
            note="一鍵建場（為情境的所有元件建立 game + page + host_session）"
            example={CURL_EXAMPLES.createInstance}
            onCopy={handleCopy}
            highlight
          />
        </Section>

        {/* Error format */}
        <Section title="⚠️ Error 格式" icon={Shield}>
          <p className="text-sm">所有 error 回應統一格式：</p>
          <CodeBlock onCopy={handleCopy}>{`{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "每分鐘最多 60 個請求...",
    "documentation_url": "https://game.homi.cc/api-docs"
  }
}`}</CodeBlock>
          <p className="text-sm">常見 error code：</p>
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            <li><code className="bg-muted px-1 rounded">missing_api_key</code> — 401</li>
            <li><code className="bg-muted px-1 rounded">invalid_api_key</code> — 401</li>
            <li><code className="bg-muted px-1 rounded">scenario_not_found</code> — 404</li>
            <li><code className="bg-muted px-1 rounded">rate_limit_exceeded</code> — 429</li>
            <li><code className="bg-muted px-1 rounded">api_key_not_mapped_to_field</code> — 400</li>
          </ul>
        </Section>

        {/* SDK */}
        <Section title="📦 TypeScript SDK" icon={Code}>
          <p className="text-sm">
            提供 minimal TypeScript SDK（含完整 type definitions），代理商可直接整合：
          </p>
          <CodeBlock onCopy={handleCopy}>{`import { ChitoClient } from "@chito/api-client";

const chito = new ChitoClient({
  apiKey: process.env.CHITO_API_KEY!,
});

// 列出情境
const { data } = await chito.scenarios.list({ status: "live" });

// 一鍵建場
const instance = await chito.instances.create({
  scenarioId: "wedding",
  displayName: "Hung & Anita 5/15 婚禮",
  idempotencyKey: \`order-\${orderId}\`,
});

console.log(instance.components); // hostUrl / playUrl / gameUrl`}</CodeBlock>
          <p className="text-sm text-muted-foreground">
            完整文件 + 安裝指引：
            <a href="https://github.com/biglong-lab/playgc/tree/main/sdk/typescript" className="underline ml-1" target="_blank" rel="noopener noreferrer">
              GitHub sdk/typescript
            </a>
          </p>
        </Section>

        {/* CTA */}
        <section className="text-center space-y-3 py-8">
          <h3 className="font-display font-bold text-lg">想成為代理商？</h3>
          <p className="text-sm text-muted-foreground">
            聯絡業務（LINE / Email）申請 API key + 場域綁定
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/pitch"><Button variant="outline">看完整介紹</Button></Link>
            <Link href="/template-market"><Button variant="outline">看 12 情境</Button></Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        CHITO Public API v1 · OpenAPI 3.1 · 12 情境模板
      </footer>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Shield;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CodeBlock({
  children,
  onCopy,
}: {
  children: string;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="relative bg-muted/60 rounded-lg p-3 group">
      <pre className="text-xs md:text-sm overflow-x-auto"><code>{children}</code></pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onCopy(children, "code")}
      >
        <Copy className="w-3 h-3" />
      </Button>
    </div>
  );
}

function EndpointBlock({
  method,
  path,
  note,
  example,
  onCopy,
  highlight,
}: {
  method: string;
  path: string;
  note: string;
  example: string;
  onCopy: (text: string, label: string) => void;
  highlight?: boolean;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    POST: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
  return (
    <Card className={highlight ? "border-primary border-2" : ""}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={methodColors[method] ?? ""}>{method}</Badge>
          <code className="text-sm font-medium">{path}</code>
          {highlight && <Badge variant="outline" className="text-xs">推薦</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{note}</p>
        <CodeBlock onCopy={onCopy}>{example}</CodeBlock>
      </CardContent>
    </Card>
  );
}
