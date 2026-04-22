// 🎨 通用 Lucide 圖示選擇器
//
// 用途：取代 ButtonConfigEditor、Achievement、Item 等地方「讓管理員手寫 icon 名」的做法
// 管理員在後台可直接看著圖示選，不用記 Lucide 字串
//
// 使用：
//   <IconPicker value={iconName} onChange={setIconName} allowEmpty />
//
// 範圍：精選 ~60 個常用圖示，依類別分組。若未來需要更多可加到 ICON_CATALOG。
import { useState, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  // 動作 / 戰鬥
  Sword, Shield, Target, Zap, Bomb, Crosshair, Flame, Swords,
  // 情感 / 角色
  Heart, Star, Smile, Frown, Angry, Ghost, User, Users,
  // 物件 / 道具
  Key, Gem, Coins, Gift, Package, Backpack, Scroll, Book,
  FileText, Map, Compass, Flag, Award, Trophy, Crown, Shell,
  // 工具
  Wrench, Hammer, Lightbulb, Lock, Unlock, Search, Eye, EyeOff,
  // 自然 / 地點
  Home, Building, Mountain, TreePine, Droplet, Sun, Moon, Cloud,
  // 方向 / 動作
  Play, Pause, SkipForward, ArrowRight, ArrowLeft, Check, X,
  // 其他
  Sparkles, CircleHelp, Camera, Music, MapPin, QrCode, Trash2, Plus,
  // 圖示組件本身
  type LucideIcon,
} from "lucide-react";

export interface IconDefinition {
  name: string;
  label: string;
  icon: LucideIcon;
  category: string;
}

// 📚 精選圖示目錄（約 60 個）— 依遊戲情境分類
export const ICON_CATALOG: IconDefinition[] = [
  // 戰鬥 / 動作
  { name: "Sword", label: "劍", icon: Sword, category: "戰鬥" },
  { name: "Swords", label: "雙劍", icon: Swords, category: "戰鬥" },
  { name: "Shield", label: "盾", icon: Shield, category: "戰鬥" },
  { name: "Target", label: "靶", icon: Target, category: "戰鬥" },
  { name: "Crosshair", label: "瞄準", icon: Crosshair, category: "戰鬥" },
  { name: "Bomb", label: "炸彈", icon: Bomb, category: "戰鬥" },
  { name: "Zap", label: "閃電", icon: Zap, category: "戰鬥" },
  { name: "Flame", label: "火焰", icon: Flame, category: "戰鬥" },

  // 情感 / 角色
  { name: "Heart", label: "愛心", icon: Heart, category: "情感" },
  { name: "Star", label: "星星", icon: Star, category: "情感" },
  { name: "Smile", label: "微笑", icon: Smile, category: "情感" },
  { name: "Frown", label: "難過", icon: Frown, category: "情感" },
  { name: "Angry", label: "生氣", icon: Angry, category: "情感" },
  { name: "Ghost", label: "幽靈", icon: Ghost, category: "情感" },
  { name: "User", label: "人物", icon: User, category: "情感" },
  { name: "Users", label: "多人", icon: Users, category: "情感" },

  // 物件 / 道具
  { name: "Key", label: "鑰匙", icon: Key, category: "道具" },
  { name: "Gem", label: "寶石", icon: Gem, category: "道具" },
  { name: "Coins", label: "金幣", icon: Coins, category: "道具" },
  { name: "Gift", label: "禮物", icon: Gift, category: "道具" },
  { name: "Package", label: "包裹", icon: Package, category: "道具" },
  { name: "Backpack", label: "背包", icon: Backpack, category: "道具" },
  { name: "Scroll", label: "卷軸", icon: Scroll, category: "道具" },
  { name: "Book", label: "書", icon: Book, category: "道具" },
  { name: "FileText", label: "文件", icon: FileText, category: "道具" },

  // 探索 / 地點
  { name: "Map", label: "地圖", icon: Map, category: "探索" },
  { name: "MapPin", label: "地標", icon: MapPin, category: "探索" },
  { name: "Compass", label: "羅盤", icon: Compass, category: "探索" },
  { name: "Flag", label: "旗幟", icon: Flag, category: "探索" },
  { name: "Home", label: "家", icon: Home, category: "探索" },
  { name: "Building", label: "建築", icon: Building, category: "探索" },
  { name: "Mountain", label: "山", icon: Mountain, category: "探索" },
  { name: "TreePine", label: "樹", icon: TreePine, category: "探索" },

  // 成就 / 榮譽
  { name: "Award", label: "勳章", icon: Award, category: "榮譽" },
  { name: "Trophy", label: "獎盃", icon: Trophy, category: "榮譽" },
  { name: "Crown", label: "皇冠", icon: Crown, category: "榮譽" },
  { name: "Shell", label: "貝殼", icon: Shell, category: "榮譽" },
  { name: "Sparkles", label: "閃耀", icon: Sparkles, category: "榮譽" },

  // 工具 / 機制
  { name: "Wrench", label: "扳手", icon: Wrench, category: "工具" },
  { name: "Hammer", label: "鎚子", icon: Hammer, category: "工具" },
  { name: "Lightbulb", label: "燈泡", icon: Lightbulb, category: "工具" },
  { name: "Lock", label: "鎖", icon: Lock, category: "工具" },
  { name: "Unlock", label: "開鎖", icon: Unlock, category: "工具" },
  { name: "Search", label: "搜尋", icon: Search, category: "工具" },
  { name: "Eye", label: "眼", icon: Eye, category: "工具" },
  { name: "EyeOff", label: "閉眼", icon: EyeOff, category: "工具" },
  { name: "Camera", label: "相機", icon: Camera, category: "工具" },
  { name: "QrCode", label: "QR 碼", icon: QrCode, category: "工具" },
  { name: "Music", label: "音樂", icon: Music, category: "工具" },

  // 自然
  { name: "Droplet", label: "水滴", icon: Droplet, category: "自然" },
  { name: "Sun", label: "太陽", icon: Sun, category: "自然" },
  { name: "Moon", label: "月亮", icon: Moon, category: "自然" },
  { name: "Cloud", label: "雲", icon: Cloud, category: "自然" },

  // 控制 / 操作
  { name: "Play", label: "播放", icon: Play, category: "控制" },
  { name: "Pause", label: "暫停", icon: Pause, category: "控制" },
  { name: "SkipForward", label: "跳過", icon: SkipForward, category: "控制" },
  { name: "ArrowRight", label: "→", icon: ArrowRight, category: "控制" },
  { name: "ArrowLeft", label: "←", icon: ArrowLeft, category: "控制" },
  { name: "Check", label: "✓", icon: Check, category: "控制" },
  { name: "X", label: "✗", icon: X, category: "控制" },
  { name: "Plus", label: "+", icon: Plus, category: "控制" },
  { name: "Trash2", label: "刪除", icon: Trash2, category: "控制" },
  { name: "CircleHelp", label: "?", icon: CircleHelp, category: "控制" },
];

/**
 * 以 name 查找圖示元件（未找到回傳 null，caller 需自己給 fallback）
 */
export function getIconByName(name?: string | null): LucideIcon | null {
  if (!name) return null;
  const found = ICON_CATALOG.find((i) => i.name === name);
  return found?.icon ?? null;
}

// ============================================================================
// IconPicker 元件
// ============================================================================

interface IconPickerProps {
  /** 目前選中的圖示名 */
  value?: string | null;
  onChange: (iconName: string) => void;
  /** 是否允許「無圖示」 */
  allowEmpty?: boolean;
  /** 按鈕大小 */
  size?: "sm" | "md";
  /** data-testid */
  testId?: string;
  /** placeholder（未選時顯示的文字） */
  placeholder?: string;
}

export function IconPicker({
  value,
  onChange,
  allowEmpty = false,
  size = "md",
  testId,
  placeholder = "選擇圖示...",
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const currentIcon = getIconByName(value);
  const CurrentIconComponent = currentIcon;

  // 按類別分組 + 搜尋過濾
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? ICON_CATALOG.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.label.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q),
        )
      : ICON_CATALOG;

    const groups: Record<string, IconDefinition[]> = {};
    for (const icon of filtered) {
      if (!groups[icon.category]) groups[icon.category] = [];
      groups[icon.category].push(icon);
    }
    return groups;
  }, [search]);

  const buttonSize = size === "sm" ? "h-8 text-xs" : "h-10";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start gap-2 ${buttonSize}`}
          data-testid={testId}
          type="button"
        >
          {CurrentIconComponent ? (
            <>
              <CurrentIconComponent className="w-4 h-4" />
              <span className="text-sm">{value}</span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] max-h-[440px] overflow-hidden flex flex-col p-0"
        align="start"
      >
        <div className="p-2 border-b">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋圖示（例：Sword / 劍 / 戰鬥）"
            className="h-8 text-sm"
            autoFocus
          />
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-3">
          {allowEmpty && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent flex items-center gap-2 ${
                !value ? "bg-primary/10 ring-1 ring-primary/30" : ""
              }`}
            >
              <span className="w-4 h-4 inline-block border border-dashed border-muted-foreground rounded" />
              <span className="text-muted-foreground">（無圖示）</span>
            </button>
          )}

          {Object.keys(grouped).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              找不到圖示，試試其他關鍵字
            </p>
          ) : (
            Object.entries(grouped).map(([category, icons]) => (
              <div key={category}>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
                  {category}
                </p>
                <div className="grid grid-cols-6 gap-1">
                  {icons.map((iconDef) => {
                    const IconCmp = iconDef.icon;
                    const selected = value === iconDef.name;
                    return (
                      <button
                        key={iconDef.name}
                        type="button"
                        onClick={() => {
                          onChange(iconDef.name);
                          setOpen(false);
                        }}
                        className={`p-2 rounded hover:bg-accent flex items-center justify-center aspect-square transition-colors ${
                          selected ? "bg-primary/15 ring-1 ring-primary" : ""
                        }`}
                        title={`${iconDef.name} — ${iconDef.label}`}
                      >
                        <IconCmp className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-2 border-t text-xs text-muted-foreground">
          {ICON_CATALOG.length} 個圖示 · 需要更多可在 IconPicker.tsx 擴充
        </div>
      </PopoverContent>
    </Popover>
  );
}
