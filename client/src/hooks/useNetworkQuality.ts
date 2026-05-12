// 📶 useNetworkQuality — 偵測網路品質（弱網自動降級用）
//
// 用 Network Information API（Chrome / Edge 支援、Safari 不支援）
// 不支援時假設 "4g"（不降級、不打擾）
//
// 用法：
//   const { quality, saveData, effectiveType } = useNetworkQuality()
//   if (quality === "slow") fetchImage({ q: 'auto:low' })

import { useEffect, useState } from "react";

export type NetworkQuality = "fast" | "moderate" | "slow" | "unknown";

interface NetworkInfo {
  quality: NetworkQuality;
  effectiveType: string;
  /** 使用者明確開了「Data Saver」模式 */
  saveData: boolean;
  /** 下行速度（Mbps）*/
  downlink: number | null;
}

interface NetworkInformation extends EventTarget {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  saveData?: boolean;
  downlink?: number;
  addEventListener: (type: "change", listener: () => void) => void;
  removeEventListener: (type: "change", listener: () => void) => void;
}

function getConnection(): NetworkInformation | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function classify(eff: string | undefined, saveData: boolean | undefined): NetworkQuality {
  if (saveData) return "slow";
  if (!eff) return "unknown";
  if (eff === "slow-2g" || eff === "2g") return "slow";
  if (eff === "3g") return "moderate";
  return "fast";
}

function read(): NetworkInfo {
  const conn = getConnection();
  if (!conn) {
    return { quality: "unknown", effectiveType: "unknown", saveData: false, downlink: null };
  }
  return {
    quality: classify(conn.effectiveType, conn.saveData),
    effectiveType: conn.effectiveType ?? "unknown",
    saveData: conn.saveData ?? false,
    downlink: conn.downlink ?? null,
  };
}

export function useNetworkQuality(): NetworkInfo {
  const [info, setInfo] = useState<NetworkInfo>(() => read());

  useEffect(() => {
    const conn = getConnection();
    if (!conn) return;
    const onChange = () => setInfo(read());
    conn.addEventListener("change", onChange);
    setInfo(read());
    return () => conn.removeEventListener("change", onChange);
  }, []);

  return info;
}

/** 給 Cloudinary URL 加上品質參數（弱網時降為 auto:low、Data Saver 降為 auto:eco）*/
export function withNetworkQuality(url: string, info: NetworkInfo): string {
  if (!url.includes("res.cloudinary.com")) return url;
  if (info.quality === "unknown" || info.quality === "fast") return url;

  // 弱網 / Data Saver → 改用低品質 transformation
  const param = info.saveData ? "q_auto:eco" : "q_auto:low";
  // 已經有 q_ 參數就不重複加
  if (/\/q_[a-z0-9:]+\//.test(url)) return url;
  // 在 /upload/ 後插入
  return url.replace("/upload/", `/upload/${param}/`);
}
