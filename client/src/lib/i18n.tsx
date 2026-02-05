import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Language = "zh-TW" | "en";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations: Record<Language, Record<string, string>> = {
  "zh-TW": {
    "app.title": "賈村競技體驗場",
    "app.subtitle": "實境解謎遊戲平台",
    "nav.home": "首頁",
    "nav.games": "遊戲大廳",
    "nav.map": "地圖",
    "nav.leaderboard": "排行榜",
    "nav.admin": "管理後台",
    "nav.login": "登入",
    "nav.logout": "登出",
    
    "landing.hero.title": "賈村競技體驗場",
    "landing.hero.subtitle": "體驗全新的實境解謎冒險",
    "landing.hero.cta": "開始遊戲",
    "landing.features.shooting": "射擊挑戰",
    "landing.features.shooting.desc": "使用實體靶機進行射擊任務",
    "landing.features.gps": "GPS 導航",
    "landing.features.gps.desc": "跟隨地圖指引探索場域",
    "landing.features.photo": "拍照任務",
    "landing.features.photo.desc": "用相機記錄你的發現",
    "landing.features.team": "團隊協作",
    "landing.features.team.desc": "與隊友即時溝通完成任務",
    
    "game.start": "開始遊戲",
    "game.continue": "繼續遊戲",
    "game.join": "加入遊戲",
    "game.complete": "完成",
    "game.next": "下一步",
    "game.back": "返回",
    "game.submit": "提交",
    "game.verify": "驗證",
    "game.loading": "載入中...",
    "game.difficulty": "難度",
    "game.duration": "預計時間",
    "game.minutes": "分鐘",
    "game.players": "玩家人數",
    
    "shooting.title": "射擊任務",
    "shooting.start": "開始任務",
    "shooting.timeLimit": "時間限制",
    "shooting.requiredHits": "需要命中",
    "shooting.hits": "命中數",
    "shooting.score": "總分",
    "shooting.remaining": "剩餘時間",
    "shooting.bullseye": "正中紅心!",
    "shooting.inner": "命中內環!",
    "shooting.outer": "命中外環!",
    "shooting.miss": "脫靶",
    "shooting.complete": "任務完成!",
    "shooting.failed": "任務失敗",
    "shooting.connected": "靶機已連接",
    "shooting.connecting": "連接中...",
    "shooting.disconnected": "未連接",
    "shooting.simulate": "模擬命中 (測試用)",
    
    "gps.title": "GPS 任務",
    "gps.findLocation": "前往指定地點",
    "gps.distance": "距離目標",
    "gps.meters": "公尺",
    "gps.arrived": "已到達目標地點!",
    "gps.navigating": "導航中...",
    
    "photo.title": "拍照任務",
    "photo.takePhoto": "拍照",
    "photo.retake": "重拍",
    "photo.upload": "上傳照片",
    "photo.uploading": "上傳中...",
    "photo.success": "照片已上傳",
    
    "qr.title": "QR 掃描",
    "qr.scan": "掃描 QR Code",
    "qr.scanning": "掃描中...",
    "qr.success": "掃描成功!",
    "qr.invalid": "無效的 QR Code",
    
    "chat.title": "團隊聊天",
    "chat.send": "發送",
    "chat.placeholder": "輸入訊息...",
    "chat.joined": "加入了聊天室",
    "chat.left": "離開了聊天室",
    
    "admin.dashboard": "總覽",
    "admin.games": "遊戲管理",
    "admin.sessions": "進行中場次",
    "admin.devices": "設備管理",
    "admin.analytics": "數據分析",
    "admin.leaderboard": "排行榜",
    "admin.settings": "系統設定",
    "admin.newGame": "新增遊戲",
    "admin.addDevice": "新增設備",
    
    "device.name": "設備名稱",
    "device.type": "設備類型",
    "device.topic": "MQTT Topic",
    "device.location": "安裝位置",
    "device.status.online": "在線",
    "device.status.offline": "離線",
    "device.activate": "啟動",
    "device.deactivate": "停用",
    "device.edit": "編輯",
    "device.delete": "刪除",
    
    "analytics.overview": "數據總覽",
    "analytics.totalSessions": "總遊戲場次",
    "analytics.completionRate": "完成率",
    "analytics.activeSessions": "進行中場次",
    "analytics.avgPlayTime": "平均遊戲時間",
    "analytics.todaySessions": "今日場次",
    "analytics.trend": "近7日趨勢",
    "analytics.gameStats": "遊戲統計",
    "analytics.recentSessions": "最近場次",
    
    "common.save": "儲存",
    "common.cancel": "取消",
    "common.edit": "編輯",
    "common.delete": "刪除",
    "common.confirm": "確認",
    "common.success": "成功",
    "common.error": "錯誤",
    "common.loading": "載入中...",
    "common.noData": "尚無資料",
  },
  "en": {
    "app.title": "Jiachun Experience Field",
    "app.subtitle": "Reality Game Platform",
    "nav.home": "Home",
    "nav.games": "Games",
    "nav.map": "Map",
    "nav.leaderboard": "Leaderboard",
    "nav.admin": "Admin",
    "nav.login": "Login",
    "nav.logout": "Logout",
    
    "landing.hero.title": "Jiachun Experience Field",
    "landing.hero.subtitle": "Experience immersive reality gaming",
    "landing.hero.cta": "Start Playing",
    "landing.features.shooting": "Shooting Challenges",
    "landing.features.shooting.desc": "Complete shooting missions with real targets",
    "landing.features.gps": "GPS Navigation",
    "landing.features.gps.desc": "Explore the field with map guidance",
    "landing.features.photo": "Photo Missions",
    "landing.features.photo.desc": "Capture your discoveries with camera",
    "landing.features.team": "Team Collaboration",
    "landing.features.team.desc": "Communicate in real-time with teammates",
    
    "game.start": "Start Game",
    "game.continue": "Continue",
    "game.join": "Join Game",
    "game.complete": "Complete",
    "game.next": "Next",
    "game.back": "Back",
    "game.submit": "Submit",
    "game.verify": "Verify",
    "game.loading": "Loading...",
    "game.difficulty": "Difficulty",
    "game.duration": "Estimated Time",
    "game.minutes": "minutes",
    "game.players": "Players",
    
    "shooting.title": "Shooting Mission",
    "shooting.start": "Start Mission",
    "shooting.timeLimit": "Time Limit",
    "shooting.requiredHits": "Required Hits",
    "shooting.hits": "Hits",
    "shooting.score": "Score",
    "shooting.remaining": "Remaining",
    "shooting.bullseye": "Bullseye!",
    "shooting.inner": "Inner ring!",
    "shooting.outer": "Outer ring!",
    "shooting.miss": "Miss",
    "shooting.complete": "Mission Complete!",
    "shooting.failed": "Mission Failed",
    "shooting.connected": "Target Connected",
    "shooting.connecting": "Connecting...",
    "shooting.disconnected": "Disconnected",
    "shooting.simulate": "Simulate Hit (Test)",
    
    "gps.title": "GPS Mission",
    "gps.findLocation": "Navigate to location",
    "gps.distance": "Distance to target",
    "gps.meters": "meters",
    "gps.arrived": "You have arrived!",
    "gps.navigating": "Navigating...",
    
    "photo.title": "Photo Mission",
    "photo.takePhoto": "Take Photo",
    "photo.retake": "Retake",
    "photo.upload": "Upload Photo",
    "photo.uploading": "Uploading...",
    "photo.success": "Photo uploaded",
    
    "qr.title": "QR Scan",
    "qr.scan": "Scan QR Code",
    "qr.scanning": "Scanning...",
    "qr.success": "Scan successful!",
    "qr.invalid": "Invalid QR Code",
    
    "chat.title": "Team Chat",
    "chat.send": "Send",
    "chat.placeholder": "Type a message...",
    "chat.joined": "joined the chat",
    "chat.left": "left the chat",
    
    "admin.dashboard": "Dashboard",
    "admin.games": "Games",
    "admin.sessions": "Active Sessions",
    "admin.devices": "Devices",
    "admin.analytics": "Analytics",
    "admin.leaderboard": "Leaderboard",
    "admin.settings": "Settings",
    "admin.newGame": "New Game",
    "admin.addDevice": "Add Device",
    
    "device.name": "Device Name",
    "device.type": "Device Type",
    "device.topic": "MQTT Topic",
    "device.location": "Location",
    "device.status.online": "Online",
    "device.status.offline": "Offline",
    "device.activate": "Activate",
    "device.deactivate": "Deactivate",
    "device.edit": "Edit",
    "device.delete": "Delete",
    
    "analytics.overview": "Overview",
    "analytics.totalSessions": "Total Sessions",
    "analytics.completionRate": "Completion Rate",
    "analytics.activeSessions": "Active Sessions",
    "analytics.avgPlayTime": "Avg Play Time",
    "analytics.todaySessions": "Today's Sessions",
    "analytics.trend": "7-Day Trend",
    "analytics.gameStats": "Game Statistics",
    "analytics.recentSessions": "Recent Sessions",
    
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.confirm": "Confirm",
    "common.success": "Success",
    "common.error": "Error",
    "common.loading": "Loading...",
    "common.noData": "No data",
  },
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("language") as Language;
      if (saved && (saved === "zh-TW" || saved === "en")) {
        return saved;
      }
      const browserLang = navigator.language;
      if (browserLang.startsWith("zh")) {
        return "zh-TW";
      }
    }
    return "zh-TW";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("language", lang);
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    let text = translations[language][key] || translations["zh-TW"][key] || key;
    
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(`{${paramKey}}`, String(value));
      });
    }
    
    return text;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  return (
    <button
      onClick={() => setLanguage(language === "zh-TW" ? "en" : "zh-TW")}
      className="px-3 py-1.5 rounded-md text-sm font-medium bg-card border border-border hover:bg-accent transition-colors"
      data-testid="button-language-switch"
    >
      {language === "zh-TW" ? "EN" : "中文"}
    </button>
  );
}
