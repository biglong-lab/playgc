// 場域管理員登入頁面 — 統一 Firebase 認證
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, LogIn, ArrowRight, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminLogin } from "@/hooks/useAdminLogin";
import {
  FieldCodeBadge,
  LoginErrorAlert,
  CurrentUserBadge,
  PendingAuthView,
} from "@/components/admin-login";

export default function FieldAdminLogin() {
  const {
    fieldCode,
    setFieldCode,
    step,
    loginError,
    isGoogleLoading,
    firebaseUser,
    isAuthenticated,
    isFirebaseLoginPending,
    email,
    setEmail,
    password,
    setPassword,
    isEmailLoading,
    handleFieldSubmit,
    handleGoogleLogin,
    handleEmailLogin,
    handleEmailSignup,
    handleDevLogin,
    handleSignOut,
    backToFieldInput,
    recheckAuthorization,
  } = useAdminLogin({ successRedirect: "/admin" });

  const getStepDescription = () => {
    switch (step) {
      case "field": return "請輸入場域編號（超級管理員可留空）";
      case "firebase": return "請使用 Google 帳號登入";
      case "pending": return "您的授權申請正在審核中";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">管理員登入</CardTitle>
          <CardDescription>{getStepDescription()}</CardDescription>
        </CardHeader>

        <CardContent>
          {/* 步驟 1: 輸入場域編號 */}
          {step === "field" && (
            <div className="space-y-4">
              {loginError && isAuthenticated && (
                <LoginErrorAlert
                  error={loginError}
                  email={firebaseUser?.email}
                  onSignOut={handleSignOut}
                />
              )}

              {isAuthenticated && !loginError && (
                <CurrentUserBadge
                  email={firebaseUser?.email}
                  displayName={firebaseUser?.displayName}
                  onSignOut={handleSignOut}
                />
              )}

              <form onSubmit={handleFieldSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fieldCode">場域編號</Label>
                  <Input
                    id="fieldCode"
                    data-testid="input-field-code"
                    placeholder="例如: JIACHUN（超級管理員可留空）"
                    value={fieldCode}
                    onChange={(e) => setFieldCode(e.target.value.toUpperCase())}
                    disabled={isFirebaseLoginPending}
                    autoComplete="organization"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    超級管理員可不填場域編號直接登入
                  </p>
                </div>

                <Button
                  type="submit"
                  data-testid="button-next"
                  className="w-full"
                  disabled={isFirebaseLoginPending || !!loginError}
                >
                  {isFirebaseLoginPending ? (
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

          {/* 步驟 2: Firebase 登入 */}
          {step === "firebase" && (
            <div className="space-y-4">
              {fieldCode && <FieldCodeBadge fieldCode={fieldCode} />}

              {loginError && isAuthenticated && (
                <LoginErrorAlert
                  error={loginError}
                  email={firebaseUser?.email}
                  onSignOut={handleSignOut}
                />
              )}

              {!loginError && isAuthenticated && (
                <div className="text-center py-4">
                  <span className="animate-spin inline-block mr-2">...</span>
                  正在驗證管理員身份...
                </div>
              )}

              {!isAuthenticated && (
                <Tabs defaultValue="email" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="email">Email 登入</TabsTrigger>
                    <TabsTrigger value="google">Google 登入</TabsTrigger>
                  </TabsList>

                  <TabsContent value="email" className="space-y-3 mt-3">
                    <form onSubmit={handleEmailLogin} className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="admin-email">電子郵件</Label>
                        <Input
                          id="admin-email"
                          type="email"
                          placeholder="admin@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isEmailLoading}
                          autoComplete="email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-password">密碼</Label>
                        <Input
                          id="admin-password"
                          type="password"
                          placeholder="輸入密碼"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isEmailLoading}
                          autoComplete="current-password"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={isEmailLoading || !email || !password}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          {isEmailLoading ? "登入中..." : "登入"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          disabled={isEmailLoading || !email || !password}
                          onClick={handleEmailSignup}
                        >
                          {isEmailLoading ? "處理中..." : "註冊"}
                        </Button>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="google" className="mt-3">
                    <Button
                      data-testid="button-google-login"
                      className="w-full"
                      size="lg"
                      onClick={handleGoogleLogin}
                      disabled={isGoogleLoading}
                    >
                      {isGoogleLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">...</span>
                          連接 Google 中...
                        </span>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4 mr-2" />
                          使用 Google 帳號登入
                        </>
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>
              )}

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={backToFieldInput}
              >
                返回修改場域編號
              </Button>
            </div>
          )}

          {/* 步驟 3: 等待授權 */}
          {step === "pending" && (
            <PendingAuthView
              fieldCode={fieldCode}
              email={firebaseUser?.email}
              isPending={isFirebaseLoginPending}
              onRecheck={recheckAuthorization}
              onBackToField={backToFieldInput}
            />
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              玩家請使用{" "}
              <a href="/" className="text-primary hover:underline">
                一般登入
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
