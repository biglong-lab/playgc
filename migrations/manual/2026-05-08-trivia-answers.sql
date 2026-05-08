-- 🏆 Trivia Answers — TriviaShowdown server-side scoring（Phase 4 / 2026-05-08）
-- 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md §7
-- ADR-0018 規則 4：計分 → server-side source-of-truth

CREATE TABLE IF NOT EXISTS trivia_answers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  question_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  user_name VARCHAR(200) NOT NULL,
  choice INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  rank_at_correct INTEGER,
  score_awarded INTEGER NOT NULL DEFAULT 0,
  answered_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS trivia_session_q_user_unique
  ON trivia_answers (session_id, question_id, user_id);

CREATE INDEX IF NOT EXISTS trivia_session_idx ON trivia_answers (session_id);
CREATE INDEX IF NOT EXISTS trivia_session_q_idx ON trivia_answers (session_id, question_id);
