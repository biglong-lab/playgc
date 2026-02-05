import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Vote, Check, Clock, Users, ChevronRight } from "lucide-react";

interface VoteOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  gotoPageId?: string;
}

interface VoteBallot {
  voterId: string;
  userName: string;
  userAvatar?: string;
  choice: string;
  timestamp: string;
}

interface VotePageProps {
  pageId: string;
  title: string;
  description?: string;
  options: VoteOption[];
  votingType: "majority" | "unanimous" | "first" | "timed";
  timeLimit?: number;
  minVotes?: number;
  showVoters?: boolean;
  allowChangeVote?: boolean;
  currentUserId: string;
  teamMembers: { id: string; name: string; avatar?: string }[];
  existingVotes: VoteBallot[];
  onVote: (optionId: string) => void;
  onComplete: (winningOptionId: string, gotoPageId?: string) => void;
}

export function VotePage({
  pageId,
  title,
  description,
  options,
  votingType,
  timeLimit,
  minVotes,
  showVoters = true,
  allowChangeVote = false,
  currentUserId,
  teamMembers,
  existingVotes,
  onVote,
  onComplete,
}: VotePageProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit || 0);
  const [votes, setVotes] = useState<VoteBallot[]>(existingVotes);

  const myVote = votes.find(v => v.voterId === currentUserId);
  const totalMembers = teamMembers.length;
  const totalVotes = votes.length;

  useEffect(() => {
    setVotes(existingVotes);
  }, [existingVotes]);

  useEffect(() => {
    if (myVote) {
      setSelectedOption(myVote.choice);
      setHasVoted(true);
    }
  }, [myVote]);

  useEffect(() => {
    if (votingType === "timed" && timeLimit && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            checkVoteResult();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [votingType, timeLimit, timeRemaining]);

  const getVoteCountForOption = useCallback((optionId: string) => {
    return votes.filter(v => v.choice === optionId).length;
  }, [votes]);

  const getVotersForOption = useCallback((optionId: string) => {
    return votes
      .filter(v => v.choice === optionId)
      .map(v => ({ name: v.userName, avatar: v.userAvatar }));
  }, [votes]);

  const checkVoteResult = useCallback(() => {
    if (totalVotes === 0) return;

    let winningOption: string | null = null;

    switch (votingType) {
      case "majority":
        const voteCounts = options.map(opt => ({
          id: opt.id,
          count: getVoteCountForOption(opt.id),
        }));
        const maxVotes = Math.max(...voteCounts.map(v => v.count));
        const winners = voteCounts.filter(v => v.count === maxVotes);
        if (winners.length === 1 && maxVotes > totalMembers / 2) {
          winningOption = winners[0].id;
        }
        break;

      case "unanimous":
        const firstChoice = votes[0]?.choice;
        if (firstChoice && votes.every(v => v.choice === firstChoice) && totalVotes === totalMembers) {
          winningOption = firstChoice;
        }
        break;

      case "first":
        if (totalVotes >= (minVotes || 1)) {
          const counts = options.map(opt => ({
            id: opt.id,
            count: getVoteCountForOption(opt.id),
          }));
          const max = Math.max(...counts.map(v => v.count));
          const winner = counts.find(v => v.count === max);
          if (winner) winningOption = winner.id;
        }
        break;

      case "timed":
        if (timeRemaining === 0 && totalVotes > 0) {
          const counts = options.map(opt => ({
            id: opt.id,
            count: getVoteCountForOption(opt.id),
          }));
          const max = Math.max(...counts.map(v => v.count));
          const winner = counts.find(v => v.count === max);
          if (winner) winningOption = winner.id;
        }
        break;
    }

    if (winningOption) {
      const option = options.find(o => o.id === winningOption);
      onComplete(winningOption, option?.gotoPageId);
    }
  }, [votes, totalVotes, totalMembers, votingType, options, minVotes, timeRemaining, onComplete, getVoteCountForOption]);

  useEffect(() => {
    checkVoteResult();
  }, [votes, checkVoteResult]);

  const handleVote = (optionId: string) => {
    if (hasVoted && !allowChangeVote) return;
    
    setSelectedOption(optionId);
    setHasVoted(true);
    onVote(optionId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Vote className="w-5 h-5 text-primary" />
              <CardTitle>{title}</CardTitle>
            </div>
            {votingType === "timed" && timeLimit && (
              <Badge variant={timeRemaining < 10 ? "destructive" : "secondary"} className="gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(timeRemaining)}
              </Badge>
            )}
          </div>
          {description && (
            <CardDescription>{description}</CardDescription>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <Users className="w-4 h-4" />
            <span>{totalVotes} / {totalMembers} 已投票</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Progress value={(totalVotes / totalMembers) * 100} className="h-2" />

          <div className="space-y-3">
            {options.map((option) => {
              const voteCount = getVoteCountForOption(option.id);
              const voters = getVotersForOption(option.id);
              const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
              const isSelected = selectedOption === option.id;

              return (
                <Button
                  key={option.id}
                  variant={isSelected ? "default" : "outline"}
                  className={`w-full justify-between h-auto py-3 px-4 ${
                    hasVoted && !allowChangeVote ? "cursor-default" : ""
                  }`}
                  onClick={() => handleVote(option.id)}
                  disabled={hasVoted && !allowChangeVote}
                  data-testid={`button-vote-${option.id}`}
                >
                  <div className="flex items-center gap-3">
                    {isSelected && <Check className="w-4 h-4" />}
                    <div className="text-left">
                      <div className="font-medium">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {showVoters && voters.length > 0 && (
                      <div className="flex -space-x-2">
                        {voters.slice(0, 3).map((voter, idx) => (
                          <Avatar key={idx} className="w-6 h-6 border-2 border-background">
                            <AvatarImage src={voter.avatar} />
                            <AvatarFallback className="text-xs">
                              {voter.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {voters.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                            +{voters.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                    <Badge variant="secondary" className="min-w-[3rem] justify-center">
                      {voteCount} ({percentage}%)
                    </Badge>
                    {option.gotoPageId && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </Button>
              );
            })}
          </div>

          {hasVoted && (
            <div className="text-center text-sm text-muted-foreground pt-2">
              {allowChangeVote ? "你可以更改投票" : "等待其他隊友投票..."}
            </div>
          )}

          {votingType === "unanimous" && hasVoted && (
            <div className="text-center text-xs text-muted-foreground">
              需要所有人選擇相同選項才能通過
            </div>
          )}

          {votingType === "majority" && hasVoted && (
            <div className="text-center text-xs text-muted-foreground">
              需要超過半數同意才能通過
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
