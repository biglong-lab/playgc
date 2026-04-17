// 🔑 平台擁有者緊急登入頁 /owner-login
// 用途：當 Google OAuth 網域未配置時，平台擁有者可用此頁登入
// 使用：在網址帶 ?secret=xxx（或輸入框貼入）
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Key, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OwnerLogin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [secret, setSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // 從 URL 自動讀取 ?secret=xxx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSecret = params.get("secret");
    if (urlSecret) {
      setSecret(urlSecret);
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!secret.trim()) {
      toast({ title: "請輸入密鑰", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/platform-owner-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Platform-Secret": secret.trim(),
        },
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "登入失敗",
          description: data.message ?? "請檢查密鑰",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ 登入成功",
        description: `歡迎回來，${data.admin?.displayName ?? "平台擁有者"}`,
      });
      setSuccess(true);

      // 2 秒後跳轉
      setTimeout(() => {
        // 清除 URL 參數防止外洩
        window.history.replaceState({}, "", "/admin");
        setLocation("/admin");
      }, 1500);
    } catch (err) {
      toast({
        title: "網路錯誤",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md border-amber-500/30">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
            <Key className="w-8 h-8 text-amber-500" />
          </div>
          <CardTitle className="text-xl">🔑 平台擁有者登入</CardTitle>
          <CardDescription>
            緊急登入通道（Google OAuth 未配置時使用）
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="font-medium">登入成功！</p>
              <p className="text-sm text-muted-foreground mt-1">
                正在跳轉到管理後台...
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="secret">平台擁有者密鑰</Label>
                <Input
                  id="secret"
                  type="password"
                  placeholder="輸入 PLATFORM_OWNER_SECRET"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                  className="mt-1.5 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  密鑰對應環境變數 <code className="bg-muted px-1 rounded">PLATFORM_OWNER_SECRET</code>
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !secret}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                {isLoading ? "驗證中..." : "登入管理後台"}
              </Button>

              <div className="pt-3 border-t space-y-1 text-xs text-muted-foreground">
                <p>⚠️ 此頁僅限平台擁有者緊急使用</p>
                <p>一般管理員請到 <a href="/admin/login" className="text-primary hover:underline">/admin/login</a></p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
