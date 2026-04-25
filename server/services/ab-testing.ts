// 規則 A/B Testing — Phase 16.6
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26 進階管理
//
// 設計：
//   - 每條規則可選擇加入 A/B test group（'A' 或 'B'）
//   - ab_test_traffic：0-100 整數，% 流量
//   - 用 squadId + ruleId 哈希做 deterministic bucket（同一隊伍同條規則永遠落同一組）
//
// 規則：
//   - traffic = 100 → 永遠匹配（全量）
//   - traffic = 0   → 永遠不匹配（關閉）
//   - traffic = 50  → 50% 機率匹配（用 hash 決定）
//
// 用法：
//   if (!shouldApplyRule({ ruleId, squadId, traffic })) continue;

import crypto from "crypto";

/**
 * 把 ruleId + squadId 哈希成 0-99 的整數
 * 同樣的 (ruleId, squadId) 永遠回傳同樣的數字
 */
export function hashToBucket(ruleId: string, subjectId: string): number {
  const input = `${ruleId}::${subjectId}`;
  const hash = crypto.createHash("sha256").update(input).digest();
  // 取前 4 bytes 當 unsigned int，mod 100
  const num = hash.readUInt32BE(0);
  return num % 100;
}

export interface ApplyRuleInput {
  ruleId: string;
  /** squadId / userId / fieldId — 根據哪個維度做 bucket */
  subjectId: string;
  /** 0-100 % 流量 */
  traffic: number;
}

/**
 * 判斷是否該套用此規則（依 A/B traffic）
 *
 * 邏輯：
 *   - traffic >= 100 → true（全量）
 *   - traffic <= 0   → false（關閉）
 *   - 否則 hash bucket < traffic → true
 */
export function shouldApplyRule(input: ApplyRuleInput): boolean {
  if (input.traffic >= 100) return true;
  if (input.traffic <= 0) return false;
  const bucket = hashToBucket(input.ruleId, input.subjectId);
  return bucket < input.traffic;
}
