import { Star, Plus, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface BucketListConfig {
  title: string;
  prompt?: string;
  placeholder?: string;
  maxItemsPerPerson: number;
  maxItemLength: number;
  allowSupport: boolean;
}

export interface BucketItem {
  id: string;
  userId: string;
  userName: string;
  text: string;
  supporters: string[];
  addedAt: number;
}

export interface BucketListState extends Record<string, unknown> {
  items: BucketItem[];
}

interface Props {
  config: BucketListConfig;
  state: BucketListState;
  myUserId: string;
  draftText: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onSupport: (itemId: string) => void;
}

export default function BucketList({
  config,
  state,
  myUserId,
  draftText,
  onDraftChange,
  onAdd,
  onSupport,
}: Props) {
  const {
    title,
    prompt = "寫下你想實現的事！",
    placeholder = "我想要…",
    maxItemsPerPerson,
    maxItemLength,
    allowSupport,
  } = config;

  const { items } = state;

  const myCount = items.filter((i) => i.userId === myUserId).length;
  const canAdd = myCount < maxItemsPerPerson && draftText.trim().length > 0;

  const sorted = [...items].sort((a, b) => b.supporters.length - a.supporters.length || a.addedAt - b.addedAt);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col px-4 py-6 gap-4" data-testid="bucket-list-root">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2" data-testid="bl-title">
          <Star className="w-6 h-6 text-indigo-500" />
          {title}
        </h1>
        <p className="text-gray-500 text-sm mt-1" data-testid="bl-prompt">{prompt}</p>
      </div>

      {/* Stats */}
      <div className="text-center text-sm text-gray-400">
        <span data-testid="bl-item-count">{items.length}</span> 個願望 · 我加了{" "}
        <span data-testid="bl-my-count">{myCount}</span>/{maxItemsPerPerson}
      </div>

      {/* Add form */}
      {myCount < maxItemsPerPerson ? (
        <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-2" data-testid="bl-add-form">
          <div className="flex gap-2">
            <Input
              value={draftText}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder={placeholder}
              maxLength={maxItemLength}
              className="flex-1"
              data-testid="bl-draft-input"
            />
            <Button
              onClick={onAdd}
              disabled={!canAdd}
              className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0"
              data-testid="bl-add-btn"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-xs text-gray-400 text-right">{maxItemLength - draftText.length} 字</span>
        </div>
      ) : (
        <div className="text-center text-sm text-gray-400 bg-white rounded-xl py-3" data-testid="bl-max-reached">
          已達新增上限
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <div className="text-center text-gray-400 py-8" data-testid="bl-empty">
          還沒有願望，第一個加入吧！
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-testid="bl-item-list">
          {sorted.map((item) => {
            const isOwn = item.userId === myUserId;
            const hasSupported = item.supporters.includes(myUserId);
            const canSupport = allowSupport && !isOwn;

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3"
                data-testid={`bl-item-${item.id}`}
              >
                <Star className="w-4 h-4 text-indigo-300 shrink-0" />
                <div className="flex-1">
                  <p className="text-gray-800 text-sm" data-testid={`bl-text-${item.id}`}>{item.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5" data-testid={`bl-author-${item.id}`}>
                    {isOwn ? "我" : item.userName}
                  </p>
                </div>

                {allowSupport && (
                  <button
                    onClick={() => onSupport(item.id)}
                    disabled={!canSupport}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
                      hasSupported
                        ? "text-indigo-500 bg-indigo-50"
                        : "text-gray-400 hover:text-indigo-400 hover:bg-indigo-50"
                    } disabled:opacity-40 disabled:cursor-default`}
                    data-testid={`bl-support-btn-${item.id}`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span data-testid={`bl-support-count-${item.id}`}>{item.supporters.length}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
