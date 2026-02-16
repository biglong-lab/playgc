import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  signInWithGoogle,
  signInWithApple,
  signInAnonymously,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
} from "@/lib/firebase";

/** 登入方法類型 */
export type LoginMethod = "google" | "apple" | "guest" | "email" | null;

/** 登入處理 Hook 的回傳介面 */
export interface LoginHandlers {
  isLoggingIn: boolean;
  loginMethod: LoginMethod;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  handleGoogleLogin: () => Promise<void>;
  handleAppleLogin: () => Promise<void>;
  handleGuestLogin: () => Promise<void>;
  handleEmailLogin: (e: React.FormEvent) => Promise<void>;
  handleEmailSignup: (e: React.FormEvent) => Promise<void>;
  handleForgotPassword: () => Promise<void>;
}

/**
 * 封裝所有登入方式的處理邏輯
 * @param onSuccess - 登入成功後的回呼（通常是關閉 Dialog + 導航）
 */
export function useLoginHandlers(onSuccess?: () => void): LoginHandlers {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLoginSuccess = () => {
    setIsLoggingIn(false);
    setLoginMethod(null);
    onSuccess?.();
    setLocation("/home");
  };

  const handleLoginError = (error: unknown) => {
    const errorMessage =
      error instanceof Error ? error.message : "登入失敗，請重試";
    setIsLoggingIn(false);
    setLoginMethod(null);
    toast({
      variant: "destructive",
      title: "登入失敗",
      description: errorMessage,
    });
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod("google");
    try {
      const user = await signInWithGoogle();
      if (user) handleLoginSuccess();
    } catch (error: unknown) {
      handleLoginError(error);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod("apple");
    try {
      const user = await signInWithApple();
      if (user) handleLoginSuccess();
    } catch (error: unknown) {
      handleLoginError(error);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoggingIn(true);
    setLoginMethod("guest");
    try {
      const user = await signInAnonymously();
      if (user) {
        toast({
          title: "歡迎訪客！",
          description: "您可以稍後在設定中綁定正式帳號",
        });
        handleLoginSuccess();
      }
    } catch (error: unknown) {
      handleLoginError(error);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "請填寫完整",
        description: "請輸入電子郵件和密碼",
      });
      return;
    }
    setIsLoggingIn(true);
    setLoginMethod("email");
    try {
      const user = await signInWithEmail(email, password);
      if (user) handleLoginSuccess();
    } catch (error: unknown) {
      handleLoginError(error);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "請填寫完整",
        description: "請輸入電子郵件和密碼",
      });
      return;
    }
    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "密碼太短",
        description: "密碼至少需要 6 個字元",
      });
      return;
    }
    setIsLoggingIn(true);
    setLoginMethod("email");
    try {
      const user = await signUpWithEmail(email, password);
      if (user) {
        toast({
          title: "註冊成功！",
          description: "歡迎加入賈村競技體驗場",
        });
        handleLoginSuccess();
      }
    } catch (error: unknown) {
      handleLoginError(error);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "請輸入電子郵件",
        description: "請在上方輸入您的電子郵件",
      });
      return;
    }
    setIsLoggingIn(true);
    try {
      await resetPassword(email);
      toast({
        title: "已發送重設郵件",
        description: "請檢查您的電子郵件收件箱",
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "請重試";
      toast({
        variant: "destructive",
        title: "發送失敗",
        description: msg,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return {
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
  };
}
