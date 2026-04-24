// 👤 玩家端底部導航（手機版） — 三世界切換
// 🎨 設計原則：單一 icon（線稿）+ 文字，無重複符號，有質感
import { Link, useLocation } from "wouter";
import { Gamepad2, Swords, User } from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  isActive: (loc: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: "/home",
    label: "遊戲",
    icon: Gamepad2,
    isActive: (loc) =>
      loc === "/home" ||
      loc === "/games" ||
      loc === "/leaderboard" ||
      loc.startsWith("/games/"),
  },
  {
    path: "/battle",
    label: "擂台",
    icon: Swords,
    isActive: (loc) => loc === "/battle" || loc.startsWith("/battle/"),
  },
  {
    path: "/me",
    label: "我的",
    icon: User,
    isActive: (loc) =>
      loc === "/me" || loc.startsWith("/me/") || loc === "/purchases",
  },
];

export default function PlayerBottomNav() {
  const [location] = useLocation();

  // 以下路徑不顯示 bottom nav（避免干擾沉浸體驗 + 避免遮住遊戲按鈕）
  const shouldHide =
    location === "/" ||
    location.startsWith("/game/") ||
    location.startsWith("/map/") ||
    location.startsWith("/team/") ||
    location.startsWith("/match/") ||
    location.startsWith("/checkout/") ||
    location.startsWith("/purchase/") ||
    location.startsWith("/admin") ||
    location.startsWith("/platform") ||
    location.startsWith("/g/") ||
    // 🎯 場域遊戲路徑（/f/{code}/game/...、/f/{code}/map/..., 等）也要隱藏
    /^\/f\/[^/]+\/(game|map|team|match|purchase)\//.test(location) ||
    /^\/f\/[^/]+\/game\/[^/]+$/.test(location);

  if (shouldHide) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      data-testid="player-bottom-nav"
    >
      <div className="grid grid-cols-3 h-14">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(location);
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <a
                className={`flex flex-col items-center justify-center gap-1 transition-all ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`nav-${item.path.slice(1)}`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    active ? "scale-110" : ""
                  }`}
                  strokeWidth={active ? 2.2 : 1.6}
                />
                <span
                  className={`text-[11px] tracking-wide ${
                    active ? "font-semibold" : "font-normal"
                  }`}
                >
                  {item.label}
                </span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
