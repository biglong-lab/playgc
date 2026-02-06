// 遊戲管理共用型別

export interface GameFormData {
  title: string;
  description: string;
  difficulty: string;
  estimatedTime: string;
  maxPlayers: string;
}

export const DEFAULT_FORM_DATA: GameFormData = {
  title: "",
  description: "",
  difficulty: "medium",
  estimatedTime: "",
  maxPlayers: "6",
};
