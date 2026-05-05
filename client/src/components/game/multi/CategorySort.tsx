import { CheckCircle2, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SortCategory {
  id: string;
  label: string;
  color: string;
}

export interface SortItem {
  id: string;
  label: string;
}

export interface CategorySortConfig {
  title: string;
  instructions?: string;
  items: SortItem[];
  categories: SortCategory[];
  showConsensus: boolean;
}

export interface UserSort {
  userId: string;
  userName: string;
  assignments: { itemId: string; categoryId: string }[];
  submittedAt: number;
}

export interface CategorySortState extends Record<string, unknown> {
  sorts: UserSort[];
}

interface Props {
  config: CategorySortConfig;
  state: CategorySortState;
  myUserId: string;
  localAssignments: Record<string, string>;
  onAssign: (itemId: string, categoryId: string) => void;
  onSubmit: () => void;
}

function CategoryBadge({ category }: { category: SortCategory }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: category.color }}
    >
      {category.label}
    </span>
  );
}

export default function CategorySort({
  config,
  state,
  myUserId,
  localAssignments,
  onAssign,
  onSubmit,
}: Props) {
  const { title, instructions, items, categories, showConsensus } = config;
  const { sorts } = state;

  const mySort = sorts.find((s) => s.userId === myUserId);
  const hasSubmitted = Boolean(mySort);
  const allAssigned = items.every((item) => localAssignments[item.id]);
  const respondentCount = sorts.length;

  const consensusData: Record<string, Record<string, number>> = {};
  if (showConsensus && respondentCount > 0) {
    for (const item of items) {
      consensusData[item.id] = {};
      for (const cat of categories) {
        consensusData[item.id][cat.id] = 0;
      }
      for (const s of sorts) {
        const assignment = s.assignments.find((a) => a.itemId === item.id);
        if (assignment) {
          consensusData[item.id][assignment.categoryId] =
            (consensusData[item.id][assignment.categoryId] ?? 0) + 1;
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 flex flex-col px-4 py-6 gap-5" data-testid="cs-root">
      <div className="text-center">
        <div className="text-3xl mb-1">🗂️</div>
        <h1 className="text-2xl font-bold text-gray-800" data-testid="cs-title">{title}</h1>
        {instructions && (
          <p className="text-gray-500 text-sm mt-1" data-testid="cs-instructions">{instructions}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map((cat) => (
          <CategoryBadge key={cat.id} category={cat} />
        ))}
      </div>

      {!hasSubmitted ? (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const selected = localAssignments[item.id];
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm p-4"
                data-testid={`cs-item-${item.id}`}
              >
                <p className="font-medium text-gray-700 mb-3" data-testid={`cs-item-label-${item.id}`}>
                  {item.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => onAssign(item.id, cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border-2 ${
                        selected === cat.id
                          ? "text-white border-transparent"
                          : "bg-white border-gray-200 text-gray-500 hover:border-amber-300"
                      }`}
                      style={selected === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                      data-testid={`cs-assign-${item.id}-${cat.id}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <Button
            onClick={onSubmit}
            disabled={!allAssigned}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="cs-submit-btn"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            提交分類結果
          </Button>
          {!allAssigned && (
            <p className="text-center text-xs text-gray-400" data-testid="cs-incomplete-hint">
              請為所有項目選擇分類後再提交
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="font-medium text-gray-700" data-testid="cs-submitted-msg">已提交分類結果</p>
        </div>
      )}

      <div className="bg-white rounded-xl p-3 text-center text-sm text-gray-500" data-testid="cs-count">
        已回應 <span className="font-semibold text-amber-600">{respondentCount}</span> 人
      </div>

      {showConsensus && respondentCount > 0 && (
        <div className="bg-white rounded-2xl shadow p-5" data-testid="cs-consensus">
          <p className="font-semibold text-gray-700 mb-4">群體分類共識</p>
          {items.map((item) => {
            const catCounts = consensusData[item.id] ?? {};
            const top = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
            const topCatId = top?.[0];
            const topCat = categories.find((c) => c.id === topCatId);
            return (
              <div key={item.id} className="mb-4" data-testid={`cs-consensus-${item.id}`}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">{item.label}</span>
                  {topCat && <CategoryBadge category={topCat} />}
                </div>
                <div className="flex gap-1">
                  {categories.map((cat) => {
                    const count = catCounts[cat.id] ?? 0;
                    const pct = respondentCount > 0 ? (count / respondentCount) * 100 : 0;
                    return (
                      <div
                        key={cat.id}
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cat.color,
                          minWidth: count > 0 ? 4 : 0,
                        }}
                        data-testid={`cs-bar-${item.id}-${cat.id}`}
                        title={`${cat.label}: ${count}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
