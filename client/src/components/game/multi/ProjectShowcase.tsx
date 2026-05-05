import { Plus, ExternalLink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ProjectShowcaseConfig {
  title: string;
  prompt?: string;
  maxProjectsPerPerson: number;
  maxTitleLength: number;
  maxDescLength: number;
  allowVoteOwn: boolean;
  emojiReactions: string[];
  showVoteCount: boolean;
}

export interface ProjectVote {
  userId: string;
  emoji: string;
  votedAt: number;
}

export interface ShowcaseProject {
  id: string;
  submitterId: string;
  submitterName: string;
  title: string;
  description: string;
  link?: string;
  votes: ProjectVote[];
  submittedAt: number;
}

export interface ProjectShowcaseState extends Record<string, unknown> {
  projects: ShowcaseProject[];
}

interface Props {
  config: ProjectShowcaseConfig;
  state: ProjectShowcaseState;
  myUserId: string;
  draftTitle: string;
  draftDesc: string;
  draftLink: string;
  showForm: boolean;
  onTitleChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onLinkChange: (v: string) => void;
  onToggleForm: () => void;
  onSubmitProject: () => void;
  onVote: (projectId: string, emoji: string) => void;
}

export default function ProjectShowcase({
  config,
  state,
  myUserId,
  draftTitle,
  draftDesc,
  draftLink,
  showForm,
  onTitleChange,
  onDescChange,
  onLinkChange,
  onToggleForm,
  onSubmitProject,
  onVote,
}: Props) {
  const { title, prompt, maxProjectsPerPerson, maxTitleLength, maxDescLength, allowVoteOwn, emojiReactions, showVoteCount } = config;
  const { projects } = state;

  const myProjects = projects.filter((p) => p.submitterId === myUserId);
  const canSubmit = myProjects.length < maxProjectsPerPerson;
  const formValid = draftTitle.trim().length > 0 && draftDesc.trim().length > 0;

  const sortedProjects = [...projects].sort((a, b) => b.votes.length - a.votes.length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex flex-col px-4 py-6 gap-5" data-testid="ps-root">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="ps-title">{title}</h1>
        {prompt && <p className="text-gray-500 text-sm mt-1" data-testid="ps-prompt">{prompt}</p>}
        <p className="text-xs text-gray-400 mt-1">
          已提交 <span data-testid="ps-my-count">{myProjects.length}</span> / {maxProjectsPerPerson} 個專案
        </p>
      </div>

      {canSubmit ? (
        showForm ? (
          <div className="bg-white rounded-2xl shadow p-5" data-testid="ps-form">
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="專案名稱 *"
              maxLength={maxTitleLength}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              data-testid="ps-title-input"
            />
            <textarea
              value={draftDesc}
              onChange={(e) => onDescChange(e.target.value)}
              placeholder="專案描述 *"
              maxLength={maxDescLength}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              data-testid="ps-desc-input"
            />
            <input
              type="url"
              value={draftLink}
              onChange={(e) => onLinkChange(e.target.value)}
              placeholder="Demo 連結（選填）"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              data-testid="ps-link-input"
            />
            <div className="flex gap-2">
              <Button
                onClick={onSubmitProject}
                disabled={!formValid}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="ps-submit-btn"
              >
                提交專案
              </Button>
              <Button variant="outline" onClick={onToggleForm} data-testid="ps-cancel-btn">
                取消
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={onToggleForm}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="ps-add-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            提交我的專案
          </Button>
        )
      ) : (
        <div className="text-center text-sm text-gray-400" data-testid="ps-max-reached">
          已達提交上限
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-4" data-testid="ps-empty">
          還沒有人提交專案，第一個來吧！
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="ps-list">
          {sortedProjects.map((project, idx) => {
            const canVote = allowVoteOwn || project.submitterId !== myUserId;
            const topProject = idx === 0 && project.votes.length > 0;
            const totalVotes = project.votes.length;

            const emojiCounts: Record<string, number> = {};
            for (const v of project.votes) {
              emojiCounts[v.emoji] = (emojiCounts[v.emoji] ?? 0) + 1;
            }

            return (
              <div
                key={project.id}
                className={`bg-white rounded-2xl shadow-sm p-4 ${topProject ? "ring-2 ring-yellow-400" : ""}`}
                data-testid={`ps-project-${project.id}`}
              >
                {topProject && (
                  <div className="flex items-center gap-1 text-yellow-500 text-xs mb-2">
                    <Star className="w-3 h-3 fill-current" />
                    人氣最高
                  </div>
                )}
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-gray-800" data-testid={`ps-ptitle-${project.id}`}>
                    {project.title}
                  </h3>
                  {project.link && (
                    <a
                      href={project.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 ml-2"
                      data-testid={`ps-link-${project.id}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2" data-testid={`ps-desc-${project.id}`}>
                  {project.description}
                </p>
                <p className="text-xs text-gray-400 mb-3">by {project.submitterName}</p>

                <div className="flex items-center gap-2 flex-wrap">
                  {canVote &&
                    emojiReactions.map((em) => {
                      const count = emojiCounts[em] ?? 0;
                      return (
                        <button
                          key={em}
                          onClick={() => onVote(project.id, em)}
                          className="flex items-center gap-1 bg-gray-50 hover:bg-indigo-50 rounded-full px-2 py-1 text-sm transition-colors"
                          data-testid={`ps-vote-${project.id}-${em}`}
                        >
                          {em}
                          {showVoteCount && count > 0 && (
                            <span className="text-xs text-gray-500">{count}</span>
                          )}
                        </button>
                      );
                    })}
                  {showVoteCount && (
                    <span className="text-xs text-gray-400 ml-auto" data-testid={`ps-total-votes-${project.id}`}>
                      {totalVotes} 票
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
