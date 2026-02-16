import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { X, Backpack, Package, Sparkles, Shield, Crosshair, FileQuestion } from "lucide-react";
import type { Item } from "@shared/schema";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface InventoryPanelProps {
  items: string[];
  gameId?: string;
  onClose: () => void;
  onUseItem?: (itemId: string) => void;
}

const getItemTypeIcon = (itemType: string | null) => {
  switch (itemType) {
    case "consumable":
      return Sparkles;
    case "equipment":
      return Shield;
    case "weapon":
      return Crosshair;
    case "quest_item":
      return FileQuestion;
    default:
      return Package;
  }
};

const getItemTypeBadge = (itemType: string | null) => {
  switch (itemType) {
    case "consumable":
      return { label: "消耗品", variant: "bg-success/20 text-success border-success/30" };
    case "equipment":
      return { label: "裝備", variant: "bg-primary/20 text-primary border-primary/30" };
    case "weapon":
      return { label: "武器", variant: "bg-destructive/20 text-destructive border-destructive/30" };
    case "quest_item":
      return { label: "任務物品", variant: "bg-warning/20 text-warning border-warning/30" };
    case "collectible":
      return { label: "收藏品", variant: "bg-accent text-accent-foreground" };
    default:
      return { label: "其他", variant: "bg-muted text-muted-foreground" };
  }
};

export default function InventoryPanel({ items, gameId, onClose, onUseItem }: InventoryPanelProps) {
  const { data: allItems, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/games", gameId, "items"],
    enabled: !!gameId && items.length > 0,
  });

  const inventoryItems = allItems?.filter(item => items.includes(item.id)) || [];

  const getItemById = (itemId: string) => {
    return inventoryItems.find(item => item.id === itemId) || {
      id: itemId,
      name: itemId,
      description: "未知物品",
      itemType: null,
      iconUrl: null,
      gameId: gameId || "",
      effect: null,
      createdAt: null,
    };
  };

  const uniqueItems = Array.from(new Set(items));
  const itemCounts = items.reduce((acc, itemId) => {
    acc[itemId] = (acc[itemId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Backpack className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold">背包</h2>
            <p className="text-xs text-muted-foreground">
              {items.length} 個物品
            </p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          data-testid="button-close-inventory"
        >
          <X className="w-5 h-5" />
        </Button>
      </header>

      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="w-12 h-12 rounded-lg mx-auto mb-3" />
                  <Skeleton className="h-4 w-3/4 mx-auto mb-2" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>背包是空的</p>
            <p className="text-sm">完成任務來獲得物品!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {uniqueItems.map((itemId, index) => {
              const item = getItemById(itemId);
              const count = itemCounts[itemId];
              const ItemIcon = getItemTypeIcon(item.itemType);
              const badge = getItemTypeBadge(item.itemType);

              return (
                <Card 
                  key={`${itemId}-${index}`}
                  className="hover-elevate cursor-pointer relative overflow-hidden"
                  onClick={() => onUseItem?.(itemId)}
                  data-testid={`inventory-item-${index}`}
                >
                  <CardContent className="p-4">
                    {count > 1 && (
                      <Badge 
                        className="absolute top-2 right-2 font-number"
                        variant="secondary"
                      >
                        x{count}
                      </Badge>
                    )}
                    
                    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3 ring-2 ring-primary/20">
                      {item.iconUrl ? (
                        <img 
                          src={item.iconUrl} 
                          alt={item.name}
                          className="w-10 h-10 object-contain"
                        />
                      ) : (
                        <ItemIcon className="w-7 h-7 text-primary" />
                      )}
                    </div>
                    
                    <h3 className="font-medium text-sm text-center mb-1 truncate">
                      {item.name}
                    </h3>
                    
                    <Badge className={`w-full justify-center mb-2 ${badge.variant}`}>
                      {badge.label}
                    </Badge>
                    
                    <p className="text-xs text-muted-foreground text-center line-clamp-2">
                      {item.description || "無描述"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
