// 裝置管理常數定義
import {
  Home, Gamepad2, Activity, Cpu, BarChart3, Trophy, Settings,
  Lightbulb, Power, Zap, TrendingUp,
} from "lucide-react";

export const menuItems = [
  { title: "總覽", icon: Home, path: "/admin" },
  { title: "遊戲管理", icon: Gamepad2, path: "/admin/games" },
  { title: "進行中場次", icon: Activity, path: "/admin/sessions" },
  { title: "設備管理", icon: Cpu, path: "/admin/devices" },
  { title: "數據分析", icon: BarChart3, path: "/admin/analytics" },
  { title: "排行榜", icon: Trophy, path: "/admin/leaderboard" },
  { title: "系統設定", icon: Settings, path: "/admin/settings" },
] as const;

export const DEVICE_TYPES = [
  { value: "shooting_target", label: "射擊靶機" },
  { value: "sensor", label: "感應器" },
  { value: "trigger", label: "觸發器" },
  { value: "display", label: "顯示器" },
  { value: "controller", label: "控制器" },
] as const;

export const LED_MODES = [
  { value: "solid", label: "常亮", icon: Lightbulb },
  { value: "off", label: "關閉", icon: Power },
  { value: "blink", label: "閃爍", icon: Zap },
  { value: "pulse", label: "呼吸", icon: Activity },
  { value: "rainbow", label: "彩虹", icon: TrendingUp },
] as const;

export const LED_COLORS = [
  { value: "green", color: { r: 0, g: 255, b: 0 }, label: "綠色" },
  { value: "red", color: { r: 255, g: 0, b: 0 }, label: "紅色" },
  { value: "blue", color: { r: 0, g: 0, b: 255 }, label: "藍色" },
  { value: "yellow", color: { r: 255, g: 255, b: 0 }, label: "黃色" },
  { value: "orange", color: { r: 255, g: 165, b: 0 }, label: "橙色" },
  { value: "purple", color: { r: 128, g: 0, b: 128 }, label: "紫色" },
  { value: "white", color: { r: 255, g: 255, b: 255 }, label: "白色" },
] as const;
