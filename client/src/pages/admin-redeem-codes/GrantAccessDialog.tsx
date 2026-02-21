// 現金收款授權對話框 - 搜尋玩家 → 選遊戲/章節 → 授權
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Banknote, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { User, GameChapter } from "@shared/schema";

interface GrantAccessDialogProps {
  chapters: GameChapter[];
  onGrantAccess: (data: {
    userId: string;
    chapterId?: string;
    amount?: number;
    note?: string;
  }) => void;
  isGranting: boolean;
}

export function GrantAccessDialog({
  chapters,
  onGrantAccess,
  isGranting,
}: GrantAccessDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserName, setSelectedUserName] = useState("");
  const [scope, setScope] = useState<"game" | "chapter">("game");
  const [chapterId, setChapterId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // 搜尋使用者
  const { data: searchResults } = useQuery<User[]>({
    queryKey: ["/api/admin/users/search", searchEmail],
    enabled: searchEmail.length >= 3,
  });

  const handleSelectUser = (user: User) => {
    setSelectedUserId(user.id);
    setSelectedUserName(user.firstName ?? user.email ?? user.id);
    setSearchEmail("");
  };

  const handleSubmit = () => {
    onGrantAccess({
      userId: selectedUserId,
      chapterId: scope === "chapter" ? chapterId : undefined,
      amount: amount ? parseInt(amount) : 0,
      note: note || undefined,
    });
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedUserId("");
    setSelectedUserName("");
    setSearchEmail("");
    setScope("game");
    setChapterId("");
    setAmount("");
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Banknote className="w-4 h-4" />
          現金收款
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>現金收款授權</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 搜尋玩家 */}
          <div className="space-y-2">
            <Label>搜尋玩家</Label>
            {selectedUserId ? (
              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">{selectedUserName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedUserId("");
                    setSelectedUserName("");
                  }}
                >
                  更換
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="輸入 Email 或名稱搜尋..."
                    className="pl-9"
                  />
                </div>
                {searchResults && searchResults.length > 0 && (
                  <div className="border rounded max-h-32 overflow-y-auto">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="w-full p-2 text-left text-sm hover:bg-muted"
                      >
                        {user.firstName ?? "未命名"} ({user.email})
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  也可以直接貼上玩家 ID
                </p>
                <Input
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setSelectedUserName(e.target.value);
                  }}
                  placeholder="或直接輸入玩家 ID"
                />
              </>
            )}
          </div>

          {/* 範圍 */}
          <div className="space-y-2">
            <Label>授權範圍</Label>
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

          {/* 金額 */}
          <div className="space-y-2">
            <Label>收款金額（新台幣）</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">NT$</span>
              <Input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="max-w-32"
              />
            </div>
          </div>

          {/* 備註 */}
          <div className="space-y-2">
            <Label>備註（選填）</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：現場活動收款"
              maxLength={500}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isGranting || !selectedUserId || (scope === "chapter" && !chapterId)}
          >
            {isGranting ? "授權中..." : "確認授權"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
