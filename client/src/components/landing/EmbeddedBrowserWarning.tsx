import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** 偵測是否為 App 內建瀏覽器（LINE、FB、IG、微信等）
 *
 * ⚠️ 過去版本的 bug：用 `.0.0.0` 判斷會誤觸發 — 因為 Chrome Android 的 reduced UA
 * 固定格式 `Chrome/131.0.0.0`，所有正常 Chrome 都會命中這條規則，導致誤判。
 *
 * 正確策略：
 * 1. 具名 App UA（LINE/FB/IG/WeChat/TikTok 等）嚴格匹配
 * 2. Android WebView 唯一可靠信號是 `; wv)` token（必須用 word boundary）
 * 3. iOS in-app 無 WebView 標記，只靠具名 UA 判斷
 */
export function isEmbeddedBrowser(): boolean {
  const userAgent =
    navigator.userAgent || navigator.vendor || (window as never as { opera: string }).opera || "";
  const patterns = [
    /line\//i, /fbav/i, /fban/i, /fb_iab/i, /instagram/i, /twitter/i,
    /wechat/i, /micromessenger/i, /weibo/i, /qq\//i, /linkedinapp/i,
    /snapchat/i, /pinterest/i, /tiktok/i, /bytedance/i,
  ];
  for (const pattern of patterns) {
    if (pattern.test(userAgent)) return true;
  }
  // Android WebView：獨立的 `; wv)` token（用 word boundary，不要誤匹配 Chrome/WebView-based 字串）
  if (/android/i.test(userAgent) && /;\s*wv\)/i.test(userAgent)) return true;
  return false;
}

/** 嵌入式瀏覽器警告橫幅 + 「在瀏覽器中開啟」引導 */
export function EmbeddedBrowserWarning() {
  const { toast } = useToast();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isEmbeddedBrowser());
  }, []);

  if (!show) return null;

  const handleOpenInBrowser = () => {
    const currentUrl = window.location.href;
    const ua = navigator.userAgent.toLowerCase();

    // LINE 瀏覽器嘗試 intent scheme
    if (/line\//i.test(ua)) {
      window.location.href = `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
      setTimeout(() => copyUrlFallback(currentUrl, toast), 500);
      return;
    }

    // iOS 嘗試 x-safari-https scheme
    if (/iphone|ipad|ipod/i.test(ua)) {
      window.location.href = currentUrl.replace("https://", "x-safari-https://");
      setTimeout(() => copyUrlFallback(currentUrl, toast), 500);
      return;
    }

    // 預設：複製網址
    copyUrlFallback(currentUrl, toast);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-4 text-center shadow-lg">
      <div className="flex items-center justify-center gap-3 flex-wrap mb-2">
        <AlertTriangle className="w-6 h-6" />
        <span className="font-bold text-lg">無法使用 Google 登入</span>
      </div>
      <p className="text-sm mb-3">
        您正在使用 App 內建瀏覽器（如 LINE、Facebook），Google 不允許在此環境登入。
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
        <Button
          size="default"
          variant="secondary"
          onClick={handleOpenInBrowser}
          className="gap-2 bg-white text-red-600 hover:bg-gray-100"
        >
          <ExternalLink className="w-5 h-5" />
          在瀏覽器中開啟
        </Button>
        <span className="text-xs opacity-80">
          或手動複製網址到 Safari / Chrome
        </span>
      </div>
    </div>
  );
}

/** 複製網址到剪貼簿的 fallback */
function copyUrlFallback(
  url: string,
  toast: ReturnType<typeof useToast>["toast"],
) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url);
    toast({
      title: "已複製網址",
      description: "請在 Safari 或 Chrome 中貼上此網址",
    });
  }
}
