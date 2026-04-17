// 🛡️ 統一權限不足頁面
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

interface ForbiddenPageProps {
  /** 標題（預設「權限不足」） */
  title?: string;
  /** 說明文字 */
  description?: string;
  /** 建議前往的路徑 */
  suggestedPath?: string;
  /** 建議按鈕文字 */
  suggestedLabel?: string;
}

export default function ForbiddenPage({
  title = "權限不足",
  description = "你沒有存取此頁面的權限",
  suggestedPath = "/admin",
  suggestedLabel = "返回管理後台",
}: ForbiddenPageProps) {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-10 pb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">🛡️ {title}</h1>
          <p className="text-sm text-muted-foreground mb-6">{description}</p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              回上一頁
            </Button>
            <Link href={suggestedPath}>
              <Button size="sm">
                <Home className="w-4 h-4 mr-1" />
                {suggestedLabel}
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            若你認為這是錯誤，請聯絡管理員
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
