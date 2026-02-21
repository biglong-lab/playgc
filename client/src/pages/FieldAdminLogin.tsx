// 場域管理員登入頁面 — 統一 Firebase 認證
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, LogIn, ArrowRight } from "lucide-react";
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
    handleFieldSubmit,
    handleGoogleLogin,
    handleSignOut,
    backToFieldInput,
    recheckAuthorization,
  } = useAdminLogin({ successRedirect: "/admin" });

  const getStepDescription = () => {
    switch (step) {
      case "field": return "請輸入您的場域編號";
      case "firebase": return "請使用 Google 帳號登入";
      case "pending": return "您的授權申請正在審核中";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">場域管理員登入</CardTitle>
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
                    placeholder="例如: JIACHUN"
                    value={fieldCode}
                    onChange={(e) => setFieldCode(e.target.value.toUpperCase())}
                    disabled={isFirebaseLoginPending}
                    autoComplete="organization"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  data-testid="button-next"
                  className="w-full"
                  disabled={isFirebaseLoginPending || !fieldCode.trim() || !!loginError}
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

          {/* 步驟 2: Google 登入 */}
          {step === "firebase" && (
            <div className="space-y-4">
              <FieldCodeBadge fieldCode={fieldCode} />

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
