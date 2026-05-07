// 遊戲管理共用型別

export interface GameFormData {
  title: string;
  description: string;
  difficulty: string;
  estimatedTime: string;
  maxPlayers: string;
  /** 遊戲模式：individual=個人；team/competitive/relay=多人各種類型
   *  影響：playerMode 推導（個人=solo / 多人=multi）+ 元件分類約束
   *  詳見 docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §2.4 */
  gameMode: string;
  /** 🆕 2026-05-07 BGM：整場背景音樂 URL（Cloudinary 或外部 audio）*/
  bgmUrl: string;
}

export const DEFAULT_FORM_DATA: GameFormData = {
  title: "",
  description: "",
  difficulty: "medium",
  estimatedTime: "",
  maxPlayers: "6",
  gameMode: "individual",
  bgmUrl: "",
};
