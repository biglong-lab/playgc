#!/usr/bin/env node
/**
 * 🆕 ADR-0004: HostScreen 元件腳手架
 *
 * 用途：解 R1 元件複雜度爆炸風險（從 2 小時/元件壓到 15 分鐘）
 *
 * 用法：
 *   node scripts/scaffold-host-component.mjs <ComponentName>
 *
 * 範例：
 *   node scripts/scaffold-host-component.mjs PollLive
 *
 * 會生成：
 *   - client/src/components/game/host/PollLive.tsx
 *   - client/src/components/game/host/PollLivePage.tsx
 *   - client/src/components/game/host/__tests__/PollLive.test.tsx
 *
 * 提醒（會 print 到 console）：
 *   1. 加 case "host_poll_live" 到 client/src/components/game/GamePageRenderer.tsx
 *   2. 確認 host_poll_live 在 shared/multiplayer-component-types.ts 的 HOST_ONLY_COMPONENTS（已預先加 8 個）
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("❌ 用法：node scripts/scaffold-host-component.mjs <ComponentName>");
  console.error("   範例：node scripts/scaffold-host-component.mjs PollLive");
  process.exit(1);
}

const componentName = args[0];

// PascalCase 驗證
if (!/^[A-Z][A-Za-z0-9]+$/.test(componentName)) {
  console.error(`❌ 元件名必須 PascalCase（例：PollLive、TriviaShowdown）`);
  process.exit(1);
}

// 自動生成 snake_case pageType（PollLive → host_poll_live）
// 若 componentName 已含 "Host" 前綴，先移除避免雙重 host_ prefix
const stripped = componentName.replace(/^Host/, "");
const finalName = stripped || componentName;
const pageType =
  "host_" +
  finalName
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");

// 中文標籤（簡單套表，admin 之後可改）
const labelGuess = `主控大螢幕：${componentName}`;

const baseDir = "client/src/components/game/host";
const componentPath = path.join(baseDir, `${componentName}.tsx`);
const pagePath = path.join(baseDir, `${componentName}Page.tsx`);
const testPath = path.join(baseDir, "__tests__", `${componentName}.test.tsx`);

// 防覆蓋
for (const p of [componentPath, pagePath, testPath]) {
  if (fs.existsSync(p)) {
    console.error(`❌ 檔案已存在：${p}`);
    console.error("   若要重建請先手動刪除");
    process.exit(1);
  }
}

// ════════════════════════════════════════════════════════════════════
// Templates
// ════════════════════════════════════════════════════════════════════

const componentTemplate = `// 📺 ${componentName} — HostScreen 元件
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// pageType: ${pageType}
//
// TODO（實作時補）：
//   - 大螢幕版型（hostMode=true 時的視覺）
//   - 玩家手機版型（hostMode=false 時的互動 UI）
//   - WS 訊息訂閱：host_screen_state（雙方同步）+ host_screen_pulse（玩家動作）

import { useEffect, useState } from "react";

interface ${componentName}Config {
  // TODO: 自訂 config 結構（admin 後台填的設定）
  /** 標題（顯示在大螢幕） */
  title?: string;
  /** 副標題 */
  subtitle?: string;
  // 加自訂欄位...
}

export interface ${componentName}Props {
  config: ${componentName}Config;
  /** 是否為大螢幕端（true）或玩家端（false） */
  hostMode: boolean;
  /** 從 WS 訂閱的 state（會被父層注入） */
  state?: unknown;
  /** 送 pulse 給大螢幕端（只玩家端用） */
  onPulse?: (pulseType: string, payload: unknown) => void;
  /** 廣播 state 給玩家端（只大螢幕端用） */
  onBroadcastState?: (state: unknown) => void;
}

export default function ${componentName}({ config, hostMode, state, onPulse, onBroadcastState }: ${componentName}Props) {
  const [localState, setLocalState] = useState<unknown>(state ?? null);

  useEffect(() => {
    if (state !== undefined) setLocalState(state);
  }, [state]);

  // ─────────────────────────────────────────────────────
  // 大螢幕版型（投影機 / 大電視）
  // ─────────────────────────────────────────────────────
  if (hostMode) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-8">
        <h1 className="text-5xl md:text-7xl font-display font-bold mb-4 text-center">
          {config.title ?? "${componentName}"}
        </h1>
        {config.subtitle && (
          <p className="text-xl md:text-2xl text-zinc-400 text-center">
            {config.subtitle}
          </p>
        )}
        {/* TODO: 大螢幕視覺 — 即時動畫 / 排行榜 / 倒數 / 大字題目等 */}
        <div className="mt-12 text-zinc-600 text-sm">
          [大螢幕版型佔位 — 實作時替換]
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // 玩家手機版型
  // ─────────────────────────────────────────────────────
  return (
    <div className="w-full p-4 space-y-4">
      <h2 className="text-xl font-bold text-center">
        {config.title ?? "${componentName}"}
      </h2>
      {config.subtitle && (
        <p className="text-sm text-muted-foreground text-center">{config.subtitle}</p>
      )}
      {/* TODO: 玩家互動 UI — 投票按鈕 / 答題卡 / emoji 選擇等
          點擊時呼叫 onPulse?.(pulseType, payload) */}
      <div className="text-center text-sm text-muted-foreground py-8">
        [玩家版型佔位 — 實作時替換]
      </div>
    </div>
  );
}
`;

const pageTemplate = `// 📺 ${componentName}Page — GamePageRenderer 用此元件對應 pageType="${pageType}"
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// 取得 hostMode：根據 URL 路徑（/host/* → true，/play/* → false）

import { useEffect, useState, useRef } from "react";
import ${componentName} from "./${componentName}";
import type { Page } from "@shared/schema";

interface ${componentName}PageProps {
  page: Page;
}

export default function ${componentName}Page({ page }: ${componentName}PageProps) {
  // 從路徑判斷是大螢幕還是玩家端
  const isHostMode = window.location.pathname.startsWith("/host/");
  const [state, setState] = useState<unknown>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 訂閱父層（HostScreen / HostPlay）的 WS 訊息
  // 實作策略：透過 window event 或父層 context 取得 ws ref
  // TODO: Phase 1 W2 — 統一 host WS 取得機制
  // 目前簡化：讓元件自己連 ws（PollLive 等真正實作時會抽 hook 出來）

  return (
    <${componentName}
      config={(page.content as { config?: any })?.config ?? {}}
      hostMode={isHostMode}
      state={state}
      onPulse={(pulseType, payload) => {
        wsRef.current?.send(JSON.stringify({
          type: "host_screen_pulse",
          sessionId: getHostSessionIdFromUrl(),
          pulseType,
          payload,
        }));
      }}
      onBroadcastState={(newState) => {
        setState(newState);
        wsRef.current?.send(JSON.stringify({
          type: "host_screen_state",
          sessionId: getHostSessionIdFromUrl(),
          state: newState,
        }));
      }}
    />
  );
}

function getHostSessionIdFromUrl(): string {
  const match = window.location.pathname.match(/^\\/(host|play)\\/([^/]+)/);
  return match?.[2] ?? "";
}
`;

const testTemplate = `import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ${componentName} from "../${componentName}";

describe("${componentName}", () => {
  it("hostMode=true 時顯示大螢幕版型", () => {
    render(
      <${componentName}
        config={{ title: "測試標題" }}
        hostMode={true}
      />,
    );
    expect(screen.getByText("測試標題")).toBeInTheDocument();
  });

  it("hostMode=false 時顯示玩家版型", () => {
    render(
      <${componentName}
        config={{ title: "玩家版" }}
        hostMode={false}
      />,
    );
    expect(screen.getByText("玩家版")).toBeInTheDocument();
  });

  // TODO: 補測試
  //   - WS state 注入時 UI 變化
  //   - onPulse 被呼叫時的 payload 結構
  //   - 各 config 欄位的 fallback
});
`;

// ════════════════════════════════════════════════════════════════════
// Write files
// ════════════════════════════════════════════════════════════════════

fs.mkdirSync(path.dirname(componentPath), { recursive: true });
fs.mkdirSync(path.dirname(testPath), { recursive: true });

fs.writeFileSync(componentPath, componentTemplate);
fs.writeFileSync(pagePath, pageTemplate);
fs.writeFileSync(testPath, testTemplate);

console.log("");
console.log(`✅ ${componentName} 四件套已建立：`);
console.log(`   📄 ${componentPath}`);
console.log(`   📄 ${pagePath}`);
console.log(`   📄 ${testPath}`);
console.log("");
console.log(`📋 接下來請手動：`);
console.log("");
console.log(`1. 在 client/src/components/game/GamePageRenderer.tsx 加 case：`);
console.log(`   case "${pageType}":`);
console.log(`     return <${componentName}Page page={page} />;`);
console.log("");
console.log(`2. 確認 ${pageType} 已在 shared/multiplayer-component-types.ts`);
console.log(`   的 HOST_ONLY_COMPONENTS 內（W1 D2 已預加 8 個）`);
console.log("");
console.log(`3. 替換 TODO 區段為實際業務邏輯`);
console.log(`4. 補單元測試（≥ 5 個 case）`);
console.log(`5. npm run check 驗證 TypeScript`);
console.log(`6. npm run test:run 驗證測試通過`);
console.log("");
console.log(`📚 設計依據：docs/decisions/0004-host-screen-axis.md`);
console.log(`💡 標籤建議：${labelGuess}`);
console.log("");
