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

// ============================================================================
// 遊戲 3：阿榮好想退伍（多人版） — 軍事訓練協作版
// ============================================================================
const jiachunArongMultiplayer: GameModule = {
  id: "jiachun_arong_multiplayer",
  name: "阿榮好想退伍（多人版）",
  description:
    "經典軍事訓練體驗的多人版本 — 全隊協作通過毒氣、狙擊、手榴彈、敵襲等戰場關卡",
  icon: "shield",
  estimatedTime: 30,
  maxPlayers: 6,
  difficulty: "medium",
  tags: ["軍事", "戰技", "多人", "金門", "戰地體驗"],
  category: "team",
  scenario: "適合金門賈村戰技體驗場、軍事主題活動、團隊體驗訓練",
  highlights: [
    "🪖 軍事訓練全程多人協作",
    "💨 毒氣警戒：隊伍快速移動到安全區（GPS 任一人到達）",
    "🎯 戰術決議：投票決定突圍方向",
    "💣 軍情快問：搶答敵軍意圖",
    "📸 戰友合影留念",
  ],
  flowDescription:
    "召集 → 阿榮對話 → 戰友合影 → GPS 進訓練場 → 戰術投票 → 軍情搶答 → GPS 撤離 → 凱旋合影 → 結語",
  coverEmoji: "🪖",
  gameMode: "team",
  pages: [
    {
      pageType: "text_card",
      title: "召集令",
      config: {
        title: "阿榮好想退伍（多人版）",
        content:
          "新兵注意！你們這個小組將要一起完成戰場訓練。從毒氣警戒、狙擊應對、手榴彈使用、敵情判讀到全身而退，每一關都需要隊員緊密協作。撐過去就能回家！",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 0,
      },
    },
    {
      pageType: "dialogue",
      title: "班長簡報",
      config: {
        character: { name: "李班長" },
        messages: [
          {
            text: "弟兄們！這次的訓練模擬實戰場景。我提醒你們 — 要活著回來，靠的不是個人英雄主義，是團隊協作。",
            emotion: "neutral",
          },
          {
            text: "看好你的戰友，互相掩護。先合張影留底，希望你們全部都能完整回來。",
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
      title: "出發前合影",
      config: {
        title: "戰前合影",
        instruction: "全班合影留念，準備出發",
        minMembers: 2,
        maxMembers: 6,
        rewardPoints: 10,
      },
    },
    {
      pageType: "gps_team_mission",
      title: "前進訓練場（任一隊員到達）",
      config: {
        title: "進入訓練場",
        locationName: "賈村戰技體驗場",
        targetLocation: { lat: 24.4329, lng: 118.3166 },
        radius: 30,
        instruction: "全隊向訓練場移動 — 任一人到達即觸發毒氣警戒",
        rewardPoints: 15,
      },
    },
    {
      pageType: "vote_team",
      title: "戰術投票 — 突圍方向",
      config: {
        title: "毒氣攻擊！突圍方向？",
        question: "全隊投票決定 — 過半即執行",
        options: [
          { text: "💨 上風處撤退（安全但繞路）" },
          { text: "🏃 直線衝出毒區（快但危險）" },
          { text: "🛡️ 戴防毒面具固守原地" },
        ],
        showResults: true,
        anonymousVoting: false,
        nextPageStrategy: "winner",
        autoAdvanceSeconds: 5,
      },
    },
    {
      pageType: "choice_verify_race",
      title: "軍情快問搶答",
      config: {
        title: "敵情判讀 — 搶答得分",
        questions: [
          {
            question: "聽到「咻——」聲音由遠到近最可能是？",
            options: ["風聲", "迫擊砲落彈", "鳥叫", "車聲"],
            correctAnswer: 1,
            explanation: "迫擊砲彈道飛行的尾音是經典戰場警示。",
          },
          {
            question: "看到敵方狙擊鏡反光，正確反應是？",
            options: ["揮手", "立刻臥倒並通報班長", "大聲呼叫", "繼續前進"],
            correctAnswer: 1,
            explanation: "立刻臥倒減少目標面積 + 通報是基本反應。",
          },
          {
            question: "手榴彈拉了保險後幾秒爆炸？",
            options: ["1 秒", "3-5 秒", "10 秒", "30 秒"],
            correctAnswer: 1,
            explanation: "M67 手榴彈延遲約 4-5 秒。",
          },
          {
            question: "在毒氣區應該保持什麼姿勢？",
            options: [
              "高舉雙手",
              "低姿態（毒氣多沉於低處 — 但反方向上風才安全）",
              "蹲下不動",
              "保持原姿態 + 戴面具",
            ],
            correctAnswer: 3,
            explanation: "戴面具 + 朝上風處快速撤離才是正解。",
          },
          {
            question: "敵狙擊手最常選擇的射擊位置？",
            options: ["平地中央", "高處且有遮蔽物", "車內", "公廁"],
            correctAnswer: 1,
            explanation: "高處遮蔽是狙擊手首選。",
          },
        ],
        rewardPerQuestion: 15,
        timeLimit: 30,
      },
    },
    {
      pageType: "gps_team_mission",
      title: "全隊撤離戰場",
      config: {
        title: "向回防點集結",
        locationName: "民防坑道入口",
        targetLocation: { lat: 24.4338, lng: 118.3214 },
        radius: 30,
        instruction: "全隊一起向回防點移動",
        rewardPoints: 20,
      },
    },
    {
      pageType: "photo_team",
      title: "凱旋合影",
      config: {
        title: "全員平安歸來",
        instruction: "全班拍下凱旋合照",
        minMembers: 2,
        maxMembers: 6,
        rewardPoints: 30,
      },
    },
    {
      pageType: "text_card",
      title: "退伍倒數",
      config: {
        title: "🎖️ 訓練完成！",
        content:
          "弟兄們辛苦了！今天的協作讓你們離退伍更近一步。希望你們記得：戰場上靠的不是一個人，是整個班的默契。下次見！",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 50,
      },
    },
  ],
};

// ============================================================================
// 遊戲 4：偵察兵訓練（多人版） — 偵察隊協作任務
// ============================================================================
const jiachunReconMultiplayer: GameModule = {
  id: "jiachun_recon_multiplayer",
  name: "偵察兵訓練（多人版）",
  description:
    "偵察小隊深入敵境 — 多點偵察、情報判讀、回報決策的軍事體驗任務",
  icon: "binoculars",
  estimatedTime: 25,
  maxPlayers: 5,
  difficulty: "medium",
  tags: ["軍事", "偵察", "多人", "金門", "情報"],
  category: "team",
  scenario: "適合金門軍事主題體驗、童軍偵察訓練、團隊默契活動",
  highlights: [
    "🔭 偵察小隊任務協作",
    "🗺️ 多點 GPS 偵察（任一隊員到達）",
    "🧠 情報判讀搶答",
    "🗳️ 共同決議回報內容",
    "📷 整隊合影回防",
  ],
  flowDescription:
    "任務簡報 → 指揮官指示 → 整隊合影 → 偵察點 1 → 敵情搶答 → 偵察點 2 → 情報投票 → 回防合影",
  coverEmoji: "🔭",
  gameMode: "team",
  pages: [
    {
      pageType: "text_card",
      title: "偵察任務簡報",
      config: {
        title: "偵察小隊出動！",
        content:
          "情報指出敵方在賈村山區有可疑活動。你們小隊將深入偵察兩個重點區域，回報情報後共同判斷敵情。記住：偵察兵的天職是不被發現、把資訊帶回家。",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 0,
      },
    },
    {
      pageType: "dialogue",
      title: "指揮官指示",
      config: {
        character: { name: "張指揮官" },
        messages: [
          {
            text: "偵察兵注意！你們這次任務有兩個重點：靜悄悄抵達、把回情報帶回。",
            emotion: "neutral",
          },
          {
            text: "如果失聯，每個隊員都是備援。互相照應，把任務做好。",
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
      title: "出發前整隊",
      config: {
        title: "偵察小隊整隊",
        instruction: "出發前合影留念",
        minMembers: 2,
        maxMembers: 5,
        rewardPoints: 10,
      },
    },
    {
      pageType: "gps_team_mission",
      title: "偵察點 1",
      config: {
        title: "潛入第一偵察點",
        locationName: "賈村制高點 A",
        targetLocation: { lat: 24.4329, lng: 118.3166 },
        radius: 25,
        instruction: "全隊潛入偵察點 — 任一人到達即觸發",
        rewardPoints: 20,
      },
    },
    {
      pageType: "choice_verify_race",
      title: "敵情判讀搶答",
      config: {
        title: "現場情報判讀",
        questions: [
          {
            question: "敵方車輛輪胎印很深 — 可能載運什麼？",
            options: ["人員", "重型武器", "補給物資", "醫療設備"],
            correctAnswer: 1,
            explanation: "輪胎印深通常代表載重大，多為武器或彈藥。",
          },
          {
            question: "看到燃燒的營火灰燼，能推測什麼？",
            options: [
              "敵人剛剛離開不到 1 小時",
              "敵人離開超過 24 小時",
              "敵人在現場睡覺",
              "天然山火",
            ],
            correctAnswer: 0,
            explanation: "灰燼還溫熱代表火源近期才熄滅。",
          },
          {
            question: "偵察行動最重要的原則？",
            options: ["大聲呼救", "保持隱蔽", "拍照分享 IG", "點火取暖"],
            correctAnswer: 1,
            explanation: "偵察的核心是不被發現。",
          },
          {
            question: "現場找到一張紙條寫著奇怪數字，最佳處置？",
            options: ["當場大聲念出", "拍照後原樣放回", "撕掉避免被發現", "燒掉"],
            correctAnswer: 1,
            explanation: "拍照存證 + 原樣放回，避免敵察覺。",
          },
        ],
        rewardPerQuestion: 15,
        timeLimit: 30,
      },
    },
    {
      pageType: "gps_team_mission",
      title: "偵察點 2",
      config: {
        title: "推進第二偵察點",
        locationName: "賈村制高點 B",
        targetLocation: { lat: 24.4338, lng: 118.3214 },
        radius: 25,
        instruction: "繼續向第二點推進",
        rewardPoints: 20,
      },
    },
    {
      pageType: "vote_team",
      title: "回報判斷投票",
      config: {
        title: "情報回報內容",
        question: "全隊共同決議要回報的優先資訊",
        options: [
          { text: "🚛 敵方武器運輸動線" },
          { text: "🏕️ 敵方營地位置" },
          { text: "📡 敵方通訊頻率" },
        ],
        showResults: true,
        anonymousVoting: false,
        nextPageStrategy: "winner",
        autoAdvanceSeconds: 5,
      },
    },
    {
      pageType: "photo_team",
      title: "回防合影",
      config: {
        title: "任務達成合影",
        instruction: "全隊安全歸來，留下任務紀念",
        minMembers: 2,
        maxMembers: 5,
        rewardPoints: 30,
      },
    },
  ],
};

// ============================================================================
// 遊戲 5：賈村秀場 — 多人合照派對（多人版）
// ============================================================================
const jiachunShowPhotoParty: GameModule = {
  id: "jiachun_show_photo_party",
  name: "賈村秀場：合照派對（多人版）",
  description:
    "10 分鐘短時間派對遊戲 — 全隊用搞笑造型合照、互相投票最酷造型，輕鬆突顯多人元件趣味",
  icon: "camera",
  estimatedTime: 10,
  maxPlayers: 8,
  difficulty: "easy",
  tags: ["派對", "趣味", "多人", "合照", "輕鬆"],
  category: "team",
  scenario: "適合活動暖場、團體破冰、家庭聚會、員工尾牙",
  highlights: [
    "📸 兩次合照（普通 + 搞笑造型）",
    "🗳️ 隊伍投票最酷造型",
    "😄 10 分鐘輕鬆好玩",
    "👥 適合 2-8 人",
  ],
  flowDescription:
    "歡迎進派對 → 主持人開場 → 第 1 張合照 → 最酷造型投票 → 第 2 張搞笑合照 → 主持人總結 → 結束",
  coverEmoji: "📸",
  gameMode: "team",
  pages: [
    {
      pageType: "text_card",
      title: "歡迎進派對",
      config: {
        title: "賈村秀場：合照派對",
        content:
          "歡迎來到賈村秀場！今天不練軍事不背知識，就是要好好玩！全隊一起拍兩張合照、投票選最酷造型、留下美好回憶。準備好你的笑容！",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 0,
      },
    },
    {
      pageType: "dialogue",
      title: "主持人開場",
      config: {
        character: { name: "派對主持人" },
        messages: [
          {
            text: "嗨～歡迎來到賈村秀場！我是今天的主持人。",
            emotion: "happy",
          },
          {
            text: "規則很簡單：兩張合照、一次投票，全程歡笑。準備好就開拍！",
            emotion: "happy",
          },
        ],
        typingSpeed: 30,
        autoAdvance: false,
        rewardPoints: 5,
      },
    },
    {
      pageType: "photo_team",
      title: "第 1 張：標準合照",
      config: {
        title: "標準版合照",
        instruction: "全隊規規矩矩拍一張正常合照",
        minMembers: 2,
        maxMembers: 8,
        rewardPoints: 15,
      },
    },
    {
      pageType: "vote_team",
      title: "投票：下一張要怎麼擺？",
      config: {
        title: "下一張造型主題",
        question: "全隊投票決定下一張合照主題 — 過半即執行",
        options: [
          { text: "🦸 超級英雄擺 pose" },
          { text: "💃 復古迪斯可" },
          { text: "🧘 假裝在打坐冥想" },
          { text: "🤡 集體大笑（誰能憋住誰輸）" },
        ],
        showResults: true,
        anonymousVoting: false,
        nextPageStrategy: "winner",
        autoAdvanceSeconds: 5,
      },
    },
    {
      pageType: "photo_team",
      title: "第 2 張：搞笑造型",
      config: {
        title: "搞笑造型合照",
        instruction: "依投票結果擺 pose 拍合照！",
        minMembers: 2,
        maxMembers: 8,
        rewardPoints: 25,
      },
    },
    {
      pageType: "dialogue",
      title: "主持人總結",
      config: {
        character: { name: "派對主持人" },
        messages: [
          {
            text: "完美！這兩張合照絕對是今晚最棒的回憶。",
            emotion: "happy",
          },
          {
            text: "謝謝大家配合演出，期待下次在賈村秀場再見！",
            emotion: "happy",
          },
        ],
        typingSpeed: 30,
        autoAdvance: false,
        rewardPoints: 5,
      },
    },
    {
      pageType: "text_card",
      title: "派對結束",
      config: {
        title: "🎉 派對完成！",
        content:
          "兩張合照都到手了！記得分享給朋友看你們的搞笑造型。下次再來賈村秀場玩～",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 20,
      },
    },
  ],
};

// ============================================================================
// 遊戲 6：賈村秀場 — 金門腦筋急轉彎（多人版）
// ============================================================================
const jiachunShowBrainQuiz: GameModule = {
  id: "jiachun_show_brain_quiz",
  name: "賈村秀場：金門腦筋急轉彎（多人版）",
  description:
    "12 分鐘輕鬆搶答派對遊戲 — 金門俗諺、笑話、地方特色題的隊伍搶答，反應快的搶分",
  icon: "lightbulb",
  estimatedTime: 12,
  maxPlayers: 8,
  difficulty: "easy",
  tags: ["派對", "搶答", "趣味", "多人", "金門"],
  category: "team",
  scenario: "適合活動暖場、家庭聚會、員工年會、夏令營",
  highlights: [
    "💡 金門俗諺 + 搞笑題搶答",
    "🏃 反應快的人搶分",
    "📷 全隊歡笑合照",
    "⏱️ 12 分鐘短時間活動",
  ],
  flowDescription:
    "歡迎開場 → 主持人介紹 → 規則說明 → 7 題輕鬆搶答 → 主持人點評 → 全隊合照 → 結束",
  coverEmoji: "💡",
  gameMode: "team",
  pages: [
    {
      pageType: "text_card",
      title: "歡迎",
      config: {
        title: "金門腦筋急轉彎",
        content:
          "輕鬆派對搶答時間！全隊一起挑戰金門俗諺、地方笑話、生活常識題。誰反應最快誰得分，最後看誰是隊內知識王～",
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
            text: "你好！今天是輕鬆版搶答，沒有壓力，就是看誰反應快～",
            emotion: "happy",
          },
          {
            text: "題目都跟金門有關，不會的話聽聽看別人的答案也不錯！",
            emotion: "happy",
          },
        ],
        typingSpeed: 30,
        autoAdvance: false,
        rewardPoints: 5,
      },
    },
    {
      pageType: "text_card",
      title: "規則說明",
      config: {
        title: "搶答規則",
        content:
          "📌 共 7 題輕鬆題\n📌 每題限時 25 秒\n📌 第一個答對的隊員得 10 分\n📌 答錯不扣分\n📌 全程歡笑為主，分數其次",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 0,
      },
    },
    {
      pageType: "choice_verify_race",
      title: "輕鬆搶答",
      config: {
        title: "金門腦筋急轉彎",
        questions: [
          {
            question: "金門人說「呷飽未」是什麼意思？",
            options: ["你吃什麼？", "你吃飽了嗎？", "今天天氣？", "去哪玩？"],
            correctAnswer: 1,
            explanation: "「呷飽未」是閩南語打招呼用語，等於「吃飽了嗎」。",
          },
          {
            question: "金門高粱酒度數最高約多少度？",
            options: ["38 度", "58 度", "75 度", "85 度"],
            correctAnswer: 2,
            explanation: "金門高粱有 58 度跟 75 度（玉露），75 度是高度數版本。",
          },
          {
            question: "如果在金門看到「碉堡」改成的咖啡廳叫什麼最合理？",
            options: ["陽光咖啡", "戰地咖啡", "海邊咖啡", "城市咖啡"],
            correctAnswer: 1,
            explanation: "金門特色就是把戰地遺跡改成觀光景點。",
          },
          {
            question: "金門名產「貢糖」是用什麼做的？",
            options: ["糯米", "麥芽糖+花生", "巧克力", "糖+牛奶"],
            correctAnswer: 1,
            explanation: "傳統貢糖以麥芽糖配花生製成。",
          },
          {
            question: "金門外型像什麼動物？",
            options: ["狗骨頭", "兔子", "魚", "螃蟹"],
            correctAnswer: 0,
            explanation: "金門島型常被形容為「狗骨頭」狀（兩端寬中間窄）。",
          },
          {
            question: "金門哪一個動物最常被當作鎮邪象徵？",
            options: ["龍", "風獅爺（獅）", "鳳凰", "麒麟"],
            correctAnswer: 1,
            explanation: "風獅爺是金門特有的鎮邪信仰。",
          },
          {
            question: "「金門菜刀」最著名的原料是什麼？",
            options: ["不銹鋼", "彈片砲彈（戰時遺留）", "陶瓷", "鈦合金"],
            correctAnswer: 1,
            explanation: "金門菜刀以早年戰時砲彈鋼材打造，是觀光名物。",
          },
        ],
        rewardPerQuestion: 10,
        timeLimit: 25,
      },
    },
    {
      pageType: "dialogue",
      title: "主持人點評",
      config: {
        character: { name: "金門小知識家" },
        messages: [
          {
            text: "答得真不錯！這些金門小知識希望你都記得。",
            emotion: "happy",
          },
          {
            text: "最後一張合照留念，今天就到這裡～",
            emotion: "happy",
          },
        ],
        typingSpeed: 30,
        autoAdvance: false,
        rewardPoints: 5,
      },
    },
    {
      pageType: "photo_team",
      title: "全隊合照",
      config: {
        title: "歡笑合影",
        instruction: "全隊留下這個歡樂時刻",
        minMembers: 2,
        maxMembers: 8,
        rewardPoints: 20,
      },
    },
    {
      pageType: "text_card",
      title: "活動結束",
      config: {
        title: "💡 完成！",
        content:
          "感謝你們參加金門腦筋急轉彎～希望你帶走的不只是分數，還有對金門的好印象。下次再來玩！",
        layout: "center",
        animation: "fade_in",
        rewardPoints: 15,
      },
    },
  ],
};

export const JIACHUN_MODULES: GameModule[] = [
  jiachunMultiplayerTreasure,
  jiachunTeamQuiz,
  jiachunArongMultiplayer,
  jiachunReconMultiplayer,
  jiachunShowPhotoParty,
  jiachunShowBrainQuiz,
];
