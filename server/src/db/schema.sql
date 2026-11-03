-- WestVoice AI PostgreSQL Schema
-- AI-powered West African Multilingual Voice Recognition & Language Preservation

-- 1. Languages Registry
CREATE TABLE IF NOT EXISTS languages (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  alt_names TEXT,
  family VARCHAR(64),
  regions TEXT,
  transcription_status VARCHAR(32) NOT NULL DEFAULT 'beta', -- 'verified', 'beta', 'experimental', 'community_supported'
  translation_status VARCHAR(32) NOT NULL DEFAULT 'beta', -- 'verified', 'beta', 'experimental', 'community_supported'
  detection_status VARCHAR(32) NOT NULL DEFAULT 'experimental', -- 'supported', 'experimental', 'planned'
  verification_status VARCHAR(32) NOT NULL DEFAULT 'verified',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  resource_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_languages_code ON languages(code);
CREATE INDEX IF NOT EXISTS idx_languages_active ON languages(is_active);

-- 2. Dialects
CREATE TABLE IF NOT EXISTS dialects (
  id VARCHAR(64) PRIMARY KEY,
  language_id VARCHAR(64) NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  region VARCHAR(128),
  notes TEXT,
  is_standard BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dialects_lang ON dialects(language_id);

-- 3. Users & Contributors
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(128),
  avatar_url TEXT,
  role VARCHAR(32) NOT NULL DEFAULT 'contributor', -- 'guest', 'contributor', 'moderator', 'admin'
  languages TEXT DEFAULT '[]', -- JSON string of ISO codes
  dialects TEXT DEFAULT '[]', -- JSON string of dialect IDs
  bio TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  submitted_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  validation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_points ON users(points DESC);

-- 4. User Badges
CREATE TABLE IF NOT EXISTS user_badges (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type VARCHAR(64) NOT NULL,
  title VARCHAR(128) NOT NULL,
  description TEXT,
  icon VARCHAR(64),
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- 5. Community Words
CREATE TABLE IF NOT EXISTS community_words (
  id VARCHAR(64) PRIMARY KEY,
  word VARCHAR(255) NOT NULL,
  language_id VARCHAR(64) NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
  dialect_id VARCHAR(64) REFERENCES dialects(id) ON DELETE SET NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'word', -- 'word', 'slang', 'idiom', 'proverb', 'traditional', 'dialect_specific'
  meaning_en TEXT NOT NULL,
  meaning_fr TEXT,
  example_sentence TEXT,
  example_sentence_translation TEXT,
  context_usage TEXT,
  alternative_spellings TEXT,
  contributor_notes TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'under_review', 'approved', 'rejected', 'needs_correction'
  submitted_by VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  moderator_notes TEXT,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_community_words_lang ON community_words(language_id);
CREATE INDEX IF NOT EXISTS idx_community_words_status ON community_words(status);
CREATE INDEX IF NOT EXISTS idx_community_words_word ON community_words(word);

-- 6. Pronunciation Recordings
CREATE TABLE IF NOT EXISTS pronunciation_recordings (
  id VARCHAR(64) PRIMARY KEY,
  word_id VARCHAR(64) NOT NULL REFERENCES community_words(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  audio_duration REAL DEFAULT 0,
  phonetic_guide VARCHAR(255),
  dialect_id VARCHAR(64) REFERENCES dialects(id) ON DELETE SET NULL,
  accent_region VARCHAR(128),
  speaker_context TEXT,
  recorded_by VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'approved', -- 'pending', 'approved', 'rejected'
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pronunciations_word ON pronunciation_recordings(word_id);

-- 7. Community Phrases
CREATE TABLE IF NOT EXISTS community_phrases (
  id VARCHAR(64) PRIMARY KEY,
  phrase TEXT NOT NULL,
  language_id VARCHAR(64) NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
  dialect_id VARCHAR(64) REFERENCES dialects(id) ON DELETE SET NULL,
  meaning_en TEXT NOT NULL,
  meaning_fr TEXT,
  context TEXT,
  literal_meaning TEXT,
  submitted_by VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'approved',
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phrases_lang ON community_phrases(language_id);

-- 8. Contribution Reviews
CREATE TABLE IF NOT EXISTS contribution_reviews (
  id VARCHAR(64) PRIMARY KEY,
  item_type VARCHAR(32) NOT NULL, -- 'word', 'phrase', 'pronunciation'
  item_id VARCHAR(64) NOT NULL,
  reviewer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(32) NOT NULL, -- 'approved', 'rejected', 'requested_correction'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Community Votes & Disputes
CREATE TABLE IF NOT EXISTS community_votes (
  id VARCHAR(64) PRIMARY KEY,
  item_type VARCHAR(32) NOT NULL, -- 'word', 'phrase', 'pronunciation'
  item_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type VARCHAR(32) NOT NULL, -- 'up', 'down', 'dispute', 'verify'
  comment TEXT,
  suggested_correction TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(item_type, item_id, user_id)
);

-- 10. Transcription Sessions
CREATE TABLE IF NOT EXISTS transcription_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  audio_filename VARCHAR(255),
  audio_duration REAL,
  source_language VARCHAR(32),
  detected_language VARCHAR(32),
  confidence REAL,
  original_transcription TEXT NOT NULL,
  user_edited_transcription TEXT,
  speaker_segments TEXT, -- JSON
  timestamps TEXT, -- JSON
  status VARCHAR(32) DEFAULT 'completed',
  model_used VARCHAR(64),
  context_hints_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Translation Sessions
CREATE TABLE IF NOT EXISTS translation_sessions (
  id VARCHAR(64) PRIMARY KEY,
  transcription_session_id VARCHAR(64) REFERENCES transcription_sessions(id) ON DELETE SET NULL,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  source_language VARCHAR(32) NOT NULL,
  target_language VARCHAR(32) NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  community_context_injected TEXT, -- JSON
  model_used VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Translation & Transcription Quality Feedback
CREATE TABLE IF NOT EXISTS translation_feedback (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64),
  feedback_type VARCHAR(32) NOT NULL, -- 'transcription', 'translation', 'detection'
  source_language VARCHAR(32),
  target_language VARCHAR(32),
  category VARCHAR(64) NOT NULL,
  user_comment TEXT,
  suggested_correction TEXT,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(32) DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Entry Version History (Preserving knowledge integrity)
CREATE TABLE IF NOT EXISTS entry_version_history (
  id VARCHAR(64) PRIMARY KEY,
  entry_id VARCHAR(64) NOT NULL,
  entry_type VARCHAR(32) NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot_data TEXT NOT NULL, -- JSON
  changed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
