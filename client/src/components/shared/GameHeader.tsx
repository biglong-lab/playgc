import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, MessageCircle, Map, Backpack, Star } from "lucide-react";

interface GameHeaderProps {
  title: string;
  score: number;
  onBack: () => void;
  onChat?: () => void;
  onMap?: () => void;
  onInventory?: () => void;
  inventoryCount?: number;
}

export default function GameHeader({
  title,
  score,
  onBack,
  onChat,
  onMap,
  onInventory,
  inventoryCount = 0,
}: GameHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            data-testid="button-back"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          
          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm truncate">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 font-number">
            <Star className="w-3 h-3 text-primary" />
            {score}
          </Badge>

          {onInventory && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onInventory}
              className="relative"
              data-testid="button-inventory"
            >
              <Backpack className="w-5 h-5" />
              {inventoryCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-number">
                  {inventoryCount}
                </span>
              )}
            </Button>
          )}

          {onMap && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onMap}
              data-testid="button-map"
            >
              <Map className="w-5 h-5" />
            </Button>
          )}

          {onChat && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onChat}
              data-testid="button-chat"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
