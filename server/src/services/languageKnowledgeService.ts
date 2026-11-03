import { db } from '../db/db.js';

export interface VerifiedWord {
  id: string;
  word: string;
  category: string;
  meaning_en: string;
  meaning_fr?: string;
  example_sentence?: string;
  example_sentence_translation?: string;
  context_usage?: string;
  alternative_spellings?: string;
  dialect_name?: string;
}

export interface VerifiedPhrase {
  id: string;
  phrase: string;
  meaning_en: string;
  meaning_fr?: string;
  context?: string;
  literal_meaning?: string;
  dialect_name?: string;
}

export interface PromptContextData {
  languageName: string;
  languageCode: string;
  dialectName?: string;
  verifiedVocabulary: VerifiedWord[];
  verifiedPhrases: VerifiedPhrase[];
  formattedContextPrompt: string;
}

export class LanguageKnowledgeService {
  /**
   * Retrieve verified vocabulary for a language, optionally filtered or weighted by dialect
   */
  public static async getVerifiedVocabulary(languageCodeOrId: string, dialectId?: string, limit = 50): Promise<VerifiedWord[]> {
    // Resolve language id
    const lang = await db.get<{ id: string; name: string }>(
      'SELECT id, name FROM languages WHERE id = ? OR code = ?',
      [languageCodeOrId, languageCodeOrId]
    );

    if (!lang) return [];

    let sql = `
      SELECT cw.id, cw.word, cw.category, cw.meaning_en, cw.meaning_fr, 
             cw.example_sentence, cw.example_sentence_translation, cw.context_usage, 
             cw.alternative_spellings, d.name as dialect_name
      FROM community_words cw
      LEFT JOIN dialects d ON cw.dialect_id = d.id
      WHERE cw.language_id = ? AND cw.status = 'approved'
    `;
    const params: any[] = [lang.id];

    if (dialectId && dialectId !== 'all') {
      sql += ` AND (cw.dialect_id = ? OR cw.dialect_id IS NULL)`;
      params.push(dialectId);
    }

    sql += ` ORDER BY cw.upvotes DESC, cw.created_at DESC LIMIT ?`;
    params.push(limit);

    return await db.query<VerifiedWord>(sql, params);
  }

  /**
   * Retrieve verified phrases and proverbs
   */
  public static async getVerifiedPhrases(languageCodeOrId: string, dialectId?: string, limit = 20): Promise<VerifiedPhrase[]> {
    const lang = await db.get<{ id: string; name: string }>(
      'SELECT id, name FROM languages WHERE id = ? OR code = ?',
      [languageCodeOrId, languageCodeOrId]
    );

    if (!lang) return [];

    let sql = `
      SELECT cp.id, cp.phrase, cp.meaning_en, cp.meaning_fr, cp.context, cp.literal_meaning, d.name as dialect_name
      FROM community_phrases cp
      LEFT JOIN dialects d ON cp.dialect_id = d.id
      WHERE cp.language_id = ? AND cp.status = 'approved'
    `;
    const params: any[] = [lang.id];

    if (dialectId && dialectId !== 'all') {
      sql += ` AND (cp.dialect_id = ? OR cp.dialect_id IS NULL)`;
      params.push(dialectId);
    }

    sql += ` ORDER BY cp.upvotes DESC LIMIT ?`;
    params.push(limit);

    return await db.query<VerifiedPhrase>(sql, params);
  }

  /**
   * Build transcription context instructions for Gemini
   * Provides verified phonetic words, dialect variations, and vocabulary hints
   */
  public static async buildTranscriptionContext(languageCode: string, dialectId?: string): Promise<PromptContextData | null> {
    const lang = await db.get<{ id: string; name: string; code: string }>(
      'SELECT id, name, code FROM languages WHERE code = ? OR id = ?',
      [languageCode, languageCode]
    );

    if (!lang) return null;

    let dialectName: string | undefined;
    if (dialectId) {
      const d = await db.get<{ name: string }>('SELECT name FROM dialects WHERE id = ?', [dialectId]);
      if (d) dialectName = d.name;
    }

    const words = await this.getVerifiedVocabulary(lang.id, dialectId, 30);
    const phrases = await this.getVerifiedPhrases(lang.id, dialectId, 15);

    let promptLines: string[] = [];
    promptLines.push(`TARGET LANGUAGE: ${lang.name} (Code: ${lang.code}${dialectName ? `, Dialect: ${dialectName}` : ''})`);
    promptLines.push(`COMMUNITY LANGUAGE PRESERVATION GLOSSARY & VOCABULARY HINTS:`);
    promptLines.push(`The following words and expressions are verified native terms contributed by native West African speakers. Recognize and transcribe them faithfully if heard:`);

    for (const w of words.slice(0, 20)) {
      promptLines.push(`- "${w.word}" (${w.category}${w.dialect_name ? `, Dialect: ${w.dialect_name}` : ''}): ${w.meaning_en}`);
      if (w.alternative_spellings) {
        promptLines.push(`  Alternative orthography: ${w.alternative_spellings}`);
      }
    }

    if (phrases.length > 0) {
      promptLines.push(`COMMON APPROVED IDIOMS / PHRASES:`);
      for (const p of phrases.slice(0, 10)) {
        promptLines.push(`- "${p.phrase}": ${p.meaning_en}`);
      }
    }

    return {
      languageName: lang.name,
      languageCode: lang.code,
      dialectName,
      verifiedVocabulary: words,
      verifiedPhrases: phrases,
      formattedContextPrompt: promptLines.join('\n')
    };
  }

  /**
   * Build translation context instructions for Gemini
   * Guarantees culturally nuanced translation, avoiding sterile literal translations
   */
  public static async buildTranslationContext(sourceLangCode: string, targetLangCode: string, sampleText?: string): Promise<string> {
    const sourceLang = await db.get<{ id: string; name: string; code: string }>(
      'SELECT id, name, code FROM languages WHERE code = ? OR id = ?',
      [sourceLangCode, sourceLangCode]
    );
    const targetLang = await db.get<{ id: string; name: string; code: string }>(
      'SELECT id, name, code FROM languages WHERE code = ? OR id = ?',
      [targetLangCode, targetLangCode]
    );

    let contextSection = '';

    // If source or target is one of our preserved languages, fetch relevant community knowledge
    const relevantLang = targetLang?.code !== 'en' && targetLang?.code !== 'fr' ? targetLang : sourceLang;

    if (relevantLang) {
      const vocab = await this.getVerifiedVocabulary(relevantLang.id, undefined, 25);
      const phrases = await this.getVerifiedPhrases(relevantLang.id, undefined, 10);

      contextSection += `\n--- VERIFIED COMMUNITY KNOWLEDGE BASE FOR ${relevantLang.name.toUpperCase()} ---\n`;
      contextSection += `Use the following community-verified terms and idiomatic equivalents where applicable:\n`;
      
      for (const v of vocab) {
        contextSection += `* ${v.word} (${v.category}): EN: "${v.meaning_en}"${v.meaning_fr ? ` | FR: "${v.meaning_fr}"` : ''}${v.context_usage ? ` [Usage: ${v.context_usage}]` : ''}\n`;
      }

      if (phrases.length > 0) {
        contextSection += `Approved idiomatic expressions:\n`;
        for (const p of phrases) {
          contextSection += `* "${p.phrase}" => EN: "${p.meaning_en}"${p.literal_meaning ? ` (Literal: ${p.literal_meaning})` : ''}\n`;
        }
      }
      contextSection += `--- END COMMUNITY KNOWLEDGE BASE ---\n`;
    }

    return contextSection;
  }

  /**
   * Export verified dataset for fine-tuning or evaluation (JSONL format)
   */
  public static async exportFineTuningCorpus(languageCode?: string): Promise<string> {
    let sql = `
      SELECT cw.word, cw.meaning_en, cw.meaning_fr, cw.example_sentence, 
             cw.example_sentence_translation, cw.category, l.name as language_name, l.code as language_code,
             d.name as dialect_name
      FROM community_words cw
      JOIN languages l ON cw.language_id = l.id
      LEFT JOIN dialects d ON cw.dialect_id = d.id
      WHERE cw.status = 'approved'
    `;
    const params: any[] = [];

    if (languageCode) {
      sql += ` AND l.code = ?`;
      params.push(languageCode);
    }

    const rows = await db.query(sql, params);
    
    // Convert to JSONL format suitable for speech & LLM fine-tuning datasets
    const lines = rows.map(r => JSON.stringify({
      input: `Translate or explain the ${r.language_name} expression: "${r.word}"`,
      output: `Meaning in English: ${r.meaning_en}.${r.meaning_fr ? ` In French: ${r.meaning_fr}.` : ''} Example: "${r.example_sentence || ''}" (${r.example_sentence_translation || ''}). Category: ${r.category}.${r.dialect_name ? ` Dialect: ${r.dialect_name}.` : ''}`,
      metadata: {
        language: r.language_name,
        iso_code: r.language_code,
        dialect: r.dialect_name,
        category: r.category
      }
    }));

    return lines.join('\n');
  }
}
