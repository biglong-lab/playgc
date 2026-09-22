// 🎚️ 新增元件開關（2026-09-23 P0-B）
//   - 預設範圍：本場域
//   - 只有 super_admin 看得到「全平台」選項
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { FlagScope } from "./flag-scope";

interface AddFlagCardProps {
  isSuperAdmin: boolean;
  fieldName: string | undefined;
  disabled: boolean;
  onRequestAdd: (moduleKey: string, scope: FlagScope) => void;
}

export function AddFlagCard({ isSuperAdmin, fieldName, disabled, onRequestAdd }: AddFlagCardProps) {
  const [moduleKey, setModuleKey] = useState("");
  const [scope, setScope] = useState<FlagScope>("field");
  const trimmed = moduleKey.trim();

  const submit = () => {
    if (!trimmed) return;
    onRequestAdd(trimmed, isSuperAdmin ? scope : "field");
    setModuleKey("");
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex flex-col md:flex-row gap-2">
          <Input
            placeholder="輸入 componentType（如 trivia_showdown）手動新增 disabled flag"
            value={moduleKey}
            onChange={(e) => setModuleKey(e.target.value)}
            data-testid="input-new-module"
          />
          <Button disabled={!trimmed || disabled} onClick={submit} data-testid="btn-add-flag">
            <Plus className="w-4 h-4 mr-1" />
            新增（預設關閉）
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs" data-testid="add-flag-scope">
          <span className="text-muted-foreground">範圍：</span>
          {isSuperAdmin ? (
            <>
              <Button size="sm" variant={scope === "field" ? "default" : "outline"} onClick={() => setScope("field")} data-testid="btn-scope-field">
                本場域（{fieldName || "目前場域"}）
              </Button>
              <Button size="sm" variant={scope === "global" ? "destructive" : "outline"} onClick={() => setScope("global")} data-testid="btn-scope-global">
                全平台（所有場域）
              </Button>
            </>
          ) : (
            <span>本場域（{fieldName || "目前場域"}）</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
