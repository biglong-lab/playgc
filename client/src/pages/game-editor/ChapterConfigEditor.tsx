// 章節設定編輯器 - 標題、描述、解鎖條件、預估時間
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GameChapter } from "@shared/schema";
import { Save, X } from "lucide-react";

interface ChapterConfigEditorProps {
  chapter: GameChapter;
  onClose: () => void;
}

export default function ChapterConfigEditor({
  chapter,
  onClose,
}: ChapterConfigEditorProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(chapter.title);
  const [description, setDescription] = useState(chapter.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(
    chapter.coverImageUrl ?? ""
  );
  const [unlockType, setUnlockType] = useState(
    chapter.unlockType ?? "complete_previous"
  );
  const [estimatedTime, setEstimatedTime] = useState(
    String(chapter.estimatedTime ?? "")
  );
  const [status, setStatus] = useState(chapter.status ?? "draft");

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<GameChapter>) => {
      await apiRequest("PATCH", `/api/admin/chapters/${chapter.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/games", chapter.gameId, "chapters"],
      });
      toast({ title: "章節已更新" });
      onClose();
    },
    onError: () => {
      toast({ title: "更新失敗", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      title,
      description: description || null,
      coverImageUrl: coverImageUrl || null,
      unlockType,
      estimatedTime: estimatedTime ? parseInt(estimatedTime) : null,
      status,
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>章節標題</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="章節名稱"
          />
        </div>
        <div>
          <Label>預估時間（分鐘）</Label>
          <Input
            type="number"
            value={estimatedTime}
            onChange={(e) => setEstimatedTime(e.target.value)}
            placeholder="30"
          />
        </div>
      </div>

      <div>
        <Label>章節描述</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="描述此章節的內容..."
          rows={3}
        />
      </div>

      <div>
        <Label>封面圖片 URL</Label>
        <Input
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>解鎖條件</Label>
          <Select value={unlockType} onValueChange={setUnlockType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">免費解鎖</SelectItem>
              <SelectItem value="complete_previous">
                完成前一章
              </SelectItem>
              <SelectItem value="score_threshold">達到指定分數</SelectItem>
              <SelectItem value="paid">付費解鎖</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>章節狀態</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="published">已發佈</SelectItem>
              <SelectItem value="hidden">隱藏</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending || !title.trim()}
          size="sm"
          className="gap-1"
        >
          <Save className="w-4 h-4" />
          儲存
        </Button>
        <Button onClick={onClose} variant="outline" size="sm" className="gap-1">
          <X className="w-4 h-4" />
          取消
        </Button>
      </div>
    </div>
  );
}
