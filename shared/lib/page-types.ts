// 🧩 可發佈的頁面類型（2026-09-23，前後端共用）
//
// = 玩家端渲染器（GamePageRenderer）實際支援的元件。
// 2026-09-25：大螢幕（host_*）元件已整條移交 PhotoGo（ADR-0029），不再是可發佈類型。
// 不在清單內的 pageType 玩家會看到「未知頁面類型」→ 發佈前擋下。
// 守護測試 client/src/components/game/__tests__/playable-page-types.guard.test.ts
// 會比對渲染器 switch case：新增元件時要同步加在這裡，否則 CI 紅。

export const PLAYABLE_PAGE_TYPES = [
  // 基礎內容
  "text_card", "dialogue", "video", "button", "flow_router",
  // 驗證 / 解謎
  "text_verify", "choice_verify", "choice_verify_race", "conditional_verify",
  "lock", "lock_coop", "time_bomb", "memory_match", "jigsaw_puzzle", "flashlight",
  // 位置 / QR / 硬體
  "gps_mission", "gps_team_mission", "gps_cascade", "qr_scan", "treasure_hunt",
  "territory_capture", "quest_chain", "motion_challenge", "shooting_mission", "shooting_team",
  // 拍照
  "photo_mission", "photo_spot", "photo_compare", "photo_ar", "photo_ocr",
  "photo_burst", "photo_before_after", "photo_team",
  // 團隊協作
  "vote", "vote_team", "relay_mission", "role_assign", "role_board", "collective_score",
  "team_dream", "team_pact", "team_health_check", "team_radar", "group_nickname",
  "gift_to_team", "peer_praise", "ability_badge", "flag_design", "mad_libs",
  // 交誼 / 破冰
  "check_in", "two_truths", "would_you_rather", "never_have_i_ever", "high_low_card",
  "speed_networking", "discovery_card", "party_menu", "dinner_table",
  // 回饋 / 共創 / 回顧
  "spot_vote", "dot_vote", "multi_vote", "rank_choice", "scale_check", "scaled_feedback",
  "venue_rating", "safety_check", "energy_map", "word_cloud", "wish_wall", "idea_wall",
  "story_wall", "brain_dump", "thinking_hats", "kpt_retro", "four_ls", "rose_bud_thorn",
  "micro_commit", "closing_thought", "activity_memo", "gratitude_tree",
  // 活動 / 典禮
  "wedding_vow", "birthday_candle", "award_ceremony",
] as const;

export type PlayablePageType = (typeof PLAYABLE_PAGE_TYPES)[number];

const PLAYABLE_SET: ReadonlySet<string> = new Set(PLAYABLE_PAGE_TYPES);

/** 此 pageType 玩家端能不能渲染 */
export function isPlayablePageType(pageType: string): pageType is PlayablePageType {
  return PLAYABLE_SET.has(pageType);
}
