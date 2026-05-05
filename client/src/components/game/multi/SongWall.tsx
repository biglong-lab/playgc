import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SongEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  songTitle: string;
  artist: string;
  note: string;
}

export interface SongWallConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
  songPlaceholder: string;
  artistPlaceholder: string;
}

export interface SongWallState extends Record<string, unknown> {
  entries: SongEntry[];
  revealed: boolean;
}

interface SongWallProps {
  config: SongWallConfig;
  state: SongWallState;
  myUserId: string;
  onSubmit: (songTitle: string, artist: string, note: string) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: SongWallConfig = {
  title: "🎵 歌曲牆",
  prompt: "選一首代表你現在心情的歌",
  maxLength: 50,
  songPlaceholder: "歌曲名稱",
  artistPlaceholder: "歌手 / 樂團",
};

function extractConfig(raw: unknown): SongWallConfig {
  const r = raw as Record<string, unknown>;
  if (r && "songPlaceholder" in r) return r as unknown as SongWallConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("songPlaceholder" in c) return c as unknown as SongWallConfig;
  }
  return DEFAULT_CONFIG;
}

export default function SongWall({ config: rawConfig, state, myUserId, onSubmit, onReveal }: SongWallProps) {
  const config = extractConfig(rawConfig as unknown);
  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [note, setNote] = useState("");

  const myEntry = state.entries.find((e) => e.userId === myUserId);
  const canSubmit = songTitle.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(songTitle.trim(), artist.trim(), note.trim());
  }

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="sw-result">
        <h2 className="text-xl font-bold" data-testid="sw-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="sw-count">共 {state.entries.length} 首歌</p>
        {state.entries.length === 0 ? (
          <p className="text-muted-foreground" data-testid="sw-empty">還沒有人分享歌曲</p>
        ) : (
          <div className="space-y-3">
            {state.entries.map((entry) => (
              <div key={entry.entryId} className="p-3 border rounded-lg bg-purple-50/40" data-testid={`sw-entry-${entry.entryId}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">🎵 {entry.songTitle}</p>
                    {entry.artist && <p className="text-xs text-muted-foreground">{entry.artist}</p>}
                    {entry.note && <p className="text-xs mt-1 italic">{entry.note}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground ml-2">{entry.userName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="sw-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="sw-prompt">{config.prompt}</p>
      <p className="text-xs text-muted-foreground" data-testid="sw-count">已分享：{state.entries.length} 首</p>

      {myEntry ? (
        <div className="p-3 border rounded bg-purple-50/30" data-testid="sw-my-entry">
          <p className="text-sm font-medium mb-1">🎵 你已分享</p>
          <p className="text-xs text-muted-foreground">{myEntry.songTitle}{myEntry.artist ? ` — ${myEntry.artist}` : ""}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            placeholder={config.songPlaceholder}
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            maxLength={config.maxLength}
            data-testid="sw-song-input"
          />
          <Input
            placeholder={config.artistPlaceholder}
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            maxLength={config.maxLength}
            data-testid="sw-artist-input"
          />
          <Input
            placeholder="為什麼選這首？（可選）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={config.maxLength}
            data-testid="sw-note-input"
          />
          <Button disabled={!canSubmit} onClick={handleSubmit} data-testid="sw-submit-btn">
            分享歌曲
          </Button>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="sw-reveal-btn">
        公布歌曲牆
      </Button>
    </div>
  );
}
