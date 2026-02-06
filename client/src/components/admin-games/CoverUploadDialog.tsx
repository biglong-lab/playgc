// 封面圖片上傳對話框
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CoverUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: {
    id: string;
    title: string;
    coverImageUrl: string | null;
  } | null;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

export default function CoverUploadDialog({
  open,
  onOpenChange,
  game,
  onUpload,
  isUploading,
}: CoverUploadDialogProps) {
  const { toast } = useToast();

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "請選擇圖片檔案", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "圖片大小不得超過 5MB", variant: "destructive" });
        return;
      }
      onUpload(file);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            上傳封面圖片
          </DialogTitle>
          <DialogDescription>
            為「{game?.title}」選擇封面圖片
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {game?.coverImageUrl && (
            <div className="flex justify-center">
              <img
                src={game.coverImageUrl}
                alt="Current cover"
                className="w-32 h-32 object-cover rounded-lg border"
              />
            </div>
          )}
          <div className="flex flex-col items-center gap-4">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
                data-testid="input-cover-file"
              />
              <Button
                variant="outline"
                disabled={isUploading}
                asChild
              >
                <span>
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4 mr-2" />
                  )}
                  選擇圖片
                </span>
              </Button>
            </label>
            <p className="text-sm text-muted-foreground">
              支援 JPG、PNG，最大 5MB
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
