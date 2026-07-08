// 🔦 手電筒元件編輯器（Phase 批 2 / 2026-05-12）
//
// 業主回報 #7：手電筒設定區只給 JSON editor、加完整欄位 UI
//
// 元件對應：client/src/components/game/solo/FlashlightPage.tsx
// 用到 config 欄位：
//   - title / description
//   - requiredOnSeconds（手電筒開啟需持續秒數、0 = 點一下就完成）
//   - rewardPoints

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EditorProps } from "./page-config-shared";

export default function FlashlightEditor({ config, updateField }: EditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">標題</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="點亮手電筒"
          data-testid="config-flashlight-title"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">說明（玩家看到）</label>
        <Textarea
          value={config.description || ""}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="請點亮手電筒、看清楚周圍環境"
          rows={2}
          data-testid="config-flashlight-description"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">需持續開啟秒數</label>
        <Input
          type="number"
          value={config.requiredOnSeconds ?? 0}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            updateField("requiredOnSeconds", Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          min={0}
          max={300}
          data-testid="config-flashlight-seconds"
        />
        <p className="text-xs text-muted-foreground mt-1">
          0 = 點一下就完成；&gt; 0 = 必須開啟此秒數才算過關
        </p>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">獎勵分數</label>
        <Input
          type="number"
          // 🎯 2026-07-08 CHITO #c1149bc8：預設 0（給分需明確設定）
          value={config.rewardPoints ?? 0}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            updateField("rewardPoints", Number.isFinite(n) ? n : 0);
          }}
          min={0}
          max={1000}
          data-testid="config-flashlight-points"
        />
        <p className="text-xs text-muted-foreground mt-1">
          可填 0 表示無獎勵
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-100">
        <p className="font-semibold mb-1">📱 裝置相容性</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Android Chrome：~70% 裝置支援手電筒（torch API）</li>
          <li>iOS Safari：❌ 不支援硬體手電筒（玩家需手動開）</li>
          <li>不支援的裝置會顯示提示、玩家可仍完成</li>
        </ul>
      </div>
    </div>
  );
}
