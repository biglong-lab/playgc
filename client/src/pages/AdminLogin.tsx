// 總管理員登入頁面
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, LogIn, ArrowRight, KeyRound } from "lucide-react";
import { useAdminLogin } from "@/hooks/useAdminLogin";
import {
  FieldCodeBadge,
  LoginErrorAlert,
  CurrentUserBadge,
  PasswordForm,
  PendingAuthView,
} from "@/components/admin-login";

export default function AdminLogin() {
  const {
    fieldCode,
    setFieldCode,
    step,
    loginError,
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    isGoogleLoading,
    firebaseUser,
    isAuthenticated,
    isFirebaseLoginPending,
    isPasswordLoginPending,
    handleFieldSubmit,
    handleGoogleLogin,
    handleSignOut,
    handlePasswordSubmit,
    switchToPasswordLogin,
    backToFieldInput,
    backToLoginChoice,
    recheckAuthorization,
  } = useAdminLogin({ successRedirect: "/admin-staff/dashboard" });

  const getStepDescription = () => {
    switch (step) {
      case "field": return "請輸入您的場域編號";
      case "firebase": return "請使用您的帳號登入";
      case "password": return "請輸入帳號密碼";
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
                  onSwitchToPassword={switchToPasswordLogin}
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

          {/* 步驟 2: 選擇登入方式 */}
          {step === "firebase" && (
            <div className="space-y-4">
              <FieldCodeBadge fieldCode={fieldCode} />

              {loginError && isAuthenticated && (
                <LoginErrorAlert
                  error={loginError}
                  email={firebaseUser?.email}
                  onSignOut={handleSignOut}
                  onSwitchToPassword={switchToPasswordLogin}
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
                    onClick={switchToPasswordLogin}
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
                onClick={backToFieldInput}
              >
                返回修改場域編號
              </Button>
            </div>
          )}

          {/* 步驟 3: 密碼登入 */}
          {step === "password" && (
            <div className="space-y-4">
              <FieldCodeBadge fieldCode={fieldCode} />
              <PasswordForm
                username={username}
                setUsername={setUsername}
                password={password}
                setPassword={setPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                isPending={isPasswordLoginPending}
                onSubmit={handlePasswordSubmit}
                onBack={backToLoginChoice}
              />
            </div>
          )}

          {/* 步驟 4: 等待授權 */}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
