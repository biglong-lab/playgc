// 🏠 FloatingHomeButton — 全域浮動「回平台首頁」按鈕
//
// 解決的問題：玩家進到錯場域（例如點賈村卻顯示後浦），PWA standalone
// 模式下沒有瀏覽器返回鍵，且沒有持久 nav。沒地方可救援回平台。
//
// 設計依據：docs/PWA_USER_FLOW_OPTIMIZATION_V2.md Phase A
//
// 顯示原則：
//   - 左下角浮動（避開右下角 Walkie）
//   - 點擊跳 /f（場域選擇頁）
//   - 遊戲進行中、admin / platform 路徑隱藏（避免誤觸 / 不干擾沉浸感）
//   - 點擊前 confirm dialog「回平台首頁？離開當前場域」防誤觸

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** 應隱藏 FloatingHomeButton 的 path patterns */
function shouldHide(pathname: string): boolean {
  return (
    // 平台選擇頁本身不顯示（已經在那了）
    pathname === "/" ||
    pathname === "/f" ||
    pathname.startsWith("/f?") ||
    // 玩家在遊戲 / 地圖 / 隊伍 / 對戰中（避免誤觸打斷遊戲）
    /\/game\/|\/map\/|\/team\/|\/match\//.test(pathname) ||
    pathname.startsWith("/checkout/") ||
    pathname.startsWith("/purchase/") ||
    // admin / platform 路徑（不關玩家）
    pathname.startsWith("/admin") ||
    pathname.startsWith("/platform") ||
    // 公開分享頁（無 user）
    pathname.startsWith("/squad/") ||
    pathname.startsWith("/g/") ||
    // 認證頁
    pathname === "/login" ||
    pathname === "/signup"
  );
}

export default function FloatingHomeButton() {
  const [location, setLocation] = useLocation();
  const [showConfirm, setShowConfirm] = useState(false);

  if (shouldHide(location)) return null;

  const handleConfirm = () => {
    setShowConfirm(false);
    setLocation("/f");
  };

  return (
    <>
      <Button
        size="icon"
        variant="secondary"
        className="md:hidden fixed bottom-20 left-4 z-30 h-11 w-11 rounded-full shadow-lg bg-background/95 backdrop-blur border border-border hover:bg-muted"
        onClick={() => setShowConfirm(true)}
        data-testid="btn-floating-home"
        aria-label="回平台首頁"
        title="回平台首頁"
      >
        <Home className="w-5 h-5" />
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent data-testid="floating-home-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>回平台首頁？</AlertDialogTitle>
            <AlertDialogDescription>
              離開當前場域，回到 CHITO 平台首頁重新選擇場域。
              <br />
              <span className="text-xs text-muted-foreground">
                適用於：意外進到錯誤場域時的救援動線
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-floating-home-cancel">
              留在這裡
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              data-testid="btn-floating-home-confirm"
            >
              回平台首頁
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
