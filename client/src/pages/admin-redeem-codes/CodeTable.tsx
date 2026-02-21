// 兌換碼列表元件
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RedeemCode } from "@shared/schema";

interface CodeTableProps {
  codes: RedeemCode[];
  onDisable: (id: string) => void;
  onDelete: (id: string) => void;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "啟用中", variant: "default" },
  used: { label: "已用完", variant: "secondary" },
  expired: { label: "已過期", variant: "outline" },
  disabled: { label: "已停用", variant: "destructive" },
};

export function CodeTable({ codes, onDisable, onDelete }: CodeTableProps) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast({ title: "已複製兌換碼" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (codes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        尚未建立兌換碼
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {codes.map((code) => {
        const status = statusLabels[code.status ?? "active"];
        return (
          <div
            key={code.id}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => copyCode(code.code, code.id)}
                className="font-mono text-sm font-medium hover:text-primary transition-colors"
              >
                {code.code}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => copyCode(code.code, code.id)}
              >
                <Copy className={`w-3 h-3 ${copiedId === code.id ? "text-green-500" : ""}`} />
              </Button>
              <Badge variant={status.variant}>{status.label}</Badge>
              <span className="text-xs text-muted-foreground">
                {code.scope === "chapter" ? "章節" : "遊戲"} |
                {` ${code.usedCount ?? 0}/${code.maxUses ?? 1}`}
              </span>
              {code.label && (
                <span className="text-xs text-muted-foreground truncate max-w-32">
                  {code.label}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {code.status === "active" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDisable(code.id)}
                  title="停用"
                >
                  <Ban className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => onDelete(code.id)}
                title="刪除"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
