import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, LogIn, ArrowRight, Eye, EyeOff, KeyRound, LogOut, MapPin } from "lucide-react";
import { signInWithGoogle, signOut as firebaseSignOut, getIdToken } from "@/lib/firebase";
import { useAuthContext } from "@/contexts/AuthContext";

interface AdminLoginResponse {
  success: boolean;
  admin: {
    id: string;
    accountId: string;
    fieldId: string;
    fieldCode: string;
    fieldName: string;
    username?: string;
    displayName: string | null;
    roleId: string | null;
    systemRole: string;
    permissions: string[];
  };
}

export default function FieldAdminLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { firebaseUser, isAuthenticated } = useAuthContext();
  
  const [fieldCode, setFieldCode] = useState("");
  const [step, setStep] = useState<"field" | "firebase" | "password" | "pending">("field");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const firebaseLoginMutation = useMutation({
    mutationFn: async () => {
      const token = await getIdToken();
      const response = await fetch("/api/admin/firebase-login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ fieldCode }),
        credentials: "include",
      });
      
      const data = await response.json();
      
      if (response.status === 202) {
        return { status: "pending", message: data.message } as const;
      }
      
      if (!response.ok) {
        throw new Error(data.message || "登入失敗");
      }
      
      return { status: "success", ...data } as AdminLoginResponse & { status: "success" };
    },
    onSuccess: (data) => {
      if (data.status === "pending") {
        setStep("pending");
        toast({
          title: "申請已提交",
          description: data.message,
        });
        return;
      }
      
      toast({
        title: "登入成功",
        description: `歡迎回來，${data.admin.displayName || firebaseUser?.displayName || "管理員"}`,
      });
      navigate("/admin");
    },
    onError: (error: Error) => {
      const errorMsg = error.message || "登入失敗";
      setLoginError(errorMsg);
      toast({
        title: "登入失敗",
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  const passwordLoginMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldCode, username, password }),
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "登入失敗");
      }
      
      return response.json() as Promise<AdminLoginResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "登入成功",
        description: `歡迎回來，${data.admin.displayName || data.admin.username}`,
      });
      navigate("/admin");
    },
    onError: (error: Error) => {
      toast({
        title: "登入失敗",
        description: error.message || "帳號或密碼錯誤",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (isAuthenticated && step === "firebase" && fieldCode && !loginError && firebaseLoginMutation.status === "idle") {
      firebaseLoginMutation.mutate();
    }
  }, [isAuthenticated, step, fieldCode, loginError, firebaseLoginMutation.status]);

  useEffect(() => {
    if (!isAuthenticated && loginError) {
      setLoginError(null);
      firebaseLoginMutation.reset();
    }
  }, [isAuthenticated]);

  const handleFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    firebaseLoginMutation.reset();
    
    if (!fieldCode.trim()) {
      toast({ title: "請輸入場域編號", variant: "destructive" });
      return;
    }
    
    if (isAuthenticated) {
      firebaseLoginMutation.mutate();
    } else {
      setStep("firebase");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      toast({
        title: "登入失敗",
        description: "Google 登入失敗，請重試",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    setLoginError(null);
    firebaseLoginMutation.reset();
    await firebaseSignOut();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast({ title: "請填寫帳號和密碼", variant: "destructive" });
      return;
    }
    
    passwordLoginMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">場域管理員登入</CardTitle>
          <CardDescription>
            {step === "field" && "請輸入您的場域編號"}
            {step === "firebase" && "請使用您的帳號登入"}
            {step === "password" && "請輸入帳號密碼"}
            {step === "pending" && "您的授權申請正在審核中"}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {step === "field" && (
            <div className="space-y-4">
              {loginError && isAuthenticated && (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-3">
                  <p className="text-sm text-destructive font-medium text-center">
                    {loginError}
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    目前登入帳號：{firebaseUser?.email}
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      data-testid="button-firebase-signout-field"
                      onClick={handleSignOut}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      登出並切換帳號
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setLoginError(null);
                        firebaseLoginMutation.reset();
                        setStep("password");
                      }}
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      改用帳號密碼登入
                    </Button>
                  </div>
                </div>
              )}
              
              {isAuthenticated && !loginError && (
                <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-muted-foreground">已登入：</span>
                    <span className="ml-1 font-medium">{firebaseUser?.email || firebaseUser?.displayName}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              <form onSubmit={handleFieldSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fieldCode">場域編號</Label>
                  <Input
                    id="fieldCode"
                    data-testid="input-field-code"
                    placeholder="例如: JIACHUN"
                    value={fieldCode}
                    onChange={(e) => setFieldCode(e.target.value.toUpperCase())}
                    disabled={firebaseLoginMutation.isPending}
                    autoComplete="organization"
                    autoFocus
                  />
                </div>
                
                <Button
                  type="submit"
                  data-testid="button-next"
                  className="w-full"
                  disabled={firebaseLoginMutation.isPending || !fieldCode.trim() || !!loginError}
                >
                  {firebaseLoginMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">...</span>
                      驗證中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      下一步
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            </div>
          )}

          {step === "firebase" && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">場域編號</p>
                <p className="font-mono font-bold text-lg">{fieldCode}</p>
              </div>
              
              {loginError && isAuthenticated && (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-3">
                  <p className="text-sm text-destructive font-medium text-center">
                    {loginError}
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    目前登入帳號：{firebaseUser?.email}
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      data-testid="button-firebase-signout"
                      onClick={handleSignOut}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      登出並切換帳號
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setLoginError(null);
                        firebaseLoginMutation.reset();
                        setStep("password");
                      }}
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      改用帳號密碼登入
                    </Button>
                  </div>
                </div>
              )}
              
              {!loginError && isAuthenticated && (
                <div className="text-center py-4">
                  <span className="animate-spin inline-block mr-2">...</span>
                  正在驗證管理員身份...
                </div>
              )}
              
              {!isAuthenticated && (
                <Button
                  data-testid="button-google-login"
                  className="w-full"
                  size="lg"
                  onClick={handleGoogleLogin}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  使用 Google 帳號登入
                </Button>
              )}
              
              {!loginError && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">或</span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setStep("password")}
                  >
                    <KeyRound className="w-4 h-4 mr-2" />
                    使用帳號密碼登入
                  </Button>
                </>
              )}
              
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setLoginError(null);
                  firebaseLoginMutation.reset();
                  setStep("field");
                }}
              >
                返回修改場域編號
              </Button>
            </div>
          )}

          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">場域編號</p>
                <p className="font-mono font-bold text-lg">{fieldCode}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">帳號</Label>
                <Input
                  id="username"
                  data-testid="input-username"
                  placeholder="請輸入帳號"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={passwordLoginMutation.isPending}
                  autoComplete="username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">密碼</Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="input-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="請輸入密碼"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={passwordLoginMutation.isPending}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Button
                type="submit"
                data-testid="button-login"
                className="w-full"
                disabled={passwordLoginMutation.isPending}
              >
                {passwordLoginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">...</span>
                    登入中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    登入
                  </span>
                )}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep("firebase")}
              >
                返回選擇登入方式
              </Button>
            </form>
          )}

          {step === "pending" && (
            <div className="space-y-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">場域編號</p>
                <p className="font-mono font-bold text-lg">{fieldCode}</p>
              </div>
              
              <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-3">
                <div className="mx-auto w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="font-semibold text-amber-600 dark:text-amber-400">等待授權中</h3>
                <p className="text-sm text-muted-foreground">
                  您的管理員權限申請已提交。<br />
                  請聯繫場域管理員進行審核授權。
                </p>
                {firebaseUser && (
                  <p className="text-xs text-muted-foreground mt-2">
                    申請帳號：{firebaseUser.email}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => firebaseLoginMutation.mutate()}
                  disabled={firebaseLoginMutation.isPending}
                >
                  {firebaseLoginMutation.isPending ? "檢查中..." : "重新檢查授權狀態"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={async () => {
                    await firebaseSignOut();
                    setStep("field");
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  登出並切換帳號
                </Button>
              </div>
            </div>
          )}
          
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              玩家請使用{" "}
              <a href="/" className="text-primary hover:underline">
                一般登入
              </a>
            </p>
            <p className="text-sm text-muted-foreground">
              系統管理員請使用{" "}
              <a href="/admin-staff/login" className="text-primary hover:underline">
                總管理後台
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
