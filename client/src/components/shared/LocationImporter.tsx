// 📍 從既有 Location 快速匯入座標 / QR code
//
// 用途：GpsMission / QrScan editor 加個按鈕，一鍵從管理員已建的 Location entity
// 帶入 lat/lng/radius（GPS）或 qrCodeData（QR）。省去手動複製。
//
// 跨遊戲章節模板（P2.8）匯入場景特別有用：
//   模板裡有 location slug，匯入時可快速用同場域的 Location 重設
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Link2, QrCode, Search } from "lucide-react";

interface LocationEntity {
  id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  radius?: number | null;
  locationType?: string | null;
  qrCodeData?: string | null;
}

interface LocationImporterProps {
  gameId?: string;
  /** 選中 location 時的 callback，callee 決定要用哪些欄位 */
  onSelect: (location: LocationEntity) => void;
  /** 按鈕 label 客製（預設「從地點引用」） */
  buttonLabel?: string;
  /** 過濾顯示：只有 QR 的 / 只有 GPS 的 / 全部 */
  mode?: "gps" | "qr" | "all";
  className?: string;
  disabled?: boolean;
}

export function LocationImporter({
  gameId,
  onSelect,
  buttonLabel = "從地點引用",
  mode = "all",
  className,
  disabled,
}: LocationImporterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: locations, isLoading } = useQuery<LocationEntity[]>({
    queryKey: ["/api/games", gameId, "locations"],
    enabled: !!gameId && open,
    staleTime: 30_000,
  });

  // 依模式過濾：gps 模式要有座標；qr 模式要有 qrCodeData
  const filtered = (locations || []).filter((loc) => {
    if (mode === "gps") {
      return (
        loc.latitude && loc.longitude && loc.latitude !== "0" && loc.longitude !== "0"
      );
    }
    if (mode === "qr") {
      return !!loc.qrCodeData?.trim();
    }
    return true;
  }).filter((loc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      loc.name.toLowerCase().includes(q) ||
      (loc.slug?.toLowerCase().includes(q) ?? false) ||
      (loc.description?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleSelect = (loc: LocationEntity) => {
    onSelect(loc);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !gameId}
          className={`gap-1.5 ${className ?? ""}`}
        >
          <Link2 className="w-3.5 h-3.5" />
          {buttonLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋地點名稱 / slug..."
              className="h-8 text-sm pl-7"
              autoFocus
            />
          </div>
          {mode !== "all" && (
            <p className="text-[10px] text-muted-foreground mt-1 px-1">
              {mode === "gps" ? "僅顯示有 GPS 座標的地點" : "僅顯示有 QR code 的地點"}
            </p>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {!gameId && (
            <p className="text-xs text-muted-foreground text-center py-6">
              請先儲存遊戲
            </p>
          )}

          {gameId && isLoading && (
            <p className="text-xs text-muted-foreground text-center py-6">
              載入中...
            </p>
          )}

          {gameId && !isLoading && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              {search
                ? "找不到符合的地點"
                : mode === "gps"
                  ? "本遊戲尚無有 GPS 座標的地點"
                  : mode === "qr"
                    ? "本遊戲尚無有 QR code 的地點"
                    : "本遊戲尚無地點"}
            </p>
          )}

          {filtered.map((loc) => {
            const hasCoords = !!(loc.latitude && loc.longitude);
            const hasQr = !!loc.qrCodeData?.trim();
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => handleSelect(loc)}
                className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {loc.name}
                      </span>
                      {loc.slug && (
                        <code className="text-[10px] text-muted-foreground">
                          ({loc.slug})
                        </code>
                      )}
                    </div>
                    {loc.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {loc.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      {hasCoords && (
                        <Badge variant="outline" className="text-[10px]">
                          <MapPin className="w-2.5 h-2.5 mr-1" />
                          {Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)}
                          {loc.radius && ` ±${loc.radius}m`}
                        </Badge>
                      )}
                      {hasQr && (
                        <Badge variant="outline" className="text-[10px]">
                          <QrCode className="w-2.5 h-2.5 mr-1" />
                          {loc.qrCodeData!.slice(0, 20)}
                          {loc.qrCodeData!.length > 20 && "..."}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
