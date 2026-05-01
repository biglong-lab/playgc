// 🏯 賈村場域（金門）多人示範遊戲模組
//
// 兩個 demo 遊戲，全部使用 multi 元件 + 通用元件搭建（無硬編寫）：
//   1. jiachun_multiplayer_treasure — 金門古城多人探險（戶外，30 分鐘）
//   2. jiachun_team_quiz — 金門知識大挑戰（教育，15 分鐘）
//
// 使用方式：
//   admin 進「遊戲模組」→ 選此 module → 一鍵建立遊戲 →
//   進 page editor 微調題目/座標/題庫
//
// GPS 座標說明（admin 套用後可在 page editor 調整）：
//   - 金門城（古城）：24.4329, 118.3166
//   - 莒光樓：       24.4338, 118.3214
//   - 金門酒廠：     24.4434, 118.3398
//   - 太武山：       24.4673, 118.3938

import type { GameModule } from "../game-modules";

// ============================================================================
// 遊戲 1：金門古城多人探險（戶外類）
// ============================================================================
const jiachunMultiplayerTreasure: GameModule = {
  id: "jiachun_multiplayer_treasure",
  name: "金門古城多人探險",
  description:
    "隊伍一起遊歷金門古蹟、合影留念、共同決定下一站、知識搶答的戶外多人實境遊戲",
  icon: "map",
  estimatedTime: 30,
  maxPlayers: 6,
  difficulty: "medium",
  tags: ["戶外", "多人", "金門", "古蹟", "團隊協作"],
  category: "outdoor",
  scenario: "適合金門賈村場域戶外導覽、家庭出遊、同事團建、學生戶外教學",
  highlights: [
    "🤝 隊伍合影開場凝聚感情",
    "🗺️ GPS 多人協作（任一隊員到達即觸發）",
    "🗳️ 隊伍投票共同決策下一站",
    "💡 隊伍搶答 — 5 題金門知識",
    "📸 終點合影留念",
  ],
  flowDescription:
    "召集令 → 起點合影 → GPS 至金門城 → 古蹟劇情 → 隊伍投票 → GPS 至下一站 → 知識搶答 → 終點合影 → 結語",
  coverEmoji: "🏯",
  gameMode: "team",
  pages: [
    {
      pageType: "text_card",
      title: "召集令",
      config: {
        title: "金門古城多人探險",
        content:
          "歡迎來到金門賈村！本次任務需要全隊一起完成 — 從合影、GPS 探訪、共同投票、知識搶答到終點合照，每個環節都需要隊員協作。請確認你的隊伍已組成並準備好出發。",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 0,
      },
    },
    {
      pageType: "photo_team",
      title: "起點合影 — 集合宣誓",
      config: {
        title: "起點合影",
        instruction: "全隊集合，由隊長拍下起點合照",
        minMembers: 2,
        maxMembers: 6,
        rewardPoints: 10,
      },
    },
    {
      pageType: "gps_team_mission",
      title: "前往第一站：金門城",
      config: {
        title: "尋找金門城",
        locationName: "金門城（古城）",
        targetLocation: { lat: 24.4329, lng: 118.3166 },
        radius: 30,
        instruction: "全隊一起走到金門城門口（任一人到達即觸發）",
        rewardPoints: 20,
      },
    },
    {
      pageType: "dialogue",
      title: "古蹟導覽",
      config: {
        character: { name: "金門老兵" },
        messages: [
          {
            text: "歡迎來到金門城！這裡是金門最古老的城牆，曾經抵擋過無數的戰火。",
            emotion: "neutral",
          },
          {
            text: "你們是有緣人，能走到這裡。接下來請決定要去哪一個下一站？",
            emotion: "neutral",
          },
        ],
        typingSpeed: 30,
        autoAdvance: false,
        rewardPoints: 5,
      },
    },
    {
      pageType: "vote_team",
      title: "隊伍投票 — 下一站決議",
      config: {
        title: "下一站去哪？",
        question: "全隊投票決定 — 過半即通過",
        options: [
          { text: "🗼 莒光樓（觀景台）" },
          { text: "🍶 金門酒廠（高粱文化）" },
        ],
        showResults: true,
        anonymousVoting: false,
        nextPageStrategy: "winner",
        autoAdvanceSeconds: 5,
      },
    },
    {
      pageType: "gps_team_mission",
      title: "前往決議地點",
      config: {
        title: "出發到下一站",
        locationName: "投票決議的地點（莒光樓 或 金門酒廠）",
        targetLocation: { lat: 24.4338, lng: 118.3214 },
        radius: 30,
        instruction: "全隊一起前往，投票結果勝出的地點",
        rewardPoints: 20,
      },
    },
    {
      pageType: "choice_verify_race",
      title: "金門知識搶答",
      config: {
        title: "金門知識大挑戰",
        questions: [
          {
            question: "金門最有名的特產是什麼？",
            options: ["高粱酒", "鳳梨酥", "麻糬", "肉乾"],
            correctAnswer: 0,
            explanation: "金門高粱酒是金門最著名的特產，享譽國際。",
          },
          {
            question: "金門面積大約多少平方公里？",
            options: ["50", "100", "150", "200"],
            correctAnswer: 2,
            explanation: "金門面積約 150 平方公里。",
          },
          {
            question: "金門古地名「浯洲」的「浯」字怎麼念？",
            options: ["ㄨˊ", "ㄩˊ", "ㄒㄩˋ", "ㄋㄧˊ"],
            correctAnswer: 0,
            explanation: "「浯」念 ㄨˊ。",
          },
          {
            question: "金門縣總人口約多少？",
            options: ["5 萬", "10 萬", "14 萬", "20 萬"],
            correctAnswer: 2,
            explanation: "金門縣戶籍人口約 14 萬人。",
          },
          {
            question: "風獅爺是金門哪一種文化的象徵？",
            options: ["美食文化", "戰地文化", "鎮邪信仰", "酒文化"],
            correctAnswer: 2,
            explanation: "風獅爺是金門特有的鎮邪辟風信仰象徵。",
          },
        ],
        rewardPerQuestion: 10,
        timeLimit: 30,
      },
    },
    {
      pageType: "photo_team",
      title: "終點合影",
      config: {
        title: "勝利合照",
        instruction: "全隊在終點留下勝利合影",
        minMembers: 2,
        maxMembers: 6,
        rewardPoints: 30,
      },
    },
    {
      pageType: "text_card",
      title: "完成任務",
      config: {
        title: "🎉 任務達成！",
        content:
          "你們全隊一起走完了金門古城探險。希望這趟旅程讓大家對金門的歷史與風土有了更深的認識。期待下次再見！",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 50,
      },
    },
  ],
};

// ============================================================================
// 遊戲 2：金門知識大挑戰（教育類，室內可玩）
// ============================================================================
const jiachunTeamQuiz: GameModule = {
  id: "jiachun_team_quiz",
  name: "金門知識大挑戰",
  description:
    "短時間室內或半戶外的隊伍搶答活動，適合導覽結束後的知識回顧",
  icon: "help-circle",
  estimatedTime: 15,
  maxPlayers: 8,
  difficulty: "easy",
  tags: ["教育", "搶答", "金門", "團隊", "室內"],
  category: "education",
  scenario: "適合導覽結束的活動回顧、學校教學、公司教育訓練、夏令營",
  highlights: [
    "🎯 即時搶答 — 誰先答對誰得分",
    "🏆 隊內排行 — 強競爭刺激",
    "📚 7 題金門深度知識",
    "📷 全隊合影留念",
    "⏱️ 15 分鐘短時間活動",
  ],
  flowDescription:
    "歡迎開場 → 角色介紹 → 7 題隊伍搶答 → 全隊合影 → 成績公告",
  coverEmoji: "🏆",
  gameMode: "team",
  pages: [
    {
      pageType: "text_card",
      title: "歡迎",
      config: {
        title: "金門知識大挑戰",
        content:
          "歡迎參加金門知識搶答！全隊將共同挑戰 7 道金門相關題目，先答對的隊員得分，看看誰是隊內知識王！",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 0,
      },
    },
    {
      pageType: "dialogue",
      title: "主持人開場",
      config: {
        character: { name: "金門小知識家" },
        messages: [
          {
            text: "你好！我是金門小知識家。準備好一起測試你對金門的了解嗎？",
            emotion: "happy",
          },
          {
            text: "這是隊伍搶答 — 全隊只要有人先答對就會得分。看誰反應最快！",
            emotion: "neutral",
          },
        ],
        typingSpeed: 30,
        autoAdvance: false,
        rewardPoints: 5,
      },
    },
    {
      pageType: "text_card",
      title: "搶答規則",
      config: {
        title: "搶答規則",
        content:
          "📌 共 7 題金門知識\n📌 每題限時 25 秒\n📌 第一個答對的隊員得 15 分\n📌 答錯不扣分\n📌 隊伍總分 = SUM(隊員個人分)\n\n準備好就開始！",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 0,
      },
    },
    {
      pageType: "choice_verify_race",
      title: "知識搶答",
      config: {
        title: "金門知識搶答",
        questions: [
          {
            question: "金門縣的縣花是什麼？",
            options: ["梅花", "桐花", "百合", "扶桑花"],
            correctAnswer: 3,
            explanation: "金門縣花為扶桑花。",
          },
          {
            question: "金門最高山是哪一座？",
            options: ["太武山", "獅山", "鵲山", "燕山"],
            correctAnswer: 0,
            explanation: "太武山海拔 253 公尺，為金門最高點。",
          },
          {
            question: "金門「八二三戰役」發生於哪一年？",
            options: ["1949", "1958", "1965", "1979"],
            correctAnswer: 1,
            explanation: "1958 年，又稱金門炮戰。",
          },
          {
            question: "金門哪一個傳統建築風格被稱為「燕尾脊」？",
            options: ["閩南古厝", "西式洋樓", "日式宿舍", "蒙古包"],
            correctAnswer: 0,
            explanation: "燕尾脊是金門閩南古厝的特色建築風格。",
          },
          {
            question: "金門最有名的麵食料理是？",
            options: ["金門炸醬麵", "金門廣東粥", "金門牛肉麵", "金門擔仔麵"],
            correctAnswer: 1,
            explanation: "金門廣東粥是當地特色早餐。",
          },
          {
            question: "「金門菜刀」的原料來源是什麼？",
            options: ["進口鋼材", "戰時砲彈", "石器", "陶瓷"],
            correctAnswer: 1,
            explanation: "金門菜刀以早年戰時砲彈製成，是金門名產之一。",
          },
          {
            question: "金門共有多少座風獅爺？",
            options: ["不到 50 尊", "約 100 尊", "約 200 尊", "超過 1000 尊"],
            correctAnswer: 2,
            explanation: "金門全縣有約 200 尊風獅爺。",
          },
        ],
        rewardPerQuestion: 15,
        timeLimit: 25,
      },
    },
    {
      pageType: "dialogue",
      title: "搶答結果點評",
      config: {
        character: { name: "金門小知識家" },
        messages: [
          {
            text: "辛苦大家了！搶答結束，看看你們的表現如何？",
            emotion: "happy",
          },
          {
            text: "知識答得好不如記得深，這些金門特色希望你都能帶回去分享。",
            emotion: "neutral",
          },
        ],
        typingSpeed: 30,
        autoAdvance: false,
        rewardPoints: 5,
      },
    },
    {
      pageType: "photo_team",
      title: "全隊合影",
      config: {
        title: "勝利合照",
        instruction: "不論成績如何，留下美好回憶",
        minMembers: 2,
        maxMembers: 8,
        rewardPoints: 20,
      },
    },
    {
      pageType: "text_card",
      title: "完成挑戰",
      config: {
        title: "🏆 挑戰完成！",
        content:
          "感謝你們參加金門知識大挑戰。希望透過這 7 道題目，你對金門的歷史、文化和風土有了更深的認識！",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 30,
      },
    },
  ],
};

export const JIACHUN_MODULES: GameModule[] = [
  jiachunMultiplayerTreasure,
  jiachunTeamQuiz,
];
