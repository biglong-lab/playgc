// SaaS 平台初始資料 — 4 方案 + 6 功能旗標
import { db } from "../db";
import {
  platformPlans,
  platformFeatureFlags,
  fieldSubscriptions,
  fields,
} from "@shared/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// 預設方案
// ============================================================================

const DEFAULT_PLANS = [
  {
    code: "free",
    name: "免費版",
    description: "適合初試水溫的小型場域，基礎功能免費使用",
    monthlyPrice: 0,
    yearlyPrice: 0,
    transactionFeePercent: "5.00",
    limits: {
      maxGames: 3,
      maxCheckoutsPerMonth: 100,
      maxAdmins: 1,
      maxStorageGb: 1,
    },
    features: ["basic_games", "redeem_code", "qr_code"],
    sortOrder: 1,
  },
  {
    code: "pro",
    name: "專業版",
    description: "適合中型場域，解鎖水彈對戰、AI 自帶、自訂品牌",
    monthlyPrice: 1999,
    yearlyPrice: 19900,
    transactionFeePercent: "3.00",
    limits: {
      maxGames: -1,
      maxCheckoutsPerMonth: 1000,
      maxAdmins: 5,
      maxStorageGb: 10,
      maxBattleVenues: 3,
    },
    features: [
      "basic_games",
      "redeem_code",
      "qr_code",
      "battle_system",
      "ai_key_byo",
      "custom_brand",
      "email_notify",
      "line_notify",
    ],
    sortOrder: 2,
  },
  {
    code: "enterprise",
    name: "企業版",
    description: "專屬子網域、白牌方案、API 介接、專屬客服",
    monthlyPrice: 9999,
    yearlyPrice: 99900,
    transactionFeePercent: "1.00",
    limits: {
      maxGames: -1,
      maxCheckoutsPerMonth: -1,
      maxAdmins: -1,
      maxStorageGb: 100,
      maxBattleVenues: -1,
    },
    features: [
      "basic_games",
      "redeem_code",
      "qr_code",
      "battle_system",
      "ai_key_byo",
      "custom_brand",
      "email_notify",
      "line_notify",
      "custom_domain",
      "white_label",
      "api_access",
      "priority_support",
    ],
    sortOrder: 3,
  },
  {
    code: "revshare",
    name: "營收分潤合作",
    description: "無固定月費，交易抽成 10-20%，適合戰略合作夥伴",
    monthlyPrice: 0,
    yearlyPrice: 0,
    transactionFeePercent: "15.00",
    limits: {
      maxGames: -1,
      maxCheckoutsPerMonth: -1,
      maxAdmins: 3,
      maxStorageGb: 20,
    },
    features: [
      "basic_games",
      "redeem_code",
      "qr_code",
      "battle_system",
      "custom_brand",
      "email_notify",
    ],
    sortOrder: 4,
  },
];

// ============================================================================
// 預設功能旗標
// ============================================================================

const DEFAULT_FEATURE_FLAGS = [
  {
    flagKey: "battle_system",
    name: "水彈對戰系統",
    description: "對戰場地預約 + 配對 + 即時對戰 + ELO 排名",
    category: "battle",
    defaultEnabled: false,
    requiredPlan: "pro",
  },
  {
    flagKey: "ai_game_generation",
    name: "AI 生成遊戲內容",
    description: "使用 Gemini 自動生成遊戲劇情、對話、題目",
    category: "experimental",
    defaultEnabled: false,
    requiredPlan: "pro",
  },
  {
    flagKey: "custom_brand",
    name: "自訂品牌",
    description: "隱藏平台品牌，顯示場域自己的 Logo 與色系",
    category: "branding",
    defaultEnabled: false,
    requiredPlan: "pro",
  },
  {
    flagKey: "custom_domain",
    name: "自訂網域",
    description: "使用場域自己的網域（xxx.yourbrand.com）",
    category: "branding",
    defaultEnabled: false,
    requiredPlan: "enterprise",
  },
  {
    flagKey: "line_notify",
    name: "LINE 通知",
    description: "玩家可接收 LINE 推播通知",
    category: "integration",
    defaultEnabled: false,
    requiredPlan: "pro",
  },
  {
    flagKey: "api_access",
    name: "API 介接",
    description: "開放第三方系統透過 API 串接",
    category: "integration",
    defaultEnabled: false,
    requiredPlan: "enterprise",
  },
];

// ============================================================================
// Seed 執行
// ============================================================================

async function seedPlatformPlans() {
  console.log("🌱 Seeding platform plans...");
  for (const plan of DEFAULT_PLANS) {
    const existing = await db.query.platformPlans.findFirst({
      where: eq(platformPlans.code, plan.code),
    });
    if (existing) {
      console.log(`   ⏭️  ${plan.code} 已存在，跳過`);
      continue;
    }
    await db.insert(platformPlans).values(plan);
    console.log(`   ✅ ${plan.code} (${plan.name})`);
  }
}

async function seedFeatureFlags() {
  console.log("🚩 Seeding platform feature flags...");
  for (const flag of DEFAULT_FEATURE_FLAGS) {
    const existing = await db.query.platformFeatureFlags.findFirst({
      where: eq(platformFeatureFlags.flagKey, flag.flagKey),
    });
    if (existing) {
      console.log(`   ⏭️  ${flag.flagKey} 已存在，跳過`);
      continue;
    }
    await db.insert(platformFeatureFlags).values(flag);
    console.log(`   ✅ ${flag.flagKey}`);
  }
}

async function ensureFieldSubscriptions() {
  console.log("📝 Ensuring all fields have subscription records...");
  const allFields = await db.select().from(fields);
  const proPlan = await db.query.platformPlans.findFirst({
    where: eq(platformPlans.code, "pro"),
  });
  if (!proPlan) {
    console.log("   ⚠️  未找到 Pro 方案，跳過");
    return;
  }

  for (const field of allFields) {
    const existing = await db.query.fieldSubscriptions.findFirst({
      where: eq(fieldSubscriptions.fieldId, field.id),
    });
    if (existing) {
      console.log(`   ⏭️  ${field.code} 已有訂閱，跳過`);
      continue;
    }
    // 第一個場域（賈村）預設給 Pro，其他場域預設 Free
    const isFirstField = field.code === "JIACHUN";
    const plan = isFirstField ? proPlan : await db.query.platformPlans.findFirst({
      where: eq(platformPlans.code, "free"),
    });
    if (!plan) continue;

    await db.insert(fieldSubscriptions).values({
      fieldId: field.id,
      planId: plan.id,
      status: "active",
      billingCycle: "monthly",
      notes: `初始化：自動指派 ${plan.code} 方案`,
    });
    console.log(`   ✅ ${field.code} → ${plan.code}`);
  }
}

// ============================================================================
// 主函式
// ============================================================================

export async function seedPlatform() {
  try {
    await seedPlatformPlans();
    await seedFeatureFlags();
    await ensureFieldSubscriptions();
    console.log("✨ Platform seed 完成！");
  } catch (error) {
    console.error("❌ Platform seed 失敗:", error);
    throw error;
  }
}

// 直接執行時
seedPlatform()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
