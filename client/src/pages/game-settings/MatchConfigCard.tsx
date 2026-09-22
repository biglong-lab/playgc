// 🏁 遊戲設定：競賽 / 接力規則（2026-09-23 P1；寫入 games.match_config）
//   業主：競賽個人對戰（比成績 / 速度）；接力依頁面分段（每一棒負責第幾頁到第幾頁）
import { useState } from "react";
import { Swords, Plus, Trash2, Wand2, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MATCH_CONFIG_DEFAULTS, type GameMatchConfig } from "@shared/schema";
import { evenRelaySegments, validateRelaySegments } from "@shared/lib/match-rules";

interface MatchConfigCardProps {
  mode: "competitive" | "relay";
  config: GameMatchConfig;
  pageCount: number;
  canEdit: boolean;
  onChange: (next: GameMatchConfig) => void;
}

function toInt(value: string, fallback: number): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function NumberField(props: {
  id: string; label: string; hint?: string; value: number; min: number; max: number;
  disabled: boolean; onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        type="number"
        min={props.min}
        max={props.max}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Math.min(props.max, Math.max(props.min, toInt(e.target.value, props.min))))}
        data-testid={`input-${props.id}`}
      />
      {props.hint && <p className="text-xs text-muted-foreground">{props.hint}</p>}
    </div>
  );
}

export function MatchConfigCard({ mode, config, pageCount, canEdit, onChange }: MatchConfigCardProps) {
  const set = (patch: Partial<GameMatchConfig>) => onChange({ ...config, ...patch });
  const isRelay = mode === "relay";
  return (
    <Card data-testid="card-match-config">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-primary" />
          {isRelay ? "接力規則" : "競賽規則"}
        </CardTitle>
        <CardDescription>
          {isRelay
            ? "一隊輪流玩：每人負責一段頁面，完成自動交給下一棒，最後一棒完成就結算"
            : "玩家各自玩同一款遊戲，全員完成或時間到自動排名（同分比完成速度）"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="match-time-limit" label="限時（分鐘）" hint="0 = 不限時" min={0} max={600}
            value={config.timeLimitMinutes ?? MATCH_CONFIG_DEFAULTS.timeLimitMinutes} disabled={!canEdit}
            onChange={(n) => set({ timeLimitMinutes: n })} />
          <NumberField id="match-countdown" label="開賽倒數（秒）" min={0} max={30}
            value={config.countdownSeconds ?? MATCH_CONFIG_DEFAULTS.countdownSeconds} disabled={!canEdit}
            onChange={(n) => set({ countdownSeconds: n })} />
          {!isRelay && (
            <>
              <NumberField id="match-min" label="最少人數" min={1} max={100}
                value={config.minParticipants ?? MATCH_CONFIG_DEFAULTS.minParticipants} disabled={!canEdit}
                onChange={(n) => set({ minParticipants: n })} />
              <NumberField id="match-max" label="最多人數" min={1} max={100}
                value={config.maxParticipants ?? MATCH_CONFIG_DEFAULTS.maxParticipants} disabled={!canEdit}
                onChange={(n) => set({ maxParticipants: n })} />
            </>
          )}
        </div>
        {isRelay && (
          <RelaySegmentsEditor
            segments={config.relaySegments ?? []}
            pageCount={pageCount}
            canEdit={canEdit}
            onChange={(relaySegments) => set({ relaySegments })}
          />
        )}
      </CardContent>
    </Card>
  );
}

type Segment = { fromPage: number; toPage: number };

function RelaySegmentsEditor(props: {
  segments: Segment[]; pageCount: number; canEdit: boolean; onChange: (s: Segment[]) => void;
}) {
  const { segments, pageCount, canEdit, onChange } = props;
  const [legs, setLegs] = useState(String(Math.max(2, segments.length || 2)));
  const { errors, warnings } = validateRelaySegments(segments, pageCount);
  const update = (i: number, patch: Partial<Segment>) =>
    onChange(segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const last = segments[segments.length - 1];

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="relay-legs">幾棒（幾個人）</Label>
          <Input id="relay-legs" type="number" min={1} max={20} className="w-24" value={legs}
            disabled={!canEdit} onChange={(e) => setLegs(e.target.value)} />
        </div>
        <Button type="button" variant="outline" className="gap-1" disabled={!canEdit || pageCount === 0}
          onClick={() => onChange(evenRelaySegments(pageCount, toInt(legs, 2)))} data-testid="button-relay-even-split">
          <Wand2 className="w-4 h-4" />
          平均分配 {pageCount} 頁
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">開賽時依加入順序分棒；參賽人數必須剛好等於棒數。</p>
      {segments.map((s, i) => (
        <SegmentRow key={i} index={i} segment={s} pageCount={pageCount} canEdit={canEdit}
          onChange={(patch) => update(i, patch)} onRemove={() => onChange(segments.filter((_, idx) => idx !== i))} />
      ))}
      <Button type="button" variant="ghost" size="sm" className="gap-1" disabled={!canEdit || segments.length >= 20}
        onClick={() => {
          const from = Math.min(pageCount || 1, (last?.toPage ?? 0) + 1);
          onChange([...segments, { fromPage: from, toPage: Math.max(from, pageCount) }]);
        }}>
        <Plus className="w-4 h-4" />
        新增一棒
      </Button>
      <ValidationMessages errors={errors} warnings={warnings} />
    </div>
  );
}

function SegmentRow(props: {
  index: number; segment: Segment; pageCount: number; canEdit: boolean;
  onChange: (patch: Partial<Segment>) => void; onRemove: () => void;
}) {
  const { index: i, segment: s, pageCount, canEdit } = props;
  return (
    <div className="flex items-center gap-2 text-sm" data-testid={`relay-segment-${i}`}>
      <span className="w-14 shrink-0 font-medium">第 {i + 1} 棒</span>
      <Input type="number" min={1} max={pageCount} className="w-20" value={s.fromPage} disabled={!canEdit}
        aria-label={`第 ${i + 1} 棒起始頁`} onChange={(e) => props.onChange({ fromPage: toInt(e.target.value, 1) })} />
      <span>到</span>
      <Input type="number" min={1} max={pageCount} className="w-20" value={s.toPage} disabled={!canEdit}
        aria-label={`第 ${i + 1} 棒結束頁`} onChange={(e) => props.onChange({ toPage: toInt(e.target.value, 1) })} />
      <span>頁</span>
      <Button type="button" variant="ghost" size="icon" disabled={!canEdit} aria-label={`刪除第 ${i + 1} 棒`} onClick={props.onRemove}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function ValidationMessages({ errors, warnings }: { errors: string[]; warnings: string[] }) {
  return (
    <>
      {errors.map((m) => (
        <p key={m} className="flex gap-1 text-xs text-destructive"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{m}</p>
      ))}
      {warnings.map((m) => (
        <p key={m} className="flex gap-1 text-xs text-amber-600 dark:text-amber-400"><Info className="w-3.5 h-3.5 shrink-0" />{m}</p>
      ))}
    </>
  );
}
