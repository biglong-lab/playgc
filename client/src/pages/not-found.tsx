import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>
        
        <h1 className="font-display text-6xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-xl font-medium mb-2">頁面不存在</h2>
        <p className="text-muted-foreground mb-8">
          你要找的頁面可能已被移除或不存在
        </p>
        
        <Link href="/">
          <Button className="gap-2" data-testid="button-go-home">
            <Home className="w-4 h-4" />
            返回首頁
          </Button>
        </Link>
      </div>
    </div>
  );
}
