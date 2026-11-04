import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db/db.js';
import { seedDatabase } from './db/seed.js';
import { GeminiService } from './services/geminiService.js';
import { LanguageKnowledgeService } from './services/languageKnowledgeService.js';
import { AudioService, uploadTempAudio, uploadPronunciationAudio } from './services/audioService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'westvoice_jwt_secret_key_2026';
const PORT = process.env.PORT || 3001;

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static serving for uploaded pronunciations & media
const publicDir = path.resolve(process.cwd(), 'public');
const uploadDir = path.resolve(publicDir, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Auth Middleware & Helpers
interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Guest user
    req.user = undefined;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      req.user = undefined;
    } else {
      req.user = decoded;
    }
    next();
  });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires one of roles: ${roles.join(', ')}` });
    }
    next();
  };
}

app.use(authenticateToken);

// ==========================================
// 1. AUTHENTICATION & USERS
// ==========================================

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, fullName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing) {
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `usr-${uuidv4()}`;

    await db.run(
      `INSERT INTO users (id, email, username, password_hash, full_name, role, points) 
       VALUES (?, ?, ?, ?, ?, 'contributor', 20)`,
      [userId, email, username, hashedPassword, fullName || username]
    );

    // Initial badge
    await db.run(
      `INSERT INTO user_badges (id, user_id, badge_type, title, description, icon) 
       VALUES (?, ?, 'welcome', 'Pioneer Voice', 'Joined the WestVoice language preservation movement', 'Sparkles')`,
      [`bdg-${uuidv4()}`, userId]
    );

    const token = jwt.sign({ id: userId, email, username, role: 'contributor' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      token,
      user: { id: userId, email, username, fullName: fullName || username, role: 'contributor', points: 20 }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await db.get<any>('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        points: user.points,
        avatarUrl: user.avatar_url
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.json({ user: null });
    }

    const user = await db.get<any>(
      'SELECT id, email, username, full_name, avatar_url, role, bio, points, submitted_count, approved_count, validation_count, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const badges = await db.query('SELECT * FROM user_badges WHERE user_id = ? ORDER BY awarded_at DESC', [user.id]);
    return res.json({ user: { ...user, badges } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Quick demo login list for testing role switcher
app.get('/api/auth/demo-users', async (req: Request, res: Response) => {
  try {
    const users = await db.query(
      'SELECT id, email, username, full_name, role, points FROM users ORDER BY role DESC'
    );
    const demoList = users.map(u => ({
      ...u,
      token: jwt.sign({ id: u.id, email: u.email, username: u.username, role: u.role }, JWT_SECRET, { expiresIn: '7d' })
    }));
    return res.json(demoList);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. LANGUAGES & DIALECTS
// ==========================================

app.get('/api/languages', async (req: Request, res: Response) => {
  try {
    const languages = await db.query<any>('SELECT * FROM languages ORDER BY name ASC');
    const dialects = await db.query<any>('SELECT * FROM dialects ORDER BY name ASC');

    const mapped = languages.map(lang => ({
      ...lang,
      dialects: dialects.filter(d => d.language_id === lang.id)
    }));

    return res.json(mapped);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/languages/:id/dialects', async (req: Request, res: Response) => {
  try {
    const dialects = await db.query('SELECT * FROM dialects WHERE language_id = ? ORDER BY name ASC', [req.params.id]);
    return res.json(dialects);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/languages', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { code, name, alt_names, family, regions, transcription_status, translation_status, detection_status } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Language code and name are required' });
    }

    const id = `lang-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    await db.run(
      `INSERT INTO languages (id, code, name, alt_names, family, regions, transcription_status, translation_status, detection_status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        code.toLowerCase(),
        name,
        alt_names || null,
        family || null,
        regions || null,
        transcription_status || 'beta',
        translation_status || 'beta',
        detection_status || 'experimental'
      ]
    );

    return res.status(201).json({ message: 'Language created successfully', id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/languages/:id', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { name, alt_names, regions, transcription_status, translation_status, detection_status, is_active } = req.body;
    await db.run(
      `UPDATE languages 
       SET name = COALESCE(?, name),
           alt_names = COALESCE(?, alt_names),
           regions = COALESCE(?, regions),
           transcription_status = COALESCE(?, transcription_status),
           translation_status = COALESCE(?, translation_status),
           detection_status = COALESCE(?, detection_status),
           is_active = COALESCE(?, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, alt_names, regions, transcription_status, translation_status, detection_status, is_active, req.params.id]
    );
    return res.json({ message: 'Language updated' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. VOICE TRANSCRIPTION
// ==========================================

app.post('/api/transcribe', uploadTempAudio.single('audio'), async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;
  try {
    let audioBuffer: Buffer;
    let mimeType = 'audio/webm';
    let duration = Number(req.body.duration) || 5;
    const sourceLanguage = req.body.sourceLanguage || 'auto';
    const dialectId = req.body.dialectId || undefined;

    if (req.file) {
      tempFilePath = req.file.path;
      mimeType = req.file.mimetype;
      audioBuffer = fs.readFileSync(tempFilePath);
    } else if (req.body.audioBase64) {
      audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
      if (req.body.mimeType) mimeType = req.body.mimeType;
    } else {
      return res.status(400).json({ error: 'No audio file or audioBase64 payload provided' });
    }

    const transcription = await GeminiService.transcribeAudio(
      audioBuffer,
      mimeType,
      sourceLanguage,
      dialectId,
      duration
    );

    // Save session in db
    const sessionId = `trx-${uuidv4()}`;
    const userId = req.user?.id || null;

    await db.run(
      `INSERT INTO transcription_sessions 
       (id, user_id, audio_duration, source_language, detected_language, confidence, original_transcription, user_edited_transcription, speaker_segments, timestamps, model_used, context_hints_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        userId,
        duration,
        sourceLanguage,
        transcription.detectedLanguage,
        transcription.confidence,
        transcription.originalTranscription,
        transcription.originalTranscription,
        JSON.stringify(transcription.speakerSegments),
        JSON.stringify(transcription.timestamps || []),
        transcription.modelUsed,
        JSON.stringify(transcription.contextHintsUsed)
      ]
    );

    return res.json({
      id: sessionId,
      ...transcription
    });
  } catch (err: any) {
    console.error('Error in /api/transcribe:', err);
    return res.status(500).json({ error: err.message || 'Audio transcription failed' });
  } finally {
    // Audio privacy: delete temporary processing audio immediately
    if (tempFilePath) {
      AudioService.cleanupTempFile(tempFilePath);
    }
  }
});

app.put('/api/transcribe/:id', async (req: Request, res: Response) => {
  try {
    const { userEditedTranscription } = req.body;
    if (!userEditedTranscription) {
      return res.status(400).json({ error: 'userEditedTranscription is required' });
    }

    await db.run(
      'UPDATE transcription_sessions SET user_edited_transcription = ? WHERE id = ?',
      [userEditedTranscription, req.params.id]
    );

    return res.json({ message: 'Transcription updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/transcribe/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    let sql = 'SELECT * FROM transcription_sessions ';
    const params: any[] = [];
    if (userId) {
      sql += 'WHERE user_id = ? ';
      params.push(userId);
    }
    sql += 'ORDER BY created_at DESC LIMIT 20';
    const history = await db.query(sql, params);
    return res.json(history);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. TRANSLATION
// ==========================================

app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { text, sourceLanguage, targetLanguage, transcriptionSessionId } = req.body;
    if (!text || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({ error: 'Text, sourceLanguage and targetLanguage are required' });
    }

    const translation = await GeminiService.translateText(text, sourceLanguage, targetLanguage);
    const sessionId = `trn-${uuidv4()}`;
    const userId = req.user?.id || null;

    await db.run(
      `INSERT INTO translation_sessions 
       (id, transcription_session_id, user_id, source_language, target_language, source_text, translated_text, community_context_injected, model_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        transcriptionSessionId || null,
        userId,
        sourceLanguage,
        targetLanguage,
        text,
        translation.translatedText,
        JSON.stringify(translation.injectedCommunityTerms),
        translation.modelUsed
      ]
    );

    return res.json({
      id: sessionId,
      ...translation
    });
  } catch (err: any) {
    console.error('Error in /api/translate:', err);
    return res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

app.get('/api/translate/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    let sql = 'SELECT * FROM translation_sessions ';
    const params: any[] = [];
    if (userId) {
      sql += 'WHERE user_id = ? ';
      params.push(userId);
    }
    sql += 'ORDER BY created_at DESC LIMIT 20';
    const history = await db.query(sql, params);
    return res.json(history);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. COMMUNITY LANGUAGE LAB
// ==========================================

app.get('/api/community/words', async (req: Request, res: Response) => {
  try {
    const { languageId, dialectId, status, category, search, limit = 50, page = 1 } = req.query;
    let sql = `
      SELECT cw.*, l.name as language_name, l.code as language_code, 
             d.name as dialect_name, u.username as contributor_username, u.avatar_url as contributor_avatar,
             (SELECT count(*) FROM pronunciation_recordings pr WHERE pr.word_id = cw.id) as pronunciation_count
      FROM community_words cw
      JOIN languages l ON cw.language_id = l.id
      LEFT JOIN dialects d ON cw.dialect_id = d.id
      LEFT JOIN users u ON cw.submitted_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (languageId && languageId !== 'all') {
      sql += ' AND cw.language_id = ?';
      params.push(languageId);
    }
    if (dialectId && dialectId !== 'all') {
      sql += ' AND cw.dialect_id = ?';
      params.push(dialectId);
    }
    if (status && status !== 'all') {
      sql += ' AND cw.status = ?';
      params.push(status);
    }
    if (category && category !== 'all') {
      sql += ' AND cw.category = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND (cw.word LIKE ? OR cw.meaning_en LIKE ? OR cw.meaning_fr LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY cw.created_at DESC LIMIT ? OFFSET ?';
    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit), offset);

    const words = await db.query(sql, params);
    return res.json(words);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/community/words', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      word,
      languageId,
      dialectId,
      category = 'word',
      meaningEn,
      meaningFr,
      exampleSentence,
      exampleSentenceTranslation,
      contextUsage,
      alternativeSpellings,
      contributorNotes
    } = req.body;

    if (!word || !languageId || !meaningEn) {
      return res.status(400).json({ error: 'Word, language and English meaning are required' });
    }

    // Check for exact duplicate in same language
    const duplicate = await db.get(
      'SELECT id FROM community_words WHERE LOWER(word) = LOWER(?) AND language_id = ?',
      [word.trim(), languageId]
    );
    if (duplicate) {
      return res.status(409).json({ error: 'This word has already been contributed for this language' });
    }

    const wordId = `word-${uuidv4()}`;
    const userId = req.user!.id;
    // Moderators/Admins automatically approve
    const initialStatus = ['admin', 'moderator'].includes(req.user!.role) ? 'approved' : 'pending';

    await db.run(
      `INSERT INTO community_words 
       (id, word, language_id, dialect_id, category, meaning_en, meaning_fr, example_sentence, example_sentence_translation, context_usage, alternative_spellings, contributor_notes, status, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wordId,
        word.trim(),
        languageId,
        dialectId || null,
        category,
        meaningEn.trim(),
        meaningFr?.trim() || null,
        exampleSentence?.trim() || null,
        exampleSentenceTranslation?.trim() || null,
        contextUsage?.trim() || null,
        alternativeSpellings?.trim() || null,
        contributorNotes?.trim() || null,
        initialStatus,
        userId
      ]
    );

    // Award contributor points
    await db.run('UPDATE users SET points = points + 10, submitted_count = submitted_count + 1 WHERE id = ?', [userId]);

    return res.status(201).json({
      message: initialStatus === 'approved' ? 'Word published successfully' : 'Word submitted for community review',
      id: wordId,
      status: initialStatus
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Pronunciation Upload for a word
app.post('/api/community/words/:id/pronounce', requireAuth, uploadPronunciationAudio.single('audio'), async (req: Request, res: Response) => {
  try {
    const wordId = req.params.id;
    const word = await db.get('SELECT id FROM community_words WHERE id = ?', [wordId]);
    if (!word) {
      return res.status(404).json({ error: 'Word not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file required' });
    }

    const audioUrl = `/uploads/audio/${path.basename(req.file.path)}`;
    const { phoneticGuide, dialectId, accentRegion, speakerContext, audioDuration = 2 } = req.body;
    const pronunciationId = `pron-${uuidv4()}`;
    const userId = req.user!.id;

    await db.run(
      `INSERT INTO pronunciation_recordings
       (id, word_id, audio_url, audio_duration, phonetic_guide, dialect_id, accent_region, speaker_context, recorded_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
      [
        pronunciationId,
        wordId,
        audioUrl,
        Number(audioDuration),
        phoneticGuide || null,
        dialectId || null,
        accentRegion || null,
        speakerContext || null,
        userId
      ]
    );

    // Award points
    await db.run('UPDATE users SET points = points + 15 WHERE id = ?', [userId]);

    return res.status(201).json({
      message: 'Pronunciation recording added successfully',
      id: pronunciationId,
      audioUrl
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/community/words/:id/pronunciations', async (req: Request, res: Response) => {
  try {
    const recordings = await db.query<any>(
      `SELECT pr.*, u.username as speaker_username, d.name as dialect_name
       FROM pronunciation_recordings pr
       LEFT JOIN users u ON pr.recorded_by = u.id
       LEFT JOIN dialects d ON pr.dialect_id = d.id
       WHERE pr.word_id = ?
       ORDER BY pr.upvotes DESC, pr.created_at DESC`,
      [req.params.id]
    );
    return res.json(recordings);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Community Phrases
app.get('/api/community/phrases', async (req: Request, res: Response) => {
  try {
    const { languageId, status = 'approved' } = req.query;
    let sql = `
      SELECT cp.*, l.name as language_name, d.name as dialect_name, u.username as contributor_username
      FROM community_phrases cp
      JOIN languages l ON cp.language_id = l.id
      LEFT JOIN dialects d ON cp.dialect_id = d.id
      LEFT JOIN users u ON cp.submitted_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (languageId && languageId !== 'all') {
      sql += ' AND cp.language_id = ?';
      params.push(languageId);
    }
    if (status && status !== 'all') {
      sql += ' AND cp.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY cp.upvotes DESC, cp.created_at DESC LIMIT 50';

    const phrases = await db.query(sql, params);
    return res.json(phrases);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/community/phrases', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phrase, languageId, dialectId, meaningEn, meaningFr, context, literalMeaning } = req.body;
    if (!phrase || !languageId || !meaningEn) {
      return res.status(400).json({ error: 'Phrase, language and meaningEn are required' });
    }

    const phraseId = `phrase-${uuidv4()}`;
    const userId = req.user!.id;
    const initialStatus = ['admin', 'moderator'].includes(req.user!.role) ? 'approved' : 'pending';

    await db.run(
      `INSERT INTO community_phrases (id, phrase, language_id, dialect_id, meaning_en, meaning_fr, context, literal_meaning, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [phraseId, phrase.trim(), languageId, dialectId || null, meaningEn.trim(), meaningFr || null, context || null, literalMeaning || null, userId, initialStatus]
    );

    await db.run('UPDATE users SET points = points + 12 WHERE id = ?', [userId]);

    return res.status(201).json({ id: phraseId, status: initialStatus });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Community Votes (Upvote / Downvote / Dispute)
app.post('/api/community/vote', requireAuth, async (req: Request, res: Response) => {
  try {
    const { itemType, itemId, voteType, comment, suggestedCorrection } = req.body;
    if (!itemType || !itemId || !voteType) {
      return res.status(400).json({ error: 'itemType, itemId and voteType are required' });
    }

    const userId = req.user!.id;
    const voteId = `vote-${uuidv4()}`;

    // Record vote
    await db.run(
      `INSERT INTO community_votes (id, item_type, item_id, user_id, vote_type, comment, suggested_correction)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [voteId, itemType, itemId, userId, voteType, comment || null, suggestedCorrection || null]
    );

    // Update target counter
    const delta = voteType === 'up' ? 1 : voteType === 'down' ? -1 : 0;
    if (itemType === 'word') {
      if (delta > 0) {
        await db.run('UPDATE community_words SET upvotes = upvotes + 1 WHERE id = ?', [itemId]);
      } else if (delta < 0) {
        await db.run('UPDATE community_words SET downvotes = downvotes + 1 WHERE id = ?', [itemId]);
      }
    } else if (itemType === 'phrase' && delta > 0) {
      await db.run('UPDATE community_phrases SET upvotes = upvotes + 1 WHERE id = ?', [itemId]);
    } else if (itemType === 'pronunciation' && delta > 0) {
      await db.run('UPDATE pronunciation_recordings SET upvotes = upvotes + 1 WHERE id = ?', [itemId]);
    }

    // Award voter point
    await db.run('UPDATE users SET points = points + 2, validation_count = validation_count + 1 WHERE id = ?', [userId]);

    return res.json({ message: 'Vote registered successfully' });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'You have already voted on this item' });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Moderation Action (Approve / Reject / Correction)
app.post('/api/community/review', requireAuth, requireRole(['admin', 'moderator']), async (req: Request, res: Response) => {
  try {
    const { itemType, itemId, action, notes } = req.body;
    if (!itemType || !itemId || !action) {
      return res.status(400).json({ error: 'itemType, itemId and action are required' });
    }

    const reviewerId = req.user!.id;

    if (itemType === 'word') {
      const word = await db.get<any>('SELECT * FROM community_words WHERE id = ?', [itemId]);
      if (!word) return res.status(404).json({ error: 'Word not found' });

      // Save version history snapshot
      await db.run(
        `INSERT INTO entry_version_history (id, entry_id, entry_type, version_number, snapshot_data, changed_by, change_reason)
         VALUES (?, ?, 'word', ?, ?, ?, ?)`,
        [`ver-${uuidv4()}`, itemId, word.version || 1, JSON.stringify(word), reviewerId, notes || `Action: ${action}`]
      );

      await db.run(
        `UPDATE community_words 
         SET status = ?, approved_by = ?, moderator_notes = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [action, reviewerId, notes || null, itemId]
      );

      // Reward original submitter if approved
      if (action === 'approved') {
        await db.run('UPDATE users SET points = points + 25, approved_count = approved_count + 1 WHERE id = ?', [word.submitted_by]);
      }
    } else if (itemType === 'phrase') {
      await db.run('UPDATE community_phrases SET status = ? WHERE id = ?', [action, itemId]);
    }

    // Log review
    await db.run(
      `INSERT INTO contribution_reviews (id, item_type, item_id, reviewer_id, action, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`rev-${uuidv4()}`, itemType, itemId, reviewerId, action, notes || null]
    );

    return res.json({ message: `Item successfully marked as ${action}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Community Leaderboard
app.get('/api/community/leaderboard', async (req: Request, res: Response) => {
  try {
    const leaders = await db.query<any>(
      `SELECT id, username, full_name, avatar_url, role, points, submitted_count, approved_count, validation_count
       FROM users 
       ORDER BY points DESC, approved_count DESC 
       LIMIT 20`
    );

    // Fetch badges for top leaders
    for (const leader of leaders) {
      leader.badges = await db.query('SELECT title, icon FROM user_badges WHERE user_id = ?', [leader.id]);
    }

    return res.json(leaders);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Community Statistics
app.get('/api/community/stats', async (req: Request, res: Response) => {
  try {
    const totalWords = await db.get<{ count: number }>('SELECT count(*) as count FROM community_words');
    const verifiedWords = await db.get<{ count: number }>('SELECT count(*) as count FROM community_words WHERE status = \'approved\'');
    const pendingWords = await db.get<{ count: number }>('SELECT count(*) as count FROM community_words WHERE status = \'pending\'');
    const pronunciations = await db.get<{ count: number }>('SELECT count(*) as count FROM pronunciation_recordings');
    const totalPhrases = await db.get<{ count: number }>('SELECT count(*) as count FROM community_phrases WHERE status = \'approved\'');
    const totalContributors = await db.get<{ count: number }>('SELECT count(*) as count FROM users');
    const totalLanguages = await db.get<{ count: number }>('SELECT count(*) as count FROM languages WHERE is_active = 1');

    return res.json({
      totalWords: totalWords?.count || 0,
      verifiedWords: verifiedWords?.count || 0,
      pendingWords: pendingWords?.count || 0,
      pronunciations: pronunciations?.count || 0,
      totalPhrases: totalPhrases?.count || 0,
      totalContributors: totalContributors?.count || 0,
      totalLanguages: totalLanguages?.count || 0
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. SEARCHABLE DICTIONARY
// ==========================================

app.get('/api/dictionary/search', async (req: Request, res: Response) => {
  try {
    const { q = '', languageId, dialectId, category, sort = 'popular', page = 1, limit = 20 } = req.query;

    let sql = `
      SELECT cw.*, l.name as language_name, l.code as language_code, d.name as dialect_name,
             (SELECT count(*) FROM pronunciation_recordings pr WHERE pr.word_id = cw.id) as pronunciation_count,
             (SELECT audio_url FROM pronunciation_recordings pr WHERE pr.word_id = cw.id ORDER BY pr.upvotes DESC LIMIT 1) as sample_audio_url
      FROM community_words cw
      JOIN languages l ON cw.language_id = l.id
      LEFT JOIN dialects d ON cw.dialect_id = d.id
      WHERE cw.status = 'approved'
    `;
    const params: any[] = [];

    if (q) {
      sql += ' AND (cw.word LIKE ? OR cw.meaning_en LIKE ? OR cw.meaning_fr LIKE ? OR cw.example_sentence LIKE ?)';
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }
    if (languageId && languageId !== 'all') {
      sql += ' AND cw.language_id = ?';
      params.push(languageId);
    }
    if (dialectId && dialectId !== 'all') {
      sql += ' AND cw.dialect_id = ?';
      params.push(dialectId);
    }
    if (category && category !== 'all') {
      sql += ' AND cw.category = ?';
      params.push(category);
    }

    if (sort === 'popular') {
      sql += ' ORDER BY cw.upvotes DESC, cw.word ASC';
    } else if (sort === 'alphabetical') {
      sql += ' ORDER BY cw.word ASC';
    } else {
      sql += ' ORDER BY cw.created_at DESC';
    }

    sql += ' LIMIT ? OFFSET ?';
    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit), offset);

    const results = await db.query(sql, params);
    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/dictionary/export', async (req: Request, res: Response) => {
  try {
    const { format = 'json', languageCode } = req.query;
    if (format === 'jsonl') {
      const jsonl = await LanguageKnowledgeService.exportFineTuningCorpus(languageCode as string);
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', 'attachment; filename="westvoice-training-corpus.jsonl"');
      return res.send(jsonl);
    } else {
      let sql = `
        SELECT cw.*, l.name as language_name, l.code as language_code, d.name as dialect_name
        FROM community_words cw
        JOIN languages l ON cw.language_id = l.id
        LEFT JOIN dialects d ON cw.dialect_id = d.id
        WHERE cw.status = 'approved'
      `;
      const params: any[] = [];
      if (languageCode) {
        sql += ' AND l.code = ?';
        params.push(languageCode);
      }
      const data = await db.query(sql, params);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="westvoice-dictionary-export.json"');
      return res.json(data);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. QUALITY FEEDBACK & CORRECTIONS
// ==========================================

app.post('/api/feedback', async (req: Request, res: Response) => {
  try {
    const { sessionId, feedbackType, sourceLanguage, targetLanguage, category, userComment, suggestedCorrection } = req.body;
    if (!feedbackType || !category) {
      return res.status(400).json({ error: 'feedbackType and category are required' });
    }

    const id = `fb-${uuidv4()}`;
    const userId = req.user?.id || null;

    await db.run(
      `INSERT INTO translation_feedback (id, session_id, feedback_type, source_language, target_language, category, user_comment, suggested_correction, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sessionId || null, feedbackType, sourceLanguage || null, targetLanguage || null, category, userComment || null, suggestedCorrection || null, userId]
    );

    return res.status(201).json({ message: 'Thank you for your feedback! It helps improve our language models.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. ADMIN DASHBOARD & SYSTEM SETTINGS
// ==========================================

app.get('/api/admin/stats', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const userCount = await db.get<{ count: number }>('SELECT count(*) as count FROM users');
    const wordCount = await db.get<{ count: number }>('SELECT count(*) as count FROM community_words');
    const phraseCount = await db.get<{ count: number }>('SELECT count(*) as count FROM community_phrases');
    const pronunciationCount = await db.get<{ count: number }>('SELECT count(*) as count FROM pronunciation_recordings');
    const transcriptionCount = await db.get<{ count: number }>('SELECT count(*) as count FROM transcription_sessions');
    const translationCount = await db.get<{ count: number }>('SELECT count(*) as count FROM translation_sessions');
    const feedbackCount = await db.get<{ count: number }>('SELECT count(*) as count FROM translation_feedback WHERE status = "open"');

    const transcriptionModel = await GeminiService.getTranscriptionModel();
    const translationModel = await GeminiService.getTranslationModel();
    const hasApiKey = Boolean(await GeminiService.getApiKey());

    return res.json({
      metrics: {
        users: userCount?.count || 0,
        words: wordCount?.count || 0,
        phrases: phraseCount?.count || 0,
        pronunciations: pronunciationCount?.count || 0,
        transcriptions: transcriptionCount?.count || 0,
        translations: translationCount?.count || 0,
        openFeedback: feedbackCount?.count || 0
      },
      aiConfig: {
        transcriptionModel,
        translationModel,
        hasApiKey
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/settings', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const settings = await db.query('SELECT key, value, description FROM system_settings');
    const map: Record<string, string> = {};
    for (const s of settings) {
      if (s.key === 'gemini_api_key' && s.value) {
        // Mask API Key
        map[s.key] = s.value.slice(0, 4) + '...' + s.value.slice(-4);
      } else {
        map[s.key] = s.value;
      }
    }
    return res.json(map);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/settings', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { gemini_api_key, gemini_transcription_model, gemini_translation_model } = req.body;

    if (gemini_api_key && !gemini_api_key.includes('...')) {
      await db.run(
        `INSERT INTO system_settings (key, value, description) VALUES ('gemini_api_key', ?, 'Gemini API Key')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [gemini_api_key.trim()]
      );
    }

    if (gemini_transcription_model) {
      await db.run(
        `INSERT INTO system_settings (key, value, description) VALUES ('gemini_transcription_model', ?, 'Gemini Transcription Model')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [gemini_transcription_model.trim()]
      );
    }

    if (gemini_translation_model) {
      await db.run(
        `INSERT INTO system_settings (key, value, description) VALUES ('gemini_translation_model', ?, 'Gemini Translation Model')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [gemini_translation_model.trim()]
      );
    }

    return res.json({ message: 'Settings saved successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/test-gemini', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const key = req.body.apiKey || (await GeminiService.getApiKey());
    if (!key) {
      return res.status(400).json({ success: false, message: 'No Gemini API Key provided or configured' });
    }
    const result = await GeminiService.testApiKey(key);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 9. CLIENT PRODUCTION STATIC SERVING
// ==========================================

const distPath = path.resolve(process.cwd(), 'dist', 'client');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Scheduled purge of orphan temporary audio files every 1 hour
setInterval(() => {
  AudioService.purgeOrphanTempFiles();
}, 60 * 60 * 1000);

// Initialize DB and Start Server
async function startServer() {
  try {
    await db.init();
    await seedDatabase();
    app.listen(PORT, () => {
      console.log(`WestVoice AI server listening on http://localhost:${PORT}`);
    });
  } catch (err: any) {
    console.error('Failed to start server:', err);
  }
}

startServer();
