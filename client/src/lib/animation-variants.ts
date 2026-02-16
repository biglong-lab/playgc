import type { Variants } from "framer-motion";

/** 頁面淡入淡出（視圖切換用） */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

/** 倒數數字動畫（spring 彈入 + 放大淡出） */
export const countdownNumber: Variants = {
  initial: { scale: 0.5, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 15 },
  },
  exit: {
    scale: 1.5,
    opacity: 0,
    transition: { duration: 0.3 },
  },
};

/** 排名項目進場（排名列表用） */
export const rankingItem: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 },
  },
};

/** 慶祝彈入效果（完成頁面用） */
export const celebrationPop: Variants = {
  initial: { scale: 0 },
  animate: {
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 10,
      delay: 0.2,
    },
  },
};
