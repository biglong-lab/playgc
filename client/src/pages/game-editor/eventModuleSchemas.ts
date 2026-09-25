// 🎉 互動模組庫（21 個活動互動元件）設定欄位定義 — CHITO 0541db39
//
// 背景：這批元件在編輯器全部掉進 default 分支 = 唯讀 JSON 傾印
//   （管理員看到的是 {"title": "活動筆記", "prompt": "…"} 而不是輸入框）。
//   欄位定義照各元件實際讀取的 config 介面（client/src/components/game/multi/*.tsx），
//   由 SchemaConfigEditor 的通用表單產生器渲染。
//
// 維護規則：元件新增可設定欄位時，同步在這裡加一行；欄位 key 必須與
//   元件 extractConfig 讀的 key 完全相同，否則設了也不會生效。
import type { FieldDef } from "./SchemaConfigEditor";

/** 共用：標題 + 引導語（多數互動元件只有這兩個欄位）*/
const titleAndPrompt = (promptLabel = "引導語", promptHint?: string): FieldDef[] => [
  { kind: "text", key: "title", label: "標題", placeholder: "顯示在頁面最上方" },
  {
    kind: "textarea",
    key: "prompt",
    label: promptLabel,
    placeholder: promptHint ?? "告訴玩家這一頁要做什麼",
  },
];

export const EVENT_MODULE_SCHEMAS: Record<string, FieldDef[]> = {
  // ── 投票 / 選擇型 ────────────────────────────
  spot_vote: [
    ...titleAndPrompt("題目"),
    {
      kind: "object-list",
      key: "spots",
      label: "候選選項",
      itemLabel: "選項",
      columns: [
        { key: "emoji", label: "圖示", type: "text", width: "w-20", placeholder: "🏖️" },
        { key: "name", label: "名稱", type: "text" },
        { key: "desc", label: "說明", type: "text", width: "flex-[2]" },
      ],
      fromRow: (row, idx) => ({
        id: String(row.id ?? `spot-${idx + 1}`),
        name: String(row.name ?? ""),
        emoji: String(row.emoji ?? ""),
        desc: String(row.desc ?? ""),
      }),
      newRow: (i) => ({ id: `spot-${i + 1}`, name: "", emoji: "", desc: "" }),
      hint: "留空不設定 → 玩家端顯示內建的 6 個示範選項",
    },
  ],

  // ── 文字輸入型（有 placeholder / 字數限制）──────
  team_dream: [
    ...titleAndPrompt(),
    { kind: "text", key: "placeholder", label: "輸入框提示文字" },
    { kind: "number", key: "maxLength", label: "字數上限", min: 10, max: 500 },
  ],
  group_nickname: [
    ...titleAndPrompt(),
    { kind: "text", key: "placeholder", label: "輸入框提示文字" },
  ],
  discovery_card: [
    ...titleAndPrompt(),
    { kind: "text", key: "placeholder", label: "輸入框提示文字" },
  ],

  // ── 雙欄輸入型 ──────────────────────────────
  activity_memo: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "textarea", key: "keywordPrompt", label: "關鍵字題目", placeholder: "今天最有印象的事是什麼？" },
    { kind: "text", key: "keywordPlaceholder", label: "關鍵字輸入框提示" },
    { kind: "textarea", key: "actionPrompt", label: "行動題目", placeholder: "回去以後你想做什麼？" },
    { kind: "text", key: "actionPlaceholder", label: "行動輸入框提示" },
  ],
  high_low_card: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "textarea", key: "highPrompt", label: "高峰題目" },
    { kind: "text", key: "highPlaceholder", label: "高峰輸入框提示" },
    { kind: "textarea", key: "lowPrompt", label: "低谷題目" },
    { kind: "text", key: "lowPlaceholder", label: "低谷輸入框提示" },
  ],
  peer_praise: [
    ...titleAndPrompt(),
    { kind: "text", key: "recipientPlaceholder", label: "對象輸入框提示" },
    { kind: "text", key: "messagePlaceholder", label: "讚美內容輸入框提示" },
  ],

  // ── 量表 / 評分型 ───────────────────────────
  scale_check: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "textarea", key: "question", label: "題目" },
    { kind: "text", key: "minLabel", label: "最低分標籤", placeholder: "例：很低落" },
    { kind: "text", key: "maxLabel", label: "最高分標籤", placeholder: "例：超有精神" },
  ],
  venue_rating: [
    { kind: "text", key: "title", label: "標題" },
    { kind: "text", key: "venueName", label: "場地名稱", placeholder: "顯示在評分項目上方" },
  ],

  // ── 只有標題 + 引導語 ────────────────────────
  micro_commit: titleAndPrompt(),
  closing_thought: titleAndPrompt(),
  gift_to_team: titleAndPrompt(),
  ability_badge: titleAndPrompt(),
  wedding_vow: titleAndPrompt(),
  birthday_candle: titleAndPrompt(),
  award_ceremony: titleAndPrompt(),
  gratitude_tree: titleAndPrompt(),
  dinner_table: titleAndPrompt(),
  role_board: titleAndPrompt(),
  flag_design: titleAndPrompt(),
  party_menu: titleAndPrompt(),
};
