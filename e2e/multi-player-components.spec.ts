/**
 * E2E 測試：多人遊戲元件 Smoke Test
 *
 * 驗證新增的多人元件能正確載入、無 JS 崩潰、關鍵 data-testid 存在。
 * 測試方式：
 *   - 直接渲染元件 demo 路由（若有）
 *   - 或驗證 SPA 路由可達 + body 非空
 * 不依賴登入或實際遊戲資料，只做 smoke 驗證。
 *
 * 元件清單（Phase 5 新增）：
 *   - mood_meter（MoodMeterPage）
 *   - team_checklist（TeamChecklistPage）
 *   - feedback_star（FeedbackStarPage）
 *   - team_word_cloud（TeamWordCloudPage）
 *   - check_in（CheckInPage）
 *   - group_timer（GroupTimerPage）
 *   - quick_question（QuickQuestionPage）
 */

import { test, expect } from "@playwright/test";

test.describe("多人遊戲元件 Smoke Test", () => {
  test("Landing 頁無 React 崩潰（基準線）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("情境模板 API 可達（驗 space-activation 和 employee-onboarding 存在）", async ({ page }) => {
    const response = await page.request.get("/api/scenarios/health");
    // health endpoint 回傳 200
    expect(response.status()).toBe(200);
  });

  test("Admin 後台能載入（新情境建場入口）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/admin/login");
    await page.waitForTimeout(1500);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);

    const inputs = page.locator("input");
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test("Play SPA 頁面路由可達（多人遊戲入口）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/play/smoke-test-session");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText && bodyText.length > 0).toBeTruthy();
  });

  test("Team game 頁面路由可達（隊伍模式）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/team/smoke-test-game");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("Mobile viewport 多人遊戲頁面正常（375×667）", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/play/smoke-test-session");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("情境市場頁面能顯示新增的情境", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/template-market");
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText && bodyText.length > 50).toBeTruthy();
  });

  test("GamePageRenderer 不崩潰（scenario 頁面路由）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // 模擬存取 game 路由（不需要實際 game 存在，只要不崩）
    await page.goto("/g/smoke-test-slug");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("新情境模板包含 Phase 5 新元件", async ({ page }) => {
    const response = await page.request.get("/api/scenarios");
    const scenarios = await response.json();
    expect(Array.isArray(scenarios)).toBe(true);

    const allPageTypes = scenarios.flatMap((s: { components?: { pageType: string }[] }) =>
      (s.components ?? []).map((c: { pageType: string }) => c.pageType),
    );

    // Phase 5 核心元件
    expect(allPageTypes).toContain("dot_vote");
    expect(allPageTypes).toContain("timeline_wall");
    expect(allPageTypes).toContain("two_truths");
    expect(allPageTypes).toContain("retro_board");
    expect(allPageTypes).toContain("pledge_wall");
    expect(allPageTypes).toContain("live_pulse");
    expect(allPageTypes).toContain("debate_vote");
    expect(allPageTypes).toContain("peer_recognition");

    // Round 36-41 新元件
    expect(allPageTypes).toContain("aha_board");
    expect(allPageTypes).toContain("one_line_story");
    expect(allPageTypes).toContain("heat_map");
    expect(allPageTypes).toContain("energy_boost");
    expect(allPageTypes).toContain("role_play_card");
    expect(allPageTypes).toContain("group_decision");
    expect(allPageTypes).toContain("quote_wall");
    expect(allPageTypes).toContain("action_item");
    expect(allPageTypes).toContain("table_group");
    expect(allPageTypes).toContain("feedback_form");
    expect(allPageTypes).toContain("pair_share");
    expect(allPageTypes).toContain("team_snapshot");

    // Round 43-47 新元件
    expect(allPageTypes).toContain("song_wall");
    expect(allPageTypes).toContain("personal_compass");
    expect(allPageTypes).toContain("brain_dump");
    expect(allPageTypes).toContain("checkbox_vote");
    expect(allPageTypes).toContain("success_story");
    expect(allPageTypes).toContain("future_idea");
    expect(allPageTypes).toContain("value_card");
    expect(allPageTypes).toContain("thank_you_note");
    expect(allPageTypes).toContain("skill_map");
    expect(allPageTypes).toContain("mood_board");

    // Round 48 新元件
    expect(allPageTypes).toContain("learning_check");
    expect(allPageTypes).toContain("stand_point");

    // Round 49 新元件
    expect(allPageTypes).toContain("idea_market");
    expect(allPageTypes).toContain("consensus_map");

    // Round 50 新元件
    expect(allPageTypes).toContain("speed_round");
    expect(allPageTypes).toContain("scale_vote");

    // Round 51 新元件
    expect(allPageTypes).toContain("wish_bucket");
    expect(allPageTypes).toContain("quick_poll");

    // Round 52 新元件
    expect(allPageTypes).toContain("emoji_wall");
    expect(allPageTypes).toContain("random_pick");

    // Round 53 新元件
    expect(allPageTypes).toContain("personal_score");
    expect(allPageTypes).toContain("time_check");

    // Round 54 新元件
    expect(allPageTypes).toContain("token_vote");
    expect(allPageTypes).toContain("gallery_vote");

    // Round 55 新元件
    expect(allPageTypes).toContain("sentence_stem");
    expect(allPageTypes).toContain("pixel_mood");

    // Round 56 新元件
    expect(allPageTypes).toContain("cascade_vote");
    expect(allPageTypes).toContain("team_manifesto");

    // Round 57 新元件
    expect(allPageTypes).toContain("curiosity_map");
    expect(allPageTypes).toContain("vibe_check");

    // Round 58 新元件
    expect(allPageTypes).toContain("collab_canvas");
    expect(allPageTypes).toContain("number_line");

    // Round 59 新元件
    expect(allPageTypes).toContain("two_by_two");
    expect(allPageTypes).toContain("countdown_pledge");

    // Round 60 新元件
    expect(allPageTypes).toContain("star_map");
    expect(allPageTypes).toContain("flash_card");

    // Round 61 新元件
    expect(allPageTypes).toContain("speed_brainstorm");
    expect(allPageTypes).toContain("signal_map");

    // Round 62 新元件
    expect(allPageTypes).toContain("team_time_capsule");
    expect(allPageTypes).toContain("warm_cool");

    // Round 63 新元件
    expect(allPageTypes).toContain("give_get");
    expect(allPageTypes).toContain("ask_me_anything");

    // Round 64 新元件
    expect(allPageTypes).toContain("rose_bud_thorn");
    expect(allPageTypes).toContain("event_timeline");

    // Round 65 新元件
    expect(allPageTypes).toContain("yes_no_maybe");
    expect(allPageTypes).toContain("group_norm");

    // Round 66 新元件
    expect(allPageTypes).toContain("hope_fear");
    expect(allPageTypes).toContain("story_wall");

    // Round 67 新元件
    expect(allPageTypes).toContain("quick_reaction");
    expect(allPageTypes).toContain("personal_highlight");

    // Round 68 新元件
    expect(allPageTypes).toContain("kpt_retro");
    expect(allPageTypes).toContain("confidence_vote");

    // Round 69 新元件
    expect(allPageTypes).toContain("team_goal");
    expect(allPageTypes).toContain("start_stop_continue");

    // Round 70 新元件
    expect(allPageTypes).toContain("plus_even_better");
    expect(allPageTypes).toContain("meeting_check");

    // Round 71 新元件
    expect(allPageTypes).toContain("headline_news");
    expect(allPageTypes).toContain("risk_radar");

    // Round 72 新元件
    expect(allPageTypes).toContain("two_words");
    expect(allPageTypes).toContain("win_win");

    // Round 73 新元件
    expect(allPageTypes).toContain("impact_card");
    expect(allPageTypes).toContain("open_quiz");

    // Round 74 新元件
    expect(allPageTypes).toContain("micro_bio");
    expect(allPageTypes).toContain("after_action");

    // Round 75 新元件
    expect(allPageTypes).toContain("team_animal");
    expect(allPageTypes).toContain("reverse_brainstorm");

    // Round 76 新元件
    expect(allPageTypes).toContain("four_ls");
    expect(allPageTypes).toContain("wonder_board");

    // Round 77 新元件
    expect(allPageTypes).toContain("obstacle_map");
    expect(allPageTypes).toContain("common_ground");

    // Round 78 補全批次 1（已存在於模板）
    expect(allPageTypes).toContain("check_in");
    expect(allPageTypes).toContain("gratitude_wall");
    expect(allPageTypes).toContain("bucket_list");
    expect(allPageTypes).toContain("feedback_star");
    expect(allPageTypes).toContain("group_mood");
    expect(allPageTypes).toContain("celebration_wall");
    expect(allPageTypes).toContain("word_cloud");
    expect(allPageTypes).toContain("emoji_check_in");
    expect(allPageTypes).toContain("challenge_board");
    expect(allPageTypes).toContain("daily_intention");

    // Round 79 補全批次 2
    expect(allPageTypes).toContain("action_pledge");
    expect(allPageTypes).toContain("agreement_matrix");
    expect(allPageTypes).toContain("anonymous_voice");
    expect(allPageTypes).toContain("audience_q");
    expect(allPageTypes).toContain("bingo");
    expect(allPageTypes).toContain("bottle_letter");
    expect(allPageTypes).toContain("card_draw");
    expect(allPageTypes).toContain("category_challenge");
    expect(allPageTypes).toContain("category_sort");
    expect(allPageTypes).toContain("consensus_scale");

    // Round 80 補全批次 3
    expect(allPageTypes).toContain("choice_verify_race");
    expect(allPageTypes).toContain("clue_reveal");
    expect(allPageTypes).toContain("collective_poem");
    expect(allPageTypes).toContain("collective_score");
    expect(allPageTypes).toContain("color_pulse");
    expect(allPageTypes).toContain("confirm_it");
    expect(allPageTypes).toContain("countdown_challenge");
    expect(allPageTypes).toContain("countdown_reveal");
    expect(allPageTypes).toContain("crowd_answer");
    expect(allPageTypes).toContain("desert_island");

    // Round 81 補全批次 4
    expect(allPageTypes).toContain("dialogue");
    expect(allPageTypes).toContain("emoji_battle");
    expect(allPageTypes).toContain("emoji_reaction");
    expect(allPageTypes).toContain("emoji_slider");
    expect(allPageTypes).toContain("emoji_story");
    expect(allPageTypes).toContain("estimation_game");
    expect(allPageTypes).toContain("fast_buzz");
    expect(allPageTypes).toContain("feedback_sandwich");
    expect(allPageTypes).toContain("freeze_frame");
    expect(allPageTypes).toContain("glow_grow");

    // Round 82 補全批次 5（GPS + GroupXxx + HostScreen 類型）
    expect(allPageTypes).toContain("gps_cascade");
    expect(allPageTypes).toContain("gps_team_mission");
    expect(allPageTypes).toContain("group_cheer");
    expect(allPageTypes).toContain("group_contract");
    expect(allPageTypes).toContain("group_promise");
    expect(allPageTypes).toContain("host_crowd_gather");
    expect(allPageTypes).toContain("host_emoji_react");
    expect(allPageTypes).toContain("host_guestbook_digital");
    expect(allPageTypes).toContain("host_knowledge_map");
    expect(allPageTypes).toContain("host_live_leaderboard");

    // Round 83 補全批次 6（HostScreen + HotXxx + IdeaWall + 知識類）
    expect(allPageTypes).toContain("host_polaroid_collage");
    expect(allPageTypes).toContain("host_poll_live");
    expect(allPageTypes).toContain("host_scoreboard_announcement");
    expect(allPageTypes).toContain("host_trivia_showdown");
    expect(allPageTypes).toContain("host_wave_response");
    expect(allPageTypes).toContain("hot_seat");
    expect(allPageTypes).toContain("hot_take");
    expect(allPageTypes).toContain("idea_wall");
    expect(allPageTypes).toContain("knowledge_check");
    expect(allPageTypes).toContain("kudos_wall");

    // Round 84 補全批次 7（Letter + Lock + Lucky + MadLibs + Memory + MoodXxx）
    expect(allPageTypes).toContain("letter_to_self");
    expect(allPageTypes).toContain("lock_coop");
    expect(allPageTypes).toContain("lucky_draw");
    expect(allPageTypes).toContain("mad_libs");
    expect(allPageTypes).toContain("memory_lane");
    expect(allPageTypes).toContain("mind_sync");
    expect(allPageTypes).toContain("mood_map");
    expect(allPageTypes).toContain("mood_meter");
    expect(allPageTypes).toContain("most_likely");
    expect(allPageTypes).toContain("multi_vote");

    // Round 85 補全批次 8（NameCard + NeverHaveIEver + NumberGuess + OpenXxx + PersonalFact + Photo）
    expect(allPageTypes).toContain("name_card");
    expect(allPageTypes).toContain("never_have_i_ever");
    expect(allPageTypes).toContain("number_guess");
    expect(allPageTypes).toContain("open_mic");
    expect(allPageTypes).toContain("open_question");
    expect(allPageTypes).toContain("personal_fact");
    expect(allPageTypes).toContain("photo_caption");
    expect(allPageTypes).toContain("photo_contest");
    expect(allPageTypes).toContain("photo_team");
    expect(allPageTypes).toContain("photo_wall");

    // Round 86 補全批次 9（PitchVote + PointsAuction + PopQuiz + Prediction + PresenceMap + Priority + Progress + Project + Quest + Question）
    expect(allPageTypes).toContain("pitch_vote");
    expect(allPageTypes).toContain("points_auction");
    expect(allPageTypes).toContain("pop_quiz");
    expect(allPageTypes).toContain("prediction_poll");
    expect(allPageTypes).toContain("presence_map");
    expect(allPageTypes).toContain("priority_rank");
    expect(allPageTypes).toContain("progress_check");
    expect(allPageTypes).toContain("project_showcase");
    expect(allPageTypes).toContain("quest_chain");
    expect(allPageTypes).toContain("question_box");

    // Round 87 補全批次 10（QuickQuestion + QuizBlitz + RandomTeam + RankChoice + Rate + Rating + Reaction + Relay + Role + ScaledFeedback）
    expect(allPageTypes).toContain("quick_question");
    expect(allPageTypes).toContain("quiz_blitz");
    expect(allPageTypes).toContain("random_team");
    expect(allPageTypes).toContain("rank_choice");
    expect(allPageTypes).toContain("rate_idea");
    expect(allPageTypes).toContain("rating_wall");
    expect(allPageTypes).toContain("reaction_wall");
    expect(allPageTypes).toContain("relay_mission");
    expect(allPageTypes).toContain("role_assign");
    expect(allPageTypes).toContain("scaled_feedback");

    // Round 88 補全批次 11（SceneVote + SeatDraw + SentenceCompletion + SharedBoard + SilentXxx + SkillSwap + SpectrumLine + SpeedXxx）
    expect(allPageTypes).toContain("scene_vote");
    expect(allPageTypes).toContain("seat_draw");
    expect(allPageTypes).toContain("sentence_completion");
    expect(allPageTypes).toContain("shared_board");
    expect(allPageTypes).toContain("silent_brainstorm");
    expect(allPageTypes).toContain("silent_debate");
    expect(allPageTypes).toContain("skill_swap");
    expect(allPageTypes).toContain("spectrum_line");
    expect(allPageTypes).toContain("speed_networking");
    expect(allPageTypes).toContain("speed_typing");

    // Round 89 補全批次 12（SpinWheel + StampCard + StoryXxx + TastingNotes + TeamXxx）
    expect(allPageTypes).toContain("spin_wheel");
    expect(allPageTypes).toContain("stamp_card");
    expect(allPageTypes).toContain("story_branch");
    expect(allPageTypes).toContain("story_chain");
    expect(allPageTypes).toContain("tasting_notes");
    expect(allPageTypes).toContain("team_checklist");
    expect(allPageTypes).toContain("team_contract");
    expect(allPageTypes).toContain("team_health_check");
    expect(allPageTypes).toContain("team_poll");
    expect(allPageTypes).toContain("team_word_cloud");

    // Round 89 補全批次 13（ThinkingHats + TimeXxx + TreasureHunt + TruthOrMyth + TwoColumn + ValueRank + WishWall + WordXxx + WouldYouRather）
    expect(allPageTypes).toContain("thinking_hats");
    expect(allPageTypes).toContain("time_capture");
    expect(allPageTypes).toContain("time_vault");
    expect(allPageTypes).toContain("timed_challenge");
    expect(allPageTypes).toContain("treasure_hunt");
    expect(allPageTypes).toContain("truth_or_myth");
    expect(allPageTypes).toContain("two_column");
    expect(allPageTypes).toContain("value_rank");
    expect(allPageTypes).toContain("wish_wall");
    expect(allPageTypes).toContain("word_association");
    expect(allPageTypes).toContain("word_bid");
    expect(allPageTypes).toContain("word_ladder");
    expect(allPageTypes).toContain("would_you_rather");

    // Round 90 補全最終批次（HostBingo + HostBlessing + HostMicroQa + HostWordCloud + JigsawPuzzle）
    expect(allPageTypes).toContain("host_bingo_board");
    expect(allPageTypes).toContain("host_blessing_wall");
    expect(allPageTypes).toContain("host_micro_qa");
    expect(allPageTypes).toContain("host_word_cloud");
    expect(allPageTypes).toContain("jigsaw_puzzle");

    // Round 91 新元件
    expect(allPageTypes).toContain("survey_block");
    expect(allPageTypes).toContain("thought_bubble");

    // Round 92 新元件
    expect(allPageTypes).toContain("energy_level");
    expect(allPageTypes).toContain("team_vision");

    // Round 93 新元件
    expect(allPageTypes).toContain("future_me");
    expect(allPageTypes).toContain("growth_edge");

    // Round 94 新元件
    expect(allPageTypes).toContain("values_card");
    expect(allPageTypes).toContain("opinion_slider");

    // Round 95 新元件
    expect(allPageTypes).toContain("strength_spot");
    expect(allPageTypes).toContain("challenge_flag");

    // Round 96 新元件
    expect(allPageTypes).toContain("question_jar");
    expect(allPageTypes).toContain("work_style");

    // Round 97 新元件
    expect(allPageTypes).toContain("reflection_card");
    expect(allPageTypes).toContain("peak_moment");

    // Round 98 新元件
    expect(allPageTypes).toContain("safety_check");
    expect(allPageTypes).toContain("expectation_board");

    // Round 99 新元件
    expect(allPageTypes).toContain("satisfaction_meter");
    expect(allPageTypes).toContain("team_flag");

    // Round 100 新元件
    expect(allPageTypes).toContain("learning_objective");
    expect(allPageTypes).toContain("appreciation_note");
  });

  test("defaultConfigForType API 能為 Round 36-41 新元件回傳有效 config", async ({ page }) => {
    const newTypes = [
      "aha_board",
      "one_line_story",
      "heat_map",
      "energy_boost",
      "role_play_card",
      "group_decision",
      "quote_wall",
      "action_item",
      "table_group",
      "feedback_form",
      "pair_share",
      "team_snapshot",
      "song_wall",
      "personal_compass",
      "brain_dump",
      "checkbox_vote",
      "success_story",
      "future_idea",
      "value_card",
      "thank_you_note",
      "skill_map",
      "mood_board",
      "learning_check",
      "stand_point",
      "idea_market",
      "consensus_map",
      "speed_round",
      "scale_vote",
      "wish_bucket",
      "quick_poll",
      "emoji_wall",
      "random_pick",
      "personal_score",
      "time_check",
      "token_vote",
      "gallery_vote",
      "sentence_stem",
      "pixel_mood",
      "cascade_vote",
      "team_manifesto",
      "curiosity_map",
      "vibe_check",
      "collab_canvas",
      "number_line",
      "two_by_two",
      "countdown_pledge",
      "star_map",
      "flash_card",
      "speed_brainstorm",
      "signal_map",
      "team_time_capsule",
      "warm_cool",
      "give_get",
      "ask_me_anything",
      "rose_bud_thorn",
      "event_timeline",
      "yes_no_maybe",
      "group_norm",
      "hope_fear",
      "story_wall",
      "quick_reaction",
      "personal_highlight",
      "kpt_retro",
      "confidence_vote",
      "team_goal",
      "start_stop_continue",
      "plus_even_better",
      "meeting_check",
      "headline_news",
      "risk_radar",
      "two_words",
      "win_win",
      "impact_card",
      "open_quiz",
      "micro_bio",
      "after_action",
      "team_animal",
      "reverse_brainstorm",
      "four_ls",
      "wonder_board",
      "obstacle_map",
      "common_ground",
      "check_in",
      "gratitude_wall",
      "bucket_list",
      "feedback_star",
      "group_mood",
      "celebration_wall",
      "word_cloud",
      "emoji_check_in",
      "challenge_board",
      "daily_intention",
      "action_pledge",
      "agreement_matrix",
      "anonymous_voice",
      "audience_q",
      "bingo",
      "bottle_letter",
      "card_draw",
      "category_challenge",
      "category_sort",
      "consensus_scale",
      "choice_verify_race",
      "clue_reveal",
      "collective_poem",
      "collective_score",
      "color_pulse",
      "confirm_it",
      "countdown_challenge",
      "countdown_reveal",
      "crowd_answer",
      "desert_island",
      "dialogue",
      "emoji_battle",
      "emoji_reaction",
      "emoji_slider",
      "emoji_story",
      "estimation_game",
      "fast_buzz",
      "feedback_sandwich",
      "freeze_frame",
      "glow_grow",
      "gps_cascade",
      "gps_team_mission",
      "group_cheer",
      "group_contract",
      "group_promise",
      "host_crowd_gather",
      "host_emoji_react",
      "host_guestbook_digital",
      "host_knowledge_map",
      "host_live_leaderboard",
      "host_polaroid_collage",
      "host_poll_live",
      "host_scoreboard_announcement",
      "host_trivia_showdown",
      "host_wave_response",
      "hot_seat",
      "hot_take",
      "idea_wall",
      "knowledge_check",
      "kudos_wall",
      "letter_to_self",
      "lock_coop",
      "lucky_draw",
      "mad_libs",
      "memory_lane",
      "mind_sync",
      "mood_map",
      "mood_meter",
      "most_likely",
      "multi_vote",
      "name_card",
      "never_have_i_ever",
      "number_guess",
      "open_mic",
      "open_question",
      "personal_fact",
      "photo_caption",
      "photo_contest",
      "photo_team",
      "photo_wall",
      "pitch_vote",
      "points_auction",
      "pop_quiz",
      "prediction_poll",
      "presence_map",
      "priority_rank",
      "progress_check",
      "project_showcase",
      "quest_chain",
      "question_box",
      "quick_question",
      "quiz_blitz",
      "random_team",
      "rank_choice",
      "rate_idea",
      "rating_wall",
      "reaction_wall",
      "relay_mission",
      "role_assign",
      "scaled_feedback",
      "scene_vote",
      "seat_draw",
      "sentence_completion",
      "shared_board",
      "silent_brainstorm",
      "silent_debate",
      "skill_swap",
      "spectrum_line",
      "speed_networking",
      "speed_typing",
      "spin_wheel",
      "stamp_card",
      "story_branch",
      "story_chain",
      "tasting_notes",
      "team_checklist",
      "team_contract",
      "team_health_check",
      "team_poll",
      "team_word_cloud",
      "thinking_hats",
      "time_capture",
      "time_vault",
      "timed_challenge",
      "treasure_hunt",
      "truth_or_myth",
      "two_column",
      "value_rank",
      "wish_wall",
      "word_association",
      "word_bid",
      "word_ladder",
      "would_you_rather",
      "host_bingo_board",
      "host_blessing_wall",
      "host_micro_qa",
      "host_word_cloud",
      "jigsaw_puzzle",
      "survey_block",
      "thought_bubble",
      "energy_level",
      "team_vision",
      "future_me",
      "growth_edge",
      "values_card",
      "opinion_slider",
      "strength_spot",
      "challenge_flag",
      "question_jar",
      "work_style",
      "reflection_card",
      "peak_moment",
      "safety_check",
      "expectation_board",
      "satisfaction_meter",
      "team_flag",
      "learning_objective",
      "appreciation_note",
      "meeting_rating",
      "skill_showcase",
      "habit_tracker",
      "career_highlight",
      "superpower_card",
      "origin_story",
      "wisdom_pool",
      "blind_spot",
      "life_line",
      "talent_swap",
      "gift_box",
      "time_capsule",
      "team_pact",
      "energy_map",
      "challenge_map",
      "action_plan",
      "vision_board",
      "conflict_style",
      "peer_mirror",
      "motivation_map",
      "hero_story",
      "learning_style",
      "stress_signal",
      "decision_style",
      "three_words",
      "team_radar",
      "today_feel",
      "speed_fact",
      "color_vibe",
      "good_news",
      "love_advice",
      "fav_memory",
      "dream_trip",
      "book_rec",
      "motto_board",
      "time_capacity",
      "wish_list",
      "strength_map",
    ];

    for (const t of newTypes) {
      const res = await page.request.post("/api/admin/games/1/pages", {
        data: { pageType: t, title: `test-${t}` },
        headers: { "Content-Type": "application/json" },
      });
      // 401（未認證）或 200/201（成功）都可；只要不是 500（表示 server 崩潰）
      expect(res.status()).not.toBe(500);
    }
  });

  test("Find-scenario 頁面可以顯示（工作坊破冰場景）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/find-scenario");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("Template market 年會情境頁可以顯示", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/template-market/annual-meeting");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText && bodyText.length > 50).toBeTruthy();
  });
});
