import React from "react";

export interface NeverHaveIEverConfig extends Record<string, unknown> {
  title: string;
  prompt?: string;
  statements: string[];
  showWhoAdmitted: boolean;
}

export interface NeverResponse extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  statementIndex: number;
  haveDone: boolean;
}

export interface NeverHaveIEverState extends Record<string, unknown> {
  responses: NeverResponse[];
  revealed: boolean;
}

interface Props {
  config: NeverHaveIEverConfig;
  state: NeverHaveIEverState;
  myUserId: string;
  onRespond: (statementIndex: number, haveDone: boolean) => void;
  onReveal: () => void;
}

export default function NeverHaveIEver({ config, state, myUserId, onRespond, onReveal }: Props) {
  const { statements, title, prompt, showWhoAdmitted } = config;
  const { responses, revealed } = state;

  function myResponseFor(idx: number): NeverResponse | undefined {
    return responses.find((r) => r.userId === myUserId && r.statementIndex === idx);
  }

  function countFor(idx: number, haveDone: boolean): number {
    return responses.filter((r) => r.statementIndex === idx && r.haveDone === haveDone).length;
  }

  return (
    <div data-testid="nhie-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="nhie-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      {prompt && (
        <p data-testid="nhie-prompt" className="text-sm text-center text-gray-600">
          {prompt}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {statements.map((stmt, idx) => {
          const myRes = myResponseFor(idx);
          const haveCount = countFor(idx, true);
          const haventCount = countFor(idx, false);
          const total = haveCount + haventCount;

          return (
            <div
              key={idx}
              data-testid={`nhie-stmt-${idx}`}
              className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
            >
              <p className="font-medium text-gray-800 mb-3">
                <span className="text-indigo-500 font-bold mr-2">#{idx + 1}</span>
                我從來沒有… {stmt}
              </p>

              <div className="flex gap-2">
                <button
                  data-testid={`nhie-have-btn-${idx}`}
                  onClick={() => !myRes && onRespond(idx, true)}
                  className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                    myRes?.haveDone === true
                      ? "bg-green-500 text-white"
                      : myRes
                      ? "bg-gray-100 text-gray-400 cursor-default"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  ✋ 我有！
                </button>
                <button
                  data-testid={`nhie-havent-btn-${idx}`}
                  onClick={() => !myRes && onRespond(idx, false)}
                  className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                    myRes?.haveDone === false
                      ? "bg-gray-500 text-white"
                      : myRes
                      ? "bg-gray-100 text-gray-400 cursor-default"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  🙅 我沒有
                </button>
              </div>

              {(myRes || revealed) && total > 0 && (
                <div data-testid={`nhie-count-${idx}`} className="mt-2 text-xs text-gray-500 text-center">
                  {haveCount} 人有 · {haventCount} 人沒有
                  {revealed && showWhoAdmitted && haveCount > 0 && (
                    <span className="ml-2">
                      (
                      {responses
                        .filter((r) => r.statementIndex === idx && r.haveDone)
                        .map((r) => r.userName)
                        .join(", ")}
                      )
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!revealed ? (
        <button
          data-testid="nhie-reveal-btn"
          onClick={onReveal}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
        >
          揭曉完整結果
        </button>
      ) : (
        <div
          data-testid="nhie-result"
          className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 text-center"
        >
          <div className="font-semibold text-indigo-700">統計完成！共 {statements.length} 題</div>
        </div>
      )}
    </div>
  );
}
