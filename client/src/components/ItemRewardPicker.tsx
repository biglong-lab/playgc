import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Package, Plus, X, Search, Sword, Shield, Scroll, Star } from "lucide-react";
import type { Item } from "@shared/schema";

interface ItemRewardPickerProps {
  gameId: string;
  selectedItems: string[];
  onChange: (itemIds: string[]) => void;
  maxItems?: number;
}

const ITEM_TYPE_ICONS: Record<string, typeof Package> = {
  consumable: Star,
  equipment: Shield,
  quest_item: Scroll,
  collectible: Sword,
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  consumable: "bg-green-500/20 text-green-400",
  equipment: "bg-blue-500/20 text-blue-400",
  quest_item: "bg-amber-500/20 text-amber-400",
  collectible: "bg-purple-500/20 text-purple-400",
};

export default function ItemRewardPicker({ gameId, selectedItems, onChange, maxItems = 5 }: ItemRewardPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/games", gameId, "items"],
    enabled: !!gameId && gameId !== "new",
  });

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedItemObjects = items.filter(item => selectedItems.includes(item.id));

  const handleToggleItem = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      onChange(selectedItems.filter(id => id !== itemId));
    } else if (selectedItems.length < maxItems) {
      onChange([...selectedItems, itemId]);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    onChange(selectedItems.filter(id => id !== itemId));
  };

  const getItemIcon = (itemType: string) => {
    const Icon = ITEM_TYPE_ICONS[itemType] || Package;
    return Icon;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">道具獎勵</label>
        <Badge variant="outline" className="text-xs">
          {selectedItems.length}/{maxItems}
        </Badge>
      </div>

      {selectedItemObjects.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedItemObjects.map(item => {
            const itemType = item.itemType || "consumable";
            const Icon = getItemIcon(itemType);
            return (
              <Badge
                key={item.id}
                variant="secondary"
                className={`gap-1 pr-1 ${ITEM_TYPE_COLORS[itemType] || ""}`}
              >
                <Icon className="w-3 h-3" />
                {item.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-destructive/20"
                  onClick={() => handleRemoveItem(item.id)}
                  data-testid={`button-remove-item-${item.id}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={selectedItems.length >= maxItems || !gameId || gameId === "new"}
            data-testid="button-add-item-reward"
          >
            <Plus className="w-4 h-4" />
            新增道具獎勵
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              選擇道具獎勵
            </DialogTitle>
          </DialogHeader>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋道具..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-items"
            />
          </div>

          <ScrollArea className="h-[300px]">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {items.length === 0 ? "尚未建立任何道具" : "找不到符合的道具"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map(item => {
                  const itemType = item.itemType || "consumable";
                  const Icon = getItemIcon(itemType);
                  const isSelected = selectedItems.includes(item.id);
                  const effect = item.effect as Record<string, any> | null;
                  const rarity = effect?.rarity as string | undefined;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleToggleItem(item.id)}
                      disabled={!isSelected && selectedItems.length >= maxItems}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      } ${!isSelected && selectedItems.length >= maxItems ? "opacity-50" : ""}`}
                      data-testid={`item-option-${item.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${ITEM_TYPE_COLORS[itemType] || "bg-muted"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{item.name}</span>
                            {rarity && (
                              <Badge variant="outline" className="text-xs">
                                {rarity}
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-xs text-primary-foreground">✓</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)} data-testid="button-close-item-picker">
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
