// 🫥 統一空狀態元件 — 讓空白頁面有引導
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { PackageOpen } from "lucide-react";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline";
}

interface EmptyStateProps {
  icon?: LucideIcon;
  emoji?: string;
  title?: string;
  description?: string;
  actions?: EmptyStateAction[];
  className?: string;
}

export default function EmptyState({
  icon: Icon = PackageOpen,
  emoji,
  title = "這裡還沒有東西",
  description,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardContent className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          {emoji ? (
            <span className="text-3xl">{emoji}</span>
          ) : (
            <Icon className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-base font-medium mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
            {description}
          </p>
        )}
        {actions && actions.length > 0 && (
          <div className="flex gap-2 justify-center">
            {actions.map((action, i) => {
              const btn = (
                <Button
                  key={i}
                  variant={action.variant ?? (i === 0 ? "default" : "outline")}
                  size="sm"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              );
              if (action.href) {
                return (
                  <Link key={i} href={action.href}>
                    {btn}
                  </Link>
                );
              }
              return btn;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
