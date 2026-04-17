// 👤 玩家端底部導航（手機版） — 三世界切換
import { Link, useLocation } from "wouter";
import { Gamepad2, Swords, User } from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (loc: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: "/home",
    label: "遊戲世界",
    emoji: "🎮",
    icon: Gamepad2,
    isActive: (loc) =>
      loc === "/home" ||
      loc === "/games" ||
      loc === "/leaderboard" ||
      loc.startsWith("/games/"),
  },
  {
    path: "/battle",
    label: "競技擂台",
    emoji: "⚔️",
    icon: Swords,
    isActive: (loc) => loc === "/battle" || loc.startsWith("/battle/"),
  },
  {
    path: "/me",
    label: "會員中心",
    emoji: "💳",
    icon: User,
    isActive: (loc) =>
      loc === "/me" || loc.startsWith("/me/") || loc === "/purchases",
  },
];

export default function PlayerBottomNav() {
  const [location] = useLocation();

  // 以下路徑不顯示 bottom nav（避免干擾沉浸體驗）
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
    location.startsWith("/g/");

  if (shouldHide) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-3 h-16">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(location);
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <a
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-base leading-none">{item.emoji}</span>
                  <Icon className={`w-4 h-4 ${active ? "scale-110" : ""}`} />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
