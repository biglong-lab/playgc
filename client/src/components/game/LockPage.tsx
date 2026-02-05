import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Lock, Unlock, RotateCcw, HelpCircle, Check, X } from "lucide-react";
import type { LockConfig } from "@shared/schema";

interface LockPageProps {
  config: LockConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: any) => void;
}

export default function LockPage({ config, onComplete }: LockPageProps) {
  const { toast } = useToast();
  const digits = config.digits || config.combination.length;
  const [code, setCode] = useState<string[]>(Array(digits).fill(""));
  const [attempts, setAttempts] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dialRotation, setDialRotation] = useState(0);

  const maxAttempts = config.maxAttempts || 5;
  const lockType = config.lockType || "number";

  const getCharacterSet = () => {
    if (lockType === "number") return "0123456789";
    if (lockType === "letter") return "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return "0123456789";
  };

  const characterSet = getCharacterSet();

  const handleInput = (char: string) => {
    if (isUnlocked || isFailed) return;

    const newCode = [...code];
    newCode[activeIndex] = char;
    setCode(newCode);

    if (activeIndex < digits - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  const handleDialRotate = (direction: "cw" | "ccw") => {
    if (isUnlocked || isFailed) return;

    const step = direction === "cw" ? 36 : -36;
    setDialRotation((prev) => prev + step);

    const currentValue = parseInt(code[activeIndex] || "0");
    const newValue = direction === "cw" 
      ? (currentValue + 1) % 10 
      : (currentValue - 1 + 10) % 10;
    
    const newCode = [...code];
    newCode[activeIndex] = newValue.toString();
    setCode(newCode);
  };

  const handleDelete = () => {
    if (activeIndex > 0) {
      const newCode = [...code];
      newCode[activeIndex - 1] = "";
      setCode(newCode);
      setActiveIndex(activeIndex - 1);
    } else {
      const newCode = [...code];
      newCode[0] = "";
      setCode(newCode);
    }
  };

  const handleClear = () => {
    setCode(Array(digits).fill(""));
    setActiveIndex(0);
    setDialRotation(0);
  };

  const handleSubmit = () => {
    const enteredCode = code.join("");
    
    if (enteredCode.length !== digits) {
      toast({
        title: "請輸入完整密碼",
        variant: "destructive",
      });
      return;
    }

    if (enteredCode.toUpperCase() === config.combination.toUpperCase()) {
      setIsUnlocked(true);
      toast({
        title: config.successMessage || "解鎖成功!",
        description: "密碼正確!",
      });
      setTimeout(() => {
        onComplete({ points: config.rewardPoints || 20 }, config.nextPageId);
      }, 2000);
    } else {
      setAttempts((prev) => prev + 1);
      
      if (attempts + 1 >= maxAttempts) {
        setIsFailed(true);
        toast({
          title: config.failureMessage || "解鎖失敗",
          description: "嘗試次數已用完",
          variant: "destructive",
        });
        setTimeout(() => {
          onComplete({ points: 0 }, config.nextPageId);
        }, 2000);
      } else {
        toast({
          title: "密碼錯誤",
          description: `還剩 ${maxAttempts - attempts - 1} 次機會`,
          variant: "destructive",
        });
        handleClear();
      }
    }
  };

  const renderNumberPad = () => (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", ""].map((num, i) => (
        <Button
          key={i}
          variant="outline"
          className="h-14 text-xl font-mono"
          onClick={() => num && handleInput(num)}
          disabled={!num || isUnlocked || isFailed}
          data-testid={`button-num-${num}`}
        >
          {num}
        </Button>
      ))}
    </div>
  );

  const renderLetterPad = () => (
    <div className="grid grid-cols-6 gap-1">
      {characterSet.split("").map((char) => (
        <Button
          key={char}
          variant="outline"
          size="sm"
          className="h-10 text-sm font-mono"
          onClick={() => handleInput(char)}
          disabled={isUnlocked || isFailed}
          data-testid={`button-letter-${char}`}
        >
          {char}
        </Button>
      ))}
    </div>
  );

  const renderDial = () => (
    <div className="flex flex-col items-center">
      <div 
        className="w-40 h-40 rounded-full border-4 border-primary relative mb-4 transition-transform duration-200"
        style={{ transform: `rotate(${dialRotation}deg)` }}
      >
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1 h-6 bg-primary rounded" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <div
            key={num}
            className="absolute text-sm font-mono"
            style={{
              top: "50%",
              left: "50%",
              transform: `rotate(${num * 36}deg) translateY(-60px) rotate(-${num * 36}deg) translate(-50%, -50%)`,
            }}
          >
            {num}
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleDialRotate("ccw")}
          disabled={isUnlocked || isFailed}
          data-testid="button-dial-ccw"
        >
          ← 逆時針
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            if (activeIndex < digits - 1) {
              setActiveIndex(activeIndex + 1);
            }
          }}
          disabled={isUnlocked || isFailed}
          data-testid="button-dial-next"
        >
          下一位
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleDialRotate("cw")}
          disabled={isUnlocked || isFailed}
          data-testid="button-dial-cw"
        >
          順時針 →
        </Button>
      </div>
    </div>
  );

  if (isUnlocked) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 bg-success/10">
        <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mb-4 animate-scaleIn">
          <Unlock className="w-12 h-12 text-success" />
        </div>
        <h2 className="text-3xl font-display font-bold text-success mb-2">解鎖成功!</h2>
        <p className="text-muted-foreground">{config.successMessage || "密碼正確!"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lock className="w-6 h-6 text-primary" />
              <span className="font-display font-bold">{config.title || "密碼鎖"}</span>
            </div>
            <Badge variant="outline" className="font-number">
              剩餘次數: {maxAttempts - attempts}
            </Badge>
          </div>

          {config.instruction && (
            <p className="text-sm text-muted-foreground text-center mb-4">{config.instruction}</p>
          )}

          <div className="flex justify-center gap-2 mb-6">
            {code.map((digit, index) => (
              <div
                key={index}
                className={`w-12 h-14 border-2 rounded-lg flex items-center justify-center text-2xl font-mono font-bold transition-all ${
                  index === activeIndex
                    ? "border-primary bg-primary/10"
                    : digit
                    ? "border-border bg-muted"
                    : "border-border"
                }`}
                onClick={() => setActiveIndex(index)}
                data-testid={`digit-slot-${index}`}
              >
                {digit || "•"}
              </div>
            ))}
          </div>

          {config.hint && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHint(!showHint)}
              className="w-full gap-1 mb-4"
              data-testid="button-show-hint"
            >
              <HelpCircle className="w-4 h-4" />
              {showHint ? "隱藏提示" : "顯示提示"}
            </Button>
          )}

          {showHint && config.hint && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4 text-center">
              <p className="text-sm text-primary">{config.hint}</p>
            </div>
          )}

          <div className="space-y-4">
            {lockType === "dial" ? renderDial() : lockType === "letter" ? renderLetterPad() : renderNumberPad()}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClear}
                className="flex-1 gap-2"
                disabled={isUnlocked || isFailed}
                data-testid="button-clear"
              >
                <RotateCcw className="w-4 h-4" />
                清除
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 gap-2"
                disabled={isUnlocked || isFailed}
                data-testid="button-submit-code"
              >
                <Check className="w-4 h-4" />
                解鎖
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
