// 🎉 互動模組庫 21 個元件的編輯器 schema 守護（CHITO 0541db39）
//
// 兩件事一起守：
//   ① 每個元件都有設定表單（沒有任何一個掉回唯讀 JSON 傾印）
//   ② schema 的欄位 key 必須真的被元件讀取 —— 這是「設定了卻沒效果」的
//      根源（例：activity_memo 預設寫 prompt，元件其實讀 keywordPrompt）
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { EVENT_MODULE_SCHEMAS } from "../eventModuleSchemas";
import { HOST_FIELD_SCHEMAS } from "../HostComponentEditor";
import { getDefaultConfig } from "../getDefaultConfig";

/** pageType → 玩家端元件實作檔（client/src/components/game/multi/*.tsx）*/
const IMPL: Record<string, string> = {
  spot_vote: "SpotVote",
  team_dream: "TeamDream",
  group_nickname: "GroupNickname",
  activity_memo: "ActivityMemo",
  peer_praise: "PeerPraise",
  scale_check: "ScaleCheck",
  venue_rating: "VenueRating",
  micro_commit: "MicroCommit",
  closing_thought: "ClosingThought",
  gift_to_team: "GiftToTeam",
  ability_badge: "AbilityBadge",
  wedding_vow: "WeddingVow",
  birthday_candle: "BirthdayCandle",
  award_ceremony: "AwardCeremony",
  gratitude_tree: "GratitudeTree",
  dinner_table: "DinnerTable",
  high_low_card: "HighLowCard",
  role_board: "RoleBoard",
  discovery_card: "DiscoveryCard",
  flag_design: "FlagDesign",
  party_menu: "PartyMenu",
};

/** 從元件原始碼抓出它實際讀取的 config key */
function configKeysOf(component: string): Set<string> {
  const path = resolve(__dirname, "../../../components/game/multi", `${component}.tsx`);
  if (!existsSync(path)) return new Set();
  const src = readFileSync(path, "utf8");
  const keys = new Set<string>();
  // raw.key / cfg.key / config?.key / config.key
  for (const m of src.matchAll(/\b(?:raw|cfg|config)\??\.([a-zA-Z][a-zA-Z0-9_]*)/g)) {
    keys.add(m[1]);
  }
  // interface XxxConfig { key?: type }
  const iface = src.match(/interface\s+\w*Config\s*\{([^}]*)\}/);
  if (iface) {
    for (const m of iface[1].matchAll(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\??\s*:/gm)) keys.add(m[1]);
  }
  return keys;
}

describe("互動模組庫編輯器 schema", () => {
  it("21 個元件全部有設定表單", () => {
    const missing = Object.keys(IMPL).filter((t) => !HOST_FIELD_SCHEMAS[t]);
    expect(missing, `沒有編輯器 schema（會退回唯讀 JSON）：${missing.join(", ")}`).toEqual([]);
    expect(Object.keys(EVENT_MODULE_SCHEMAS).sort()).toEqual(Object.keys(IMPL).sort());
  });

  it("schema 欄位都是元件真的會讀的 key（設了就要有效果）", () => {
    const problems: string[] = [];
    for (const [pageType, component] of Object.entries(IMPL)) {
      const known = configKeysOf(component);
      if (known.size === 0) {
        problems.push(`${pageType}: 找不到實作檔 ${component}.tsx`);
        continue;
      }
      for (const field of EVENT_MODULE_SCHEMAS[pageType] ?? []) {
        if (!known.has(field.key)) {
          problems.push(`${pageType}.${field.key}（${component}.tsx 沒讀這個 key）`);
        }
      }
    }
    expect(problems, `以下欄位設了不會生效：\n${problems.join("\n")}`).toEqual([]);
  });

  it("預設設定的 key 也要是元件讀得到的", () => {
    const problems: string[] = [];
    for (const [pageType, component] of Object.entries(IMPL)) {
      const known = configKeysOf(component);
      const preset = getDefaultConfig(pageType) as Record<string, unknown>;
      for (const key of Object.keys(preset)) {
        if (!known.has(key)) problems.push(`${pageType}.${key}（預設值寫了但 ${component}.tsx 不讀）`);
      }
    }
    expect(problems, `以下預設值無效：\n${problems.join("\n")}`).toEqual([]);
  });
});
