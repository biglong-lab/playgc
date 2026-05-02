// 🔄 BattleClanCreate — 已棄用，redirect 到統一的 /squad/create
//
// PR6 收尾（Squad 一次到位 6/6）：
//   舊「水彈戰隊建立」入口 deprecated，全站統一用 SquadCreate 建立永久隊伍。
//   水彈戰績仍可寫入該 squad（透過 squad_ratings.gameType="battle" 獨立記分）。
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function BattleClanCreate() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // 立即 redirect 到統一 SquadCreate（取代 battle 專屬流程）
    navigate("/squad/create");
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center space-y-3">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            正在帶你到隊伍建立頁...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
