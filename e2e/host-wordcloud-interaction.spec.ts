/**
 * 🔤 詞雲「真互動」e2e — CHITO 790b1c33 迴歸防護
 *
 * 背景：玩家直接掃 QR 開 /play/:sessionId（免登入、template-market 主要動線）
 * 時沒有 LIFF query → chitoUserName 永遠是空 → 詞雲/抽獎/任務全部卡
 * 「請先設定玩家名稱」且沒有任何 UI 可設定 → 工具實際不可用。
 * 既有 host smoke 只驗「頁面載入不崩潰」，所以這個幽靈問題活了很久。
 *
 * 本 spec 驗完整互動鏈：
 *   玩家開頁 → 名稱閘門 → 送詞 → 大螢幕（WS role=host）真的收到 pulse
 *
 * 啟用條件：server 需 ENABLE_E2E_HELPERS=true（同 host-components-smoke）
 */
import { test, expect } from "@playwright/test";
import WebSocket from "ws";
import pg from "pg";

const HOST_TOKEN = "e2e-wordcloud-host-token";

let gameId = "";
let sessionId = "";

test.describe("🔤 詞雲完整互動（host 軸）", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/_test/seed-multi-game-with-page", {
      data: {
        pageType: "host_word_cloud",
        config: { title: "e2e 詞雲", maxWordsPerUser: 3 },
      },
    });
    const ctype = res.headers()["content-type"] ?? "";
    if (!res.ok() || !ctype.includes("application/json")) {
      test.skip(true, "_test endpoints 未啟用（需 ENABLE_E2E_HELPERS=true）");
      return;
    }
    const data = await res.json();
    gameId = data.gameId;
    sessionId = data.sessionId;

    // 大螢幕註冊需要 hostToken；seed 沒發，直接寫進測試 session
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `UPDATE game_sessions SET host_token=$1, host_token_expires_at=now()+interval '1 hour' WHERE id=$2`,
      [HOST_TOKEN, sessionId],
    );
    await pool.end();
  });

  test.afterAll(async ({ request }) => {
    if (gameId) await request.post(`/api/_test/cleanup/${gameId}`);
  });

  test("玩家掃 QR → 設名字 → 送詞 → 大螢幕收到", async ({ page, baseURL }) => {
    test.skip(!sessionId, "seed 未成功");

    // ── 大螢幕端：raw WS 以 role=host 註冊，收 pulse ──
    const wsUrl = `${baseURL!.replace(/^http/, "ws")}/ws`;
    const received: Array<{ pulseType: string; payload?: { word?: string } }> = [];
    const hostWs = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      hostWs.on("open", () => {
        hostWs.send(JSON.stringify({
          type: "host_screen_register",
          sessionId,
          hostToken: HOST_TOKEN,
          role: "host",
        }));
        resolve();
      });
      hostWs.on("error", reject);
    });
    // 模擬真大螢幕的職責：收到 pulse → 聚合 → 回播 host_screen_state。
    // 玩家端的「已送 N / M」計數就是吃這個回播；沒有它，計數與上限
    // 都不會動 —— 這也記錄了一個架構事實：大螢幕沒開時玩家端不限量。
    let hostError = "";
    const wordCounts: Record<string, number> = {};
    const submitters: Record<string, number> = {};
    hostWs.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "host_screen_error") hostError = `大螢幕註冊失敗: ${msg.message}`;
        if (msg.type !== "host_screen_pulse") return;
        received.push(msg);
        if (msg.pulseType === "submit" && msg.payload?.word) {
          const w = String(msg.payload.word);
          const u = String(msg.payload.userId ?? "unknown");
          wordCounts[w] = (wordCounts[w] ?? 0) + 1;
          submitters[u] = (submitters[u] ?? 0) + 1;
          // state 形狀必須完整（WordCloudState 四個欄位都要）——
          // 少 recentWords 會讓玩家端 render 直接炸掉
          hostWs.send(JSON.stringify({
            type: "host_screen_state",
            sessionId,
            state: {
              wordCounts,
              submitters,
              recentWords: [],
              totalSubmissions: Object.values(wordCounts).reduce((a, b) => a + b, 0),
            },
          }));
        }
      } catch { /* 非 JSON 忽略 */ }
    });

    // ── 玩家端 ──
    // 沒有名稱 UI 之前，這裡會跳 alert「請先設定玩家名稱」——有 alert 即失敗
    page.on("dialog", (d) => {
      throw new Error(`不該出現原生對話框：${d.message()}`);
    });

    await page.goto(`/play/${sessionId}`);

    // 名稱閘門（CHITO 790b1c33 修復的核心）
    const nameInput = page.getByTestId("input-guest-name");
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    // 預設已填「訪客XXXX」→ 一鍵進入
    await expect(nameInput).toHaveValue(/^訪客\d{4}$/);
    await page.getByTestId("button-guest-name-submit").click();

    // 詞雲玩家介面出現
    const wordInput = page.getByTestId("input-word");
    await expect(wordInput).toBeVisible({ timeout: 15_000 });

    // 送一個詞
    await wordInput.fill("好耶");
    await page.getByTestId("btn-word-submit").click();

    // 核心判準先驗：大螢幕真的收到（幽靈元件 = 只送出、沒人收到）
    await expect
      .poll(
        () => hostError || received.some((m) => m.pulseType === "submit" && m.payload?.word === "好耶"),
        { timeout: 10_000, message: "大螢幕端未收到玩家送出的詞" },
      )
      .toBe(true);
    expect(hostError, hostError).toBe("");

    // 玩家端計數吃大螢幕回播的 state（不綁 maxWordsPerUser 預設值）
    await expect(page.getByText(/已送 1 \//)).toBeVisible({ timeout: 10_000 });

    // 重新整理後名字保留（localStorage）、不再出現閘門
    await page.reload();
    await expect(page.getByTestId("input-word")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("input-guest-name")).toHaveCount(0);

    hostWs.close();
  });
});
