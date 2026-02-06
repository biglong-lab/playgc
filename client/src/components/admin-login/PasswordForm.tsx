// 密碼登入表單元件
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Eye, EyeOff } from "lucide-react";

interface PasswordFormProps {
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export default function PasswordForm({
  username,
  setUsername,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  isPending,
  onSubmit,
  onBack,
}: PasswordFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">帳號</Label>
        <Input
          id="username"
          data-testid="input-username"
          placeholder="請輸入帳號"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isPending}
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
            disabled={isPending}
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
        disabled={isPending}
      >
        {isPending ? (
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
        onClick={onBack}
      >
        返回選擇登入方式
      </Button>
    </form>
  );
}
