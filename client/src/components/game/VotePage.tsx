import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import * as LucideIcons from "lucide-react";
import { Vote, Clock, Users, CheckCircle, Timer, Eye, EyeOff, AlertCircle } from "lucide-react";
import type { VoteConfig } from "@shared/schema";

interface VotePageProps {
  config: VoteConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

interface VoteResult {
  optionIndex: number;
  count: number;
  percentage: number;
}

export default function VotePage({ config, onComplete, sessionId, variables, onVariableUpdate }: VotePageProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [voteResults, setVoteResults] = useState<VoteResult[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const options = config.options || [];
  const votingTimeLimit = config.votingTimeLimit || 0;
  const minVotes = config.minVotes || 1;
  const hasValidOptions = options.length > 0;

  const questionHash = config.question ? config.question.replace(/\s/g, "").slice(0, 30) : "default";
  const voteStorageKey = `vote_${sessionId}_${questionHash}`;

  useEffect(() => {
    if (hasValidOptions) {
      const storedVotes = variables[voteStorageKey] as { results: VoteResult[]; total: number } | undefined;
      if (storedVotes && storedVotes.results.length === options.length) {
        setVoteResults(storedVotes.results);
        setTotalVotes(storedVotes.total);
      } else {
        const initialResults = options.map((_, index) => ({
          optionIndex: index,
          count: 0,
          percentage: 0
        }));
        setVoteResults(initialResults);
        setTotalVotes(0);
      }
    }
  }, [hasValidOptions, options.length, voteStorageKey]);

  useEffect(() => {
    if (votingTimeLimit > 0 && hasValidOptions) {
      setTimeLeft(votingTimeLimit);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            if (!hasVoted && selectedOption !== null) {
              handleVoteSubmit();
            } else if (!hasVoted) {
              setTimedOut(true);
              setHasVoted(true);
              if (config.showResults) {
                setShowResults(true);
              }
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [votingTimeLimit, hasVoted, selectedOption, hasValidOptions]);

  const getIcon = (iconName?: string) => {
    if (!iconName) return null;
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : null;
  };

  const handleOptionSelect = (index: number) => {
    if (hasVoted) return;
    setSelectedOption(index);
  };

  const handleVoteSubmit = () => {
    if (selectedOption === null || hasVoted || !hasValidOptions) return;
    
    setIsAnimating(true);
    setHasVoted(true);

    setTimeout(() => {
      setIsAnimating(false);
      
      const currentResults = voteResults.length > 0 ? voteResults : options.map((_, index) => ({
        optionIndex: index,
        count: 0,
        percentage: 0
      }));
      
      const newResults = currentResults.map((r: VoteResult) => ({ ...r }));
      if (newResults[selectedOption]) {
        newResults[selectedOption].count += 1;
      }
      const newTotal = totalVotes + 1;
      newResults.forEach((r: VoteResult) => {
        r.percentage = newTotal > 0 ? Math.round((r.count / newTotal) * 100) : 0;
      });
      
      onVariableUpdate(voteStorageKey, { results: newResults, total: newTotal });
      
      setVoteResults(newResults);
      setTotalVotes(newTotal);
      
      if (config.showResults) {
        setShowResults(true);
      }
    }, 500);
  };

  const canContinue = hasVoted && (totalVotes >= minVotes || timedOut || minVotes <= 1);

  const handleContinue = () => {
    if (timedOut || selectedOption === null) {
      onComplete();
      return;
    }
    const selectedOpt = options[selectedOption];
    const nextPage = selectedOpt?.nextPageId || undefined;
    onComplete(undefined, nextPage);
  };

  const getTimeProgress = () => {
    if (!votingTimeLimit || timeLeft === null) return 100;
    return (timeLeft / votingTimeLimit) * 100;
  };

  const isUrgent = timeLeft !== null && timeLeft <= 10;

  const getWinningOption = () => {
    if (voteResults.length === 0) return null;
    return voteResults.reduce((max, r) => r.count > max.count ? r : max, voteResults[0]);
  };

  if (!hasValidOptions) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="p-6 text-center">
            <Vote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">投票設定不完整</h3>
            <p className="text-muted-foreground mb-4">
              此投票頁面尚未設定選項，請聯繫遊戲管理員。
            </p>
            <Button onClick={() => onComplete()} data-testid="button-skip-vote">
              跳過此頁
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      {votingTimeLimit > 0 && timeLeft !== null && !hasVoted && (
        <div className="w-full max-w-md mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className={`flex items-center gap-2 ${isUrgent ? "text-destructive" : "text-muted-foreground"}`}>
              <Timer className={`w-5 h-5 ${isUrgent ? "animate-pulse" : ""}`} />
              <span className="font-mono font-bold text-lg">
                {timeLeft}s
              </span>
            </div>
            <span className="text-sm text-muted-foreground">投票倒數</span>
          </div>
          <Progress 
            value={getTimeProgress()} 
            className={`h-2 ${isUrgent ? "[&>div]:bg-destructive" : ""}`}
          />
        </div>
      )}

      <Card className="w-full max-w-lg">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Vote className="w-6 h-6 text-primary" />
            </div>
            <div>
              {config.title && (
                <h2 className="text-xl font-bold">{config.title}</h2>
              )}
              <p className="text-muted-foreground text-sm">
                {config.anonymousVoting ? "匿名投票" : "公開投票"}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-1">{config.question}</h3>
            <p className="text-sm text-muted-foreground">
              請選擇您的答案
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {options.map((option, index) => {
              const isSelected = selectedOption === index;
              const result = voteResults[index];
              const isWinner = showResults && getWinningOption()?.optionIndex === index;
              
              return (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(index)}
                  disabled={hasVoted}
                  data-testid={`vote-option-${index}`}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-300 text-left relative overflow-hidden
                    ${isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                    }
                    ${hasVoted ? "cursor-default" : "cursor-pointer"}
                    ${isWinner ? "ring-2 ring-primary ring-offset-2" : ""}
                  `}
                >
                  {showResults && result && (
                    <div 
                      className="absolute inset-0 bg-primary/10 transition-all duration-1000 ease-out"
                      style={{ width: `${result.percentage}%` }}
                    />
                  )}
                  
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {option.icon && (
                        <span className="text-primary">
                          {getIcon(option.icon)}
                        </span>
                      )}
                      <span className={`font-medium ${isSelected ? "text-primary" : ""}`}>
                        {option.text}
                      </span>
                      {isSelected && hasVoted && (
                        <Badge variant="secondary" className="ml-2">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          已投票
                        </Badge>
                      )}
                    </div>
                    
                    {showResults && result && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">
                          {result.percentage}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({result.count} 票)
                        </span>
                      </div>
                    )}
                    
                    {!hasVoted && isSelected && (
                      <div className="w-5 h-5 rounded-full border-2 border-primary bg-primary flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                    
                    {!hasVoted && !isSelected && (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {showResults && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>總投票數</span>
                </div>
                <span className="font-bold">{totalVotes} 票</span>
              </div>
              {minVotes > 1 && totalVotes < minVotes && (
                <div className="flex items-center gap-2 text-xs text-amber-500">
                  <AlertCircle className="w-3 h-3" />
                  <span>需要至少 {minVotes} 票才能確認結果</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {!hasVoted ? (
              <Button
                onClick={handleVoteSubmit}
                disabled={selectedOption === null || isAnimating}
                size="lg"
                className="w-full"
                data-testid="button-submit-vote"
              >
                {isAnimating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">
                      <Clock className="w-4 h-4" />
                    </span>
                    投票中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Vote className="w-4 h-4" />
                    確認投票
                  </span>
                )}
              </Button>
            ) : (
              <>
                {timedOut && (
                  <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-500">
                      <Timer className="w-4 h-4" />
                      <span className="text-sm font-medium">投票時間已結束</span>
                    </div>
                  </div>
                )}
                
                {config.showResults && !showResults && !timedOut && (
                  <Button
                    onClick={() => setShowResults(true)}
                    variant="outline"
                    size="lg"
                    className="w-full"
                    data-testid="button-show-results"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    查看結果
                  </Button>
                )}
                
                <Button
                  onClick={handleContinue}
                  disabled={!canContinue}
                  size="lg"
                  className="w-full"
                  data-testid="button-continue"
                >
                  {!canContinue ? (
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      等待更多投票 ({totalVotes}/{minVotes})
                    </span>
                  ) : timedOut ? (
                    <>
                      跳過此頁
                      <LucideIcons.ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      繼續
                      <LucideIcons.ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {config.anonymousVoting && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <EyeOff className="w-4 h-4" />
          <span>您的投票將保持匿名</span>
        </div>
      )}
    </div>
  );
}
