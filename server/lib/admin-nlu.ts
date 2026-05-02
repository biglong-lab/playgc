// 🧠 Admin NLU — DeepSeek 解析 admin 自然語言指令（W15 D3）
//
// 用途：admin 在 LINE 對 Bot 說「@chito 婚禮 Hung & Anita 5/15」
//      DeepSeek 解析 → 結構化指令 → 後續觸發 instantiate
//
// 支援指令：
//   - create_scenario：建立情境實例
//   - help：顯示用法
//   - unknown：無法解析

import { callOpenRouter, safeParseAiJson } from "./openrouter";
import { SCENARIO_TEMPLATES } from "@shared/scenario-templates";

const DEFAULT_MODEL = "deepseek/deepseek-chat";

export type AdminCommandIntent =
  | "create_scenario"
  | "help"
  | "list_scenarios"
  | "unknown";

export interface AdminCommand {
  intent: AdminCommandIntent;
  /** 情境 ID（intent=create_scenario 時必有）*/
  scenarioId?: string;
  /** 顯示名稱（intent=create_scenario 時可選）*/
  displayName?: string;
  /** AI 解析說明（給 admin 確認）*/
  rationale?: string;
  /** 原始輸入 */
  rawInput: string;
}

/**
 * 解析 admin 自然語言指令
 *
 * @example
 *   const cmd = await parseAdminCommand({
 *     apiKey: process.env.OPENROUTER_API_KEY!,
 *     text: "@chito 婚禮 Hung & Anita 5/15"
 *   });
 *   // → { intent: "create_scenario", scenarioId: "wedding", displayName: "Hung & Anita 5/15 婚禮" }
 */
export async function parseAdminCommand(input: {
  apiKey: string;
  text: string;
  model?: string;
}): Promise<AdminCommand> {
  const { apiKey, text, model = DEFAULT_MODEL } = input;

  const cleaned = text.replace(/^@chito\s*/i, "").trim();
  if (!cleaned) {
    return { intent: "help", rawInput: text };
  }

  // help 指令快速路徑（不耗 AI）
  if (/^(help|幫助|說明|？|\?)$/i.test(cleaned)) {
    return { intent: "help", rawInput: text };
  }

  // list 指令快速路徑
  if (/^(list|清單|有什麼|有哪些)$/i.test(cleaned)) {
    return { intent: "list_scenarios", rawInput: text };
  }

  // 用 DeepSeek 解析其他自然語言
  const scenarioList = SCENARIO_TEMPLATES.filter((s) => s.status === "live")
    .map((s) => `- ${s.id}: ${s.name}（${s.tagline}）`)
    .join("\n");

  const prompt = `你是 admin 指令解析助手。把使用者輸入解析為結構化 JSON。

可用情境：
${scenarioList}

使用者輸入：「${cleaned}」

回傳 JSON：
{
  "intent": "create_scenario" | "help" | "list_scenarios" | "unknown",
  "scenarioId": "<id from list above>" (intent=create_scenario 時必有),
  "displayName": "<活動名稱、含人名 / 日期>" (intent=create_scenario 時可選),
  "rationale": "<為什麼這樣解析>"
}

規則：
1. 如果輸入提到「婚禮 / wedding」→ scenarioId="wedding"
2. 如果輸入提到「破冰 / icebreaker」→ scenarioId="icebreaker"
3. 如果輸入提到「同學會 / reunion」→ scenarioId="reunion"
4. 如果輸入提到「街區 / 走讀」→ scenarioId="street-walk"
5. 如果輸入提到「企業內訓 / training」→ scenarioId="corporate-training"
6. 抽取人名 / 日期組合 displayName（如「Hung & Anita 5/15」→ displayName="Hung & Anita 5/15 婚禮"）
7. 找不到對應情境 → intent="unknown"

直接回 JSON、不要 markdown：`;

  try {
    const raw = await callOpenRouter(apiKey, model, [{ role: "user", content: prompt }], true);
    const parsed = safeParseAiJson<{
      intent: AdminCommandIntent;
      scenarioId?: string;
      displayName?: string;
      rationale?: string;
    }>(raw, "admin-command");

    return {
      intent: parsed.intent ?? "unknown",
      scenarioId: parsed.scenarioId,
      displayName: parsed.displayName,
      rationale: parsed.rationale,
      rawInput: text,
    };
  } catch (err) {
    console.error("[admin-nlu] 解析失敗:", err);
    return { intent: "unknown", rationale: "AI 解析失敗", rawInput: text };
  }
}

/**
 * 把解析結果格式化為 LINE 回覆訊息
 */
export function formatCommandReply(cmd: AdminCommand): string {
  switch (cmd.intent) {
    case "help":
      return (
        `📖 CHITO admin 指令說明\n\n` +
        `常用指令：\n` +
        `  @chito 婚禮 Hung & Anita 5/15\n` +
        `  @chito 破冰 公司新人訓\n` +
        `  @chito 同學會 政大畢業 20 週年\n` +
        `  @chito list（看所有情境）\n\n` +
        `12 情境：婚禮 / 生日 / 同學會 / 親子 / 園遊會 / 破冰 / 頒獎 / 街區 / 商圈 / 內訓 / 旅遊 / 場域`
      );

    case "list_scenarios": {
      const list = SCENARIO_TEMPLATES.filter((s) => s.status === "live")
        .map((s) => `  • ${s.id} — ${s.name}`)
        .join("\n");
      return `📦 情境清單：\n\n${list}\n\n💡 用法：@chito <情境名> <活動描述>`;
    }

    case "create_scenario":
      return (
        `✅ 解析成功（W15 D3 預覽，未實際建場）\n\n` +
        `📦 情境：${cmd.scenarioId}\n` +
        `📝 名稱：${cmd.displayName || "（未指定）"}\n` +
        `💡 說明：${cmd.rationale || "（無）"}\n\n` +
        `（W15 D5 完成 admin 認證 + 自動建場後，此指令會直接生效）`
      );

    case "unknown":
    default:
      return (
        `❓ 我不太明白您的指令。\n\n` +
        `試試：「@chito help」看用法。`
      );
  }
}
