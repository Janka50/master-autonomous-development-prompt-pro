import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DBResult {
  changes?: number;
  lastInsertRowid?: number | bigint;
}

class DatabaseManager {
  private sqliteDb: Database.Database | null = null;
  private pgPool: pg.Pool | null = null;
  private isPostgres = false;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && dbUrl.startsWith('postgres')) {
      console.log('Connecting to PostgreSQL database...');
      this.pgPool = new pg.Pool({
        connectionString: dbUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      this.isPostgres = true;
    } else {
      const dataDir = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const dbPath = path.join(dataDir, 'westvoice.db');
      console.log(`Connecting to SQLite database at: ${dbPath}`);
      this.sqliteDb = new Database(dbPath);
      this.sqliteDb.pragma('journal_mode = WAL');
      this.sqliteDb.pragma('foreign_keys = ON');
    }
  }

  public async init() {
    if (this.isPostgres && this.pgPool) {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await this.pgPool.query(sql);
      console.log('PostgreSQL schema initialized successfully.');
    } else if (this.sqliteDb) {
      // Execute SQLite schema
      this.initSqliteSchema();
      console.log('SQLite schema initialized successfully.');
    }
  }

  private initSqliteSchema() {
    if (!this.sqliteDb) return;

    this.sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS languages (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        alt_names TEXT,
        family TEXT,
        regions TEXT,
        transcription_status TEXT NOT NULL DEFAULT 'beta',
        translation_status TEXT NOT NULL DEFAULT 'beta',
        detection_status TEXT NOT NULL DEFAULT 'experimental',
        verification_status TEXT NOT NULL DEFAULT 'verified',
        is_active INTEGER NOT NULL DEFAULT 1,
        resource_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dialects (
        id TEXT PRIMARY KEY,
        language_id TEXT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        region TEXT,
        notes TEXT,
        is_standard INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        role TEXT NOT NULL DEFAULT 'contributor',
        languages TEXT DEFAULT '[]',
        dialects TEXT DEFAULT '[]',
        bio TEXT,
        points INTEGER NOT NULL DEFAULT 0,
        submitted_count INTEGER NOT NULL DEFAULT 0,
        approved_count INTEGER NOT NULL DEFAULT 0,
        validation_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_badges (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        awarded_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS community_words (
        id TEXT PRIMARY KEY,
        word TEXT NOT NULL,
        language_id TEXT NOT NULL REFERENCES languages(id),
        dialect_id TEXT REFERENCES dialects(id),
        category TEXT NOT NULL DEFAULT 'word',
        meaning_en TEXT NOT NULL,
        meaning_fr TEXT,
        example_sentence TEXT,
        example_sentence_translation TEXT,
        context_usage TEXT,
        alternative_spellings TEXT,
        contributor_notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        submitted_by TEXT NOT NULL REFERENCES users(id),
        approved_by TEXT REFERENCES users(id),
        moderator_notes TEXT,
        upvotes INTEGER DEFAULT 0,
        downvotes INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pronunciation_recordings (
        id TEXT PRIMARY KEY,
        word_id TEXT NOT NULL REFERENCES community_words(id) ON DELETE CASCADE,
        audio_url TEXT NOT NULL,
        audio_duration REAL DEFAULT 0,
        phonetic_guide TEXT,
        dialect_id TEXT REFERENCES dialects(id),
        accent_region TEXT,
        speaker_context TEXT,
        recorded_by TEXT NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'approved',
        upvotes INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS community_phrases (
        id TEXT PRIMARY KEY,
        phrase TEXT NOT NULL,
        language_id TEXT NOT NULL REFERENCES languages(id),
        dialect_id TEXT REFERENCES dialects(id),
        meaning_en TEXT NOT NULL,
        meaning_fr TEXT,
        context TEXT,
        literal_meaning TEXT,
        submitted_by TEXT NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'approved',
        upvotes INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contribution_reviews (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        reviewer_id TEXT NOT NULL REFERENCES users(id),
        action TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS community_votes (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        vote_type TEXT NOT NULL,
        comment TEXT,
        suggested_correction TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(item_type, item_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS transcription_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        audio_filename TEXT,
        audio_duration REAL,
        source_language TEXT,
        detected_language TEXT,
        confidence REAL,
        original_transcription TEXT NOT NULL,
        user_edited_transcription TEXT,
        speaker_segments TEXT,
        timestamps TEXT,
        status TEXT DEFAULT 'completed',
        model_used TEXT,
        context_hints_used TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS translation_sessions (
        id TEXT PRIMARY KEY,
        transcription_session_id TEXT REFERENCES transcription_sessions(id),
        user_id TEXT REFERENCES users(id),
        source_language TEXT NOT NULL,
        target_language TEXT NOT NULL,
        source_text TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        community_context_injected TEXT,
        model_used TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS translation_feedback (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        feedback_type TEXT NOT NULL,
        source_language TEXT,
        target_language TEXT,
        category TEXT NOT NULL,
        user_comment TEXT,
        suggested_correction TEXT,
        user_id TEXT REFERENCES users(id),
        status TEXT DEFAULT 'open',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS entry_version_history (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        entry_type TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        snapshot_data TEXT NOT NULL,
        changed_by TEXT REFERENCES users(id),
        change_reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Unified Query Helper for all SELECT queries
  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.isPostgres && this.pgPool) {
      let pgSql = sql;
      let pIdx = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${pIdx++}`);
      const res = await this.pgPool.query(pgSql, params);
      return res.rows as T[];
    } else if (this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(sql);
      return stmt.all(...params) as T[];
    }
    return [];
  }

  // Unified Get Helper for single-row queries
  public async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (this.isPostgres && this.pgPool) {
      let pgSql = sql;
      let pIdx = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${pIdx++}`);
      const res = await this.pgPool.query(pgSql, params);
      return (res.rows[0] as T) || null;
    } else if (this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(sql);
      return (stmt.get(...params) as T) || null;
    }
    return null;
  }

  // Unified Run Helper for INSERT / UPDATE / DELETE
  public async run(sql: string, params: any[] = []): Promise<DBResult> {
    if (this.isPostgres && this.pgPool) {
      let pgSql = sql;
      let pIdx = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${pIdx++}`);
      const res = await this.pgPool.query(pgSql, params);
      return { changes: res.rowCount || 0 };
    } else if (this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(sql);
      const res = stmt.run(...params);
      return { changes: res.changes, lastInsertRowid: res.lastInsertRowid };
    }
    return { changes: 0 };
  }
}

export const db = new DatabaseManager();
