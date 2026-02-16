// 章節管理元件 - 章節列表、新增、刪除、排序
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GameChapter } from "@shared/schema";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Settings,
} from "lucide-react";
import ChapterConfigEditor from "./ChapterConfigEditor";

interface ChapterManagerProps {
  gameId: string;
}

export default function ChapterManager({ gameId }: ChapterManagerProps) {
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [editingChapterId, setEditingChapterId] = useState<string | null>(
    null
  );

  const { data: chapters = [], isLoading } = useQuery<GameChapter[]>({
    queryKey: ["/api/admin/games", gameId, "chapters"],
  });

  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/games/${gameId}/chapters`,
        { title }
      );
      return res.json();
    },
    onSuccess: () => {
      setNewTitle("");
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/games", gameId, "chapters"],
      });
      toast({ title: "章節已建立" });
    },
    onError: () => {
      toast({ title: "建立失敗", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/chapters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/games", gameId, "chapters"],
      });
      toast({ title: "章節已刪除" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (chapterIds: string[]) => {
      await apiRequest("PATCH", "/api/admin/chapters/reorder", {
        gameId,
        chapterIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/games", gameId, "chapters"],
      });
    },
  });

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    createMutation.mutate(title);
  };

  const moveChapter = (index: number, direction: "up" | "down") => {
    const ids = chapters.map((c) => c.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= ids.length) return;
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
    reorderMutation.mutate(ids);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        載入章節中...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          章節管理
        </h3>
        <Badge variant="secondary">{chapters.length} 個章節</Badge>
      </div>

      {/* 章節列表 */}
      <div className="space-y-3">
        {chapters.map((chapter, index) => (
          <Card key={chapter.id} className="relative">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                <div className="flex-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      第 {index + 1} 章
                    </Badge>
                    {chapter.title}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveChapter(index, "up")}
                    disabled={index === 0}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveChapter(index, "down")}
                    disabled={index === chapters.length - 1}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      setEditingChapterId(
                        editingChapterId === chapter.id
                          ? null
                          : chapter.id
                      )
                    }
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => {
                      if (
                        confirm(`確定要刪除「${chapter.title}」？`)
                      ) {
                        deleteMutation.mutate(chapter.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* 章節設定展開面板 */}
            {editingChapterId === chapter.id && (
              <CardContent className="p-4 pt-0 border-t mt-2">
                <ChapterConfigEditor
                  chapter={chapter}
                  onClose={() => setEditingChapterId(null)}
                />
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* 新增章節 */}
      <div className="flex gap-2">
        <Input
          placeholder="輸入章節名稱..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button
          onClick={handleAdd}
          disabled={!newTitle.trim() || createMutation.isPending}
          className="gap-1 shrink-0"
        >
          <Plus className="w-4 h-4" />
          新增章節
        </Button>
      </div>
    </div>
  );
}
