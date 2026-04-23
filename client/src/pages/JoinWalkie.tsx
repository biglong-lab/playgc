// 🔗 語音群組短連結加入頁
//
// 路由：/j/:code
// 流程：
//   1. 未登入 → 顯示登入選項（Google / 匿名）+ 保存 code 到 sessionStorage
//   2. 登入後 → 自動 POST /api/walkie/groups/join
//   3. 成功後 → 顯示提示 + 引導進入遊戲（或 Home 讓他挑遊戲）
//
// 朋友收到 LINE 連結 → 點擊 → 一鍵加入群組 + 進遊戲
import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useFieldLink } from "@/hooks/useFieldLink";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLoginHandlers } from "@/hooks/useLoginHandlers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Radio, Check, AlertTriangle, Loader2, LogIn, Users,
  Gamepad2, UserCircle,
} from "lucide-react";

const PENDING_CODE_KEY = "pendingWalkieCode";

export default function JoinWalkie() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, isSignedIn } = useAuth();
  const [joined, setJoined] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{ displayName?: string | null } | null>(null);

  // redirectTo: null → 留在當前 /j/:code 頁，讓 useEffect 偵測 isSignedIn 變化後自動 join
  const loginHandlers = useLoginHandlers(
    () => {
      // 登入成功 callback
    },
    { redirectTo: null },
  );

  // 未登入時，保存 code 到 sessionStorage（登入流程若導向其他頁可 recover）
  useEffect(() => {
    if (code) sessionStorage.setItem(PENDING_CODE_KEY, code);
  }, [code]);

  const joinMutation = useMutation({
    mutationFn: async (accessCode: string) => {
      const res = await apiRequest("POST", "/api/walkie/groups/join", {
        accessCode,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "加入失敗");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setJoined(true);
      setGroupInfo({ displayName: data.displayName });
      sessionStorage.removeItem(PENDING_CODE_KEY);
      queryClient.invalidateQueries({ queryKey: ["/api/walkie/groups/my"] });
      toast({ title: "✅ 已加入語音群組" });
    },
    onError: (err: Error) => {
      toast({
        title: "加入失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // 登入後自動 join（只觸發一次）
  useEffect(() => {
    if (isSignedIn && user && code && !joined && !joinMutation.isPending) {
      joinMutation.mutate(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user, code]);

  // 載入中
  if (authLoading) {
    return (
      <CenteredScreen>
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">載入中...</p>
      </CenteredScreen>
    );
  }

  // 無 code
  if (!code) {
    return (
      <CenteredScreen>
        <AlertTriangle className="w-10 h-10 text-destructive" />
        <p className="text-destructive mt-4">連結格式錯誤</p>
        <Button onClick={() => setLocation("/")} className="mt-4">
          回首頁
        </Button>
      </CenteredScreen>
    );
  }

  // 未登入 → 顯示登入選項
  if (!isSignedIn) {
    return (
      <CenteredScreen>
        <div className="w-full max-w-sm px-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
              <Radio className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">朋友邀請你加入語音對講</h1>
            <p className="text-sm text-muted-foreground">
              群組代碼：
              <code className="font-mono text-primary font-bold ml-1">
                {code.toUpperCase()}
              </code>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              先登入，就會自動加入群組
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-2">
              <Button
                className="w-full gap-2"
                onClick={loginHandlers.handleGoogleLogin}
                disabled={loginHandlers.isLoggingIn}
              >
                <LogIn className="w-4 h-4" />
                用 Google 登入
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={loginHandlers.handleGuestLogin}
                disabled={loginHandlers.isLoggingIn}
              >
                <UserCircle className="w-4 h-4" />
                訪客身份加入
              </Button>
            </CardContent>
          </Card>

          {loginHandlers.isLoggingIn && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              登入中，請稍候...
            </p>
          )}
        </div>
      </CenteredScreen>
    );
  }

  // 加入中
  if (joinMutation.isPending) {
    return (
      <CenteredScreen>
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">正在加入語音群組...</p>
      </CenteredScreen>
    );
  }

  // 加入失敗
  if (joinMutation.isError) {
    return (
      <CenteredScreen>
        <div className="w-full max-w-sm px-6 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">無法加入</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {joinMutation.error.message}
          </p>
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => code && joinMutation.mutate(code)}
            >
              重試
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation("/home")}
            >
              回到遊戲大廳
            </Button>
          </div>
        </div>
      </CenteredScreen>
    );
  }

  // 加入成功
  if (joined) {
    return (
      <CenteredScreen>
        <div className="w-full max-w-sm px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            已加入{groupInfo?.displayName || "語音群組"}
          </h2>
          <p className="text-sm text-muted-foreground mb-2">
            進入任何遊戲後，點右下 📻 就能跟朋友講話
          </p>
          <p className="text-xs text-muted-foreground mb-6 flex items-center justify-center gap-1">
            <Users className="w-3 h-3" />
            群組代碼：
            <code className="font-mono text-primary">{code?.toUpperCase()}</code>
          </p>
          <Button
            className="w-full gap-2"
            onClick={() => setLocation("/home")}
          >
            <Gamepad2 className="w-4 h-4" />
            前往遊戲大廳
          </Button>
        </div>
      </CenteredScreen>
    );
  }

  return null;
}

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center flex-col">
      {children}
    </div>
  );
}
