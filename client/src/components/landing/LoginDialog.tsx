import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, User, Apple, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import type { LoginHandlers } from "@/hooks/useLoginHandlers";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 是否在嵌入式瀏覽器中（影響社群登入按鈕啟用狀態） */
  isEmbeddedBrowser: boolean;
  handlers: LoginHandlers;
}

/** 登入對話框：訪客、Google、Apple、Email 登入/註冊 */
export function LoginDialog({
  open,
  onOpenChange,
  isEmbeddedBrowser,
  handlers,
}: LoginDialogProps) {
  const {
    isLoggingIn,
    loginMethod,
    email,
    setEmail,
    password,
    setPassword,
    handleGoogleLogin,
    handleAppleLogin,
    handleGuestLogin,
    handleEmailLogin,
    handleEmailSignup,
    handleForgotPassword,
  } = handlers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-2xl">
            登入遊戲
          </DialogTitle>
          <DialogDescription className="text-center">
            選擇您喜歡的登入方式
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* 訪客快速登入 */}
          <Button
            variant="outline"
            className="w-full h-12 gap-3 text-base"
            onClick={handleGuestLogin}
            disabled={isLoggingIn}
            data-testid="button-guest-login"
          >
            {isLoggingIn && loginMethod === "guest" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <User className="w-5 h-5" />
            )}
            訪客快速體驗
          </Button>

          <Divider text="或使用帳號登入" />

          {/* 社群登入 */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-12 gap-2"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn || isEmbeddedBrowser}
              data-testid="button-google-login"
            >
              {isLoggingIn && loginMethod === "google" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <SiGoogle className="w-5 h-5" />
              )}
              Google
            </Button>

            <Button
              variant="outline"
              className="h-12 gap-2"
              onClick={handleAppleLogin}
              disabled={isLoggingIn || isEmbeddedBrowser}
              data-testid="button-apple-login"
            >
              {isLoggingIn && loginMethod === "apple" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Apple className="w-5 h-5" />
              )}
              Apple
            </Button>
          </div>

          {isEmbeddedBrowser && (
            <p className="text-xs text-destructive text-center">
              您正在使用 App 內建瀏覽器，社群登入可能無法使用。請使用訪客登入或電子郵件登入。
            </p>
          )}

          <Divider text="電子郵件登入" />

          {/* Email 登入/註冊分頁 */}
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" data-testid="tab-email-login">
                登入
              </TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-email-signup">
                註冊
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-3 mt-3">
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <EmailFields
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  isLoggingIn={isLoggingIn}
                  idPrefix="login"
                  passwordPlaceholder="輸入密碼"
                />
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isLoggingIn}
                  data-testid="button-email-login-submit"
                >
                  {isLoggingIn && loginMethod === "email" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  登入
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm"
                  onClick={handleForgotPassword}
                  disabled={isLoggingIn}
                  data-testid="button-forgot-password"
                >
                  忘記密碼？
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3 mt-3">
              <form onSubmit={handleEmailSignup} className="space-y-3">
                <EmailFields
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  isLoggingIn={isLoggingIn}
                  idPrefix="signup"
                  passwordPlaceholder="至少 6 個字元"
                />
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isLoggingIn}
                  data-testid="button-email-signup-submit"
                >
                  {isLoggingIn && loginMethod === "email" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  建立帳號
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 分隔線 */
function Divider({ text }: { text: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}

/** Email 輸入欄位組 */
function EmailFields({
  email,
  setEmail,
  password,
  setPassword,
  isLoggingIn,
  idPrefix,
  passwordPlaceholder,
}: {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  isLoggingIn: boolean;
  idPrefix: string;
  passwordPlaceholder: string;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`email-${idPrefix}`}>電子郵件</Label>
        <Input
          id={`email-${idPrefix}`}
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoggingIn}
          data-testid={`input-email-${idPrefix}`}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`password-${idPrefix}`}>密碼</Label>
        <Input
          id={`password-${idPrefix}`}
          type="password"
          placeholder={passwordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoggingIn}
          data-testid={`input-password-${idPrefix}`}
        />
      </div>
    </>
  );
}
