// 💳 會員中心 — 整合玩家所有個人資料的單一入口
// 整合：購買記錄 / 對戰戰績 / 成就 / 通知 / 兌換碼 / 我的場域
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Ticket,
  Receipt,
  Swords,
  Trophy,
  Bell,
  LogOut,
  ChevronRight,
  Gift,
  Gamepad2,
  Building2,
  Shield,
} from "lucide-react";

interface MembershipSummary {
  fieldId: string;
  fieldCode: string;
  fieldName: string;
  joinedAt: string;
  isAdmin: boolean;
  adminRoleName: string | null;
  playerStatus: string;
}

export default function MeCenter() {
  const { user, firebaseUser, isSignedIn, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // 🎫 我的場域會員身份（跨場域整合）
  const { data: membershipsData } = useQuery<{ memberships: MembershipSummary[] }>({
    queryKey: ["/api/me/memberships"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/memberships");
      return res.json();
    },
    enabled: isSignedIn,
  });
  const memberships = membershipsData?.memberships ?? [];
  const adminMemberships = memberships.filter((m) => m.isAdmin);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn || !user) {
    setLocation("/");
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const displayName =
    user.firstName || user.email?.split("@")[0] || "玩家";
  const initials = (user.firstName?.[0] || user.email?.[0] || "U").toUpperCase();

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-8">
      {/* Hero 區 — 綠色系品牌 */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white pb-12 pt-6 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Avatar className="w-14 h-14 border-2 border-white/40">
              <AvatarImage
                src={firebaseUser?.photoURL || user.profileImageUrl || undefined}
              />
              <AvatarFallback className="bg-white/20 text-white text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-100">歡迎回來</p>
              <h1 className="text-xl font-bold truncate">{displayName}</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-white hover:bg-white/10"
              aria-label="登出"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>

          <h2 className="text-2xl font-bold mb-1">💳 會員中心</h2>
          <p className="text-emerald-50 text-sm">
            你的票券、戰績、成就與通知
          </p>
        </div>
      </div>

      {/* 內容區 — 拉起來蓋住 Hero 底部 */}
      <div className="container mx-auto max-w-2xl px-4 -mt-6 space-y-4">
        {/* 兌換碼快速輸入 */}
        <Card className="border-emerald-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Gift className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">使用兌換碼</p>
                <p className="text-xs text-muted-foreground">
                  輸入兌換碼解鎖遊戲或對戰名額
                </p>
              </div>
              <Button size="sm" variant="outline" disabled>
                即將開放
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 主要功能卡片 — 2x2 Grid */}
        <div className="grid grid-cols-2 gap-3">
          <MenuCard
            href="/purchases"
            icon={<Receipt className="w-5 h-5" />}
            label="我的購買"
            accent="emerald"
            description="遊戲門票與訂單"
          />
          <MenuCard
            href="/battle/history"
            icon={<Swords className="w-5 h-5" />}
            label="對戰戰績"
            accent="rose"
            description="歷史對戰與排名"
          />
          <MenuCard
            href="/battle/achievements"
            icon={<Trophy className="w-5 h-5" />}
            label="我的成就"
            accent="amber"
            description="徽章與里程碑"
          />
          <MenuCard
            href="/battle/notifications"
            icon={<Bell className="w-5 h-5" />}
            label="通知中心"
            accent="blue"
            description="報名確認與提醒"
          />
        </div>

        {/* 次要功能列表 */}
        <Card>
          <CardContent className="p-0">
            <MenuRow
              href="/battle/my"
              icon={<Swords className="w-4 h-4" />}
              label="我的對戰檔案"
              sublabel="ELO 排名、戰隊、報名"
            />
            <div className="border-t" />
            <MenuRow
              href="/battle/seasons"
              icon={<Trophy className="w-4 h-4" />}
              label="賽季歷史"
              sublabel="過往賽季戰績"
            />
            <div className="border-t" />
            <MenuRow
              href="/leaderboard"
              icon={<Gamepad2 className="w-4 h-4" />}
              label="遊戲排行榜"
              sublabel="全站遊戲排名"
            />
          </CardContent>
        </Card>

        {/* 版本資訊 */}
        <p className="text-center text-xs text-muted-foreground py-4">
          賈村競技場 · 版本 v4.0
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// 子元件
// ============================================================================

function MenuCard({
  href,
  icon,
  label,
  description,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  accent: "emerald" | "rose" | "amber" | "blue";
}) {
  const accentClasses = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/30",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
  };
  return (
    <Link href={href}>
      <Card className="hover:border-primary/50 cursor-pointer active:scale-[0.98] transition-all h-full">
        <CardContent className="p-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${accentClasses[accent]}`}
          >
            {icon}
          </div>
          <p className="font-medium text-sm mb-0.5">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function MenuRow({
  href,
  icon,
  label,
  sublabel,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
}) {
  return (
    <Link href={href}>
      <a className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {sublabel && (
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </a>
    </Link>
  );
}
