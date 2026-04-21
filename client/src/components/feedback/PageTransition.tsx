// 🎬 頁面過場動畫包裹
//
// 用途：GamePageRenderer 切換頁面時給 fade + 輕微上下位移的過場，
// 消除「白閃」的突兀感。
//
// 使用：
//   <PageTransition key={page.id}>
//     <YourGamePage ... />
//   </PageTransition>
//
// 若要預設「新章節開始」效果，用 <PageTransition variant="chapter">。

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  /**
   * default: 微妙的淡入位移（頁間常用）
   * chapter: 章節切換用，有更明顯的 scale 效果
   * flow:    FlowRouter 做判斷時用，快速淡入
   */
  variant?: "default" | "chapter" | "flow";
  className?: string;
}

const variants = {
  default: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.28, ease: [0.4, 0.0, 0.2, 1] },
  },
  chapter: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.02 },
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  flow: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.18 },
  },
} as const;

export function PageTransition({
  children,
  variant = "default",
  className,
}: PageTransitionProps) {
  const v = variants[variant];
  return (
    <motion.div
      className={className}
      initial={v.initial}
      animate={v.animate}
      exit={v.exit}
      transition={v.transition}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// PageLoadingOverlay — 頁面載入中的占位畫面（取代單純白屏）
// ============================================================================

export function PageLoadingOverlay({ message = "載入中..." }: { message?: string }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-background/85 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <motion.div
            className="w-10 h-10 rounded-full border-3 border-primary/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-0 w-10 h-10 rounded-full border-3 border-t-primary border-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </motion.div>
  );
}
