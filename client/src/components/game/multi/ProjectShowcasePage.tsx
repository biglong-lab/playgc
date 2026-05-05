import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ProjectShowcase, {
  type ProjectShowcaseConfig,
  type ProjectShowcaseState,
  type ShowcaseProject,
  type ProjectVote,
} from "./ProjectShowcase";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface ProjectShowcasePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: ProjectShowcaseConfig = {
  title: "🚀 專案展示",
  prompt: "展示你的成果，讓大家投票！",
  maxProjectsPerPerson: 1,
  maxTitleLength: 30,
  maxDescLength: 150,
  allowVoteOwn: false,
  emojiReactions: ["🔥", "⭐", "💡", "👏", "🏆"],
  showVoteCount: true,
};

const DEFAULT_STATE: ProjectShowcaseState = { projects: [] };

export default function ProjectShowcasePage({ page, sessionId, gameId, pageId }: ProjectShowcasePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: ProjectShowcaseConfig } | ProjectShowcaseConfig | null) ?? null;
  const config: ProjectShowcaseConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as ProjectShowcaseConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ProjectShowcaseState>({
    gameId,
    sessionId,
    pageId,
    type: "project_showcase",
    defaultState: DEFAULT_STATE,
  });

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftLink, setDraftLink] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleSubmitProject = useCallback(async () => {
    if (!draftTitle.trim() || !draftDesc.trim()) return;
    const newProject: ShowcaseProject = {
      id: `${myUserId}-${Date.now()}`,
      submitterId: myUserId,
      submitterName: myUserName,
      title: draftTitle.trim(),
      description: draftDesc.trim(),
      link: draftLink.trim() || undefined,
      votes: [],
      submittedAt: Date.now(),
    };
    await updateState({ ...state, projects: [...state.projects, newProject] });
    setDraftTitle("");
    setDraftDesc("");
    setDraftLink("");
    setShowForm(false);
  }, [state, myUserId, myUserName, draftTitle, draftDesc, draftLink, updateState]);

  const handleVote = useCallback(
    async (projectId: string, emoji: string) => {
      const updated = state.projects.map((project: ShowcaseProject) => {
        if (project.id !== projectId) return project;
        const existingIdx = project.votes.findIndex(
          (v: ProjectVote) => v.userId === myUserId && v.emoji === emoji,
        );
        const newVotes =
          existingIdx >= 0
            ? project.votes.filter((_: ProjectVote, i: number) => i !== existingIdx)
            : [...project.votes, { userId: myUserId, emoji, votedAt: Date.now() }];
        return { ...project, votes: newVotes };
      });
      await updateState({ ...state, projects: updated });
    },
    [state, myUserId, updateState],
  );

  if (!isLoaded) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          <span>載入中…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <ProjectShowcase
      config={config}
      state={state}
      myUserId={myUserId}
      draftTitle={draftTitle}
      draftDesc={draftDesc}
      draftLink={draftLink}
      showForm={showForm}
      onTitleChange={setDraftTitle}
      onDescChange={setDraftDesc}
      onLinkChange={setDraftLink}
      onToggleForm={() => setShowForm((v) => !v)}
      onSubmitProject={handleSubmitProject}
      onVote={handleVote}
    />
  );
}
