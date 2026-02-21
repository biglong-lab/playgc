// 建立兌換碼對話框
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import type { GameChapter } from "@shared/schema";

interface CreateCodeDialogProps {
  chapters: GameChapter[];
  onCreateSingle: (data: {
    scope: "game" | "chapter";
    chapterId?: string;
    maxUses: number;
    label?: string;
  }) => void;
  onCreateBatch: (data: {
    scope: "game" | "chapter";
    chapterId?: string;
    maxUses: number;
    count: number;
    label?: string;
  }) => void;
  isCreating: boolean;
}

export function CreateCodeDialog({
  chapters,
  onCreateSingle,
  onCreateBatch,
  isCreating,
}: CreateCodeDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [scope, setScope] = useState<"game" | "chapter">("game");
  const [chapterId, setChapterId] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [count, setCount] = useState("10");
  const [label, setLabel] = useState("");

  const handleSubmit = () => {
    const base = {
      scope,
      chapterId: scope === "chapter" ? chapterId : undefined,
      maxUses: parseInt(maxUses) || 1,
      label: label || undefined,
    };

    if (mode === "single") {
      onCreateSingle(base);
    } else {
      onCreateBatch({ ...base, count: parseInt(count) || 10 });
    }
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setScope("game");
    setChapterId("");
    setMaxUses("1");
    setCount("10");
    setLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          建立兌換碼
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>建立兌換碼</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === "single" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("single")}
            >
              單一建立
            </Button>
            <Button
              variant={mode === "batch" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("batch")}
            >
              批次建立
            </Button>
          </div>

          <div className="space-y-2">
            <Label>解鎖範圍</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "game" | "chapter")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="game">整個遊戲</SelectItem>
                <SelectItem value="chapter">指定章節</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "chapter" && (
            <div className="space-y-2">
              <Label>選擇章節</Label>
              <Select value={chapterId} onValueChange={setChapterId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇章節" />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      第 {ch.chapterOrder} 章：{ch.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>每碼可使用次數</Label>
            <Input
              type="number"
              min="1"
              max="10000"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </div>

          {mode === "batch" && (
            <div className="space-y-2">
              <Label>建立數量（最多 100）</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>標籤（選填）</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例如：首批活動碼"
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || (scope === "chapter" && !chapterId)}
          >
            {isCreating ? "建立中..." : mode === "single" ? "建立" : `建立 ${count} 個`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
