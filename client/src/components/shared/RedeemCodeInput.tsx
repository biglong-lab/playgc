// 兌換碼輸入元件 — 自動格式化、驗證 UI
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";

interface RedeemCodeInputProps {
  onSubmit: (code: string) => void;
  isLoading: boolean;
  error?: string;
}

/** 自動格式化兌換碼（JCQ-XXXX-XXXX） */
function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // 前綴 JCQ 已含
  if (clean.length <= 3) return clean;
  if (clean.length <= 7) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
}

export function RedeemCodeInput({ onSubmit, isLoading, error }: RedeemCodeInputProps) {
  const [code, setCode] = useState("");

  const handleChange = (value: string) => {
    setCode(formatCode(value));
  };

  const handleSubmit = () => {
    if (code.length >= 12) {
      onSubmit(code);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="JCQ-XXXX-XXXX"
          className="font-mono text-center tracking-wider"
          maxLength={14}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <Button
          onClick={handleSubmit}
          disabled={isLoading || code.length < 12}
          className="gap-2 shrink-0"
        >
          <Ticket className="w-4 h-4" />
          {isLoading ? "兌換中..." : "兌換"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
