import { db } from './db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function seedDatabase() {
  // Check if already seeded
  const langCount = await db.get<{ count: number }>('SELECT count(*) as count FROM languages');
  if (langCount && langCount.count > 0) {
    console.log('Database already has languages seeded.');
    return;
  }

  console.log('Seeding initial WestVoice AI database...');

  // 1. Initial 10 Languages
  const initialLanguages = [
    {
      id: 'lang-hausa',
      code: 'ha',
      name: 'Hausa',
      alt_names: 'Harshen Hausa, هَوُسَ',
      family: 'Afroasiatic / Chadic',
      regions: 'Nigeria, Niger, Ghana, Cameroon, Benin, Chad',
      transcription_status: 'verified',
      translation_status: 'verified',
      detection_status: 'supported',
      verification_status: 'verified',
      resource_count: 1420
    },
    {
      id: 'lang-yoruba',
      code: 'yo',
      name: 'Yoruba',
      alt_names: 'Èdè Yorùbá',
      family: 'Niger-Congo / Volta-Niger',
      regions: 'Nigeria, Benin, Togo',
      transcription_status: 'verified',
      translation_status: 'verified',
      detection_status: 'supported',
      verification_status: 'verified',
      resource_count: 1280
    },
    {
      id: 'lang-igbo',
      code: 'ig',
      name: 'Igbo',
      alt_names: 'Asụsụ Igbo',
      family: 'Niger-Congo / Volta-Niger',
      regions: 'Nigeria, Equatorial Guinea',
      transcription_status: 'verified',
      translation_status: 'verified',
      detection_status: 'supported',
      verification_status: 'verified',
      resource_count: 1150
    },
    {
      id: 'lang-fulfulde',
      code: 'ff',
      name: 'Fulfulde / Fula',
      alt_names: 'Pulaar, Pular, Fulani, Peul',
      family: 'Niger-Congo / Senegambian',
      regions: 'Senegal, Guinea, Mali, Niger, Nigeria, Cameroon, Burkina Faso',
      transcription_status: 'beta',
      translation_status: 'beta',
      detection_status: 'experimental',
      verification_status: 'verified',
      resource_count: 890
    },
    {
      id: 'lang-wolof',
      code: 'wo',
      name: 'Wolof',
      alt_names: 'Wollof, Ouolof',
      family: 'Niger-Congo / Senegambian',
      regions: 'Senegal, The Gambia, Mauritania',
      transcription_status: 'verified',
      translation_status: 'verified',
      detection_status: 'supported',
      verification_status: 'verified',
      resource_count: 980
    },
    {
      id: 'lang-bambara',
      code: 'bm',
      name: 'Bambara',
      alt_names: 'Bamanankan',
      family: 'Mande',
      regions: 'Mali, Burkina Faso, Ivory Coast, Guinea',
      transcription_status: 'beta',
      translation_status: 'beta',
      detection_status: 'experimental',
      verification_status: 'verified',
      resource_count: 670
    },
    {
      id: 'lang-akan',
      code: 'ak',
      name: 'Akan / Twi',
      alt_names: 'Twi, Asante, Akuapem, Fante',
      family: 'Niger-Congo / Kwa',
      regions: 'Ghana, Ivory Coast',
      transcription_status: 'verified',
      translation_status: 'verified',
      detection_status: 'supported',
      verification_status: 'verified',
      resource_count: 1040
    },
    {
      id: 'lang-ewe',
      code: 'ee',
      name: 'Ewe',
      alt_names: 'Èʋegbe',
      family: 'Niger-Congo / Gbe',
      regions: 'Ghana, Togo, Benin',
      transcription_status: 'beta',
      translation_status: 'beta',
      detection_status: 'experimental',
      verification_status: 'verified',
      resource_count: 580
    },
    {
      id: 'lang-english',
      code: 'en',
      name: 'English (West African)',
      alt_names: 'West African English / Pidgin',
      family: 'Indo-European / Germanic',
      regions: 'Nigeria, Ghana, Sierra Leone, Liberia, The Gambia',
      transcription_status: 'verified',
      translation_status: 'verified',
      detection_status: 'supported',
      verification_status: 'verified',
      resource_count: 5000
    },
    {
      id: 'lang-french',
      code: 'fr',
      name: 'French (West African)',
      alt_names: 'Français Ouest-Africain',
      family: 'Indo-European / Romance',
      regions: 'Senegal, Ivory Coast, Mali, Guinea, Burkina Faso, Togo, Benin, Niger',
      transcription_status: 'verified',
      translation_status: 'verified',
      detection_status: 'supported',
      verification_status: 'verified',
      resource_count: 4800
    }
  ];

  for (const l of initialLanguages) {
    await db.run(
      `INSERT INTO languages (id, code, name, alt_names, family, regions, transcription_status, translation_status, detection_status, verification_status, is_active, resource_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [l.id, l.code, l.name, l.alt_names, l.family, l.regions, l.transcription_status, l.translation_status, l.detection_status, l.verification_status, l.resource_count]
    );
  }

  // 2. Initial Dialects
  const dialects = [
    // Hausa
    { id: 'dia-ha-kano', language_id: 'lang-hausa', name: 'Kano (Kananci)', region: 'Kano, Northern Nigeria', is_standard: 1, notes: 'Standard literary and broadcast Hausa dialect' },
    { id: 'dia-ha-sokoto', language_id: 'lang-hausa', name: 'Sokoto (Sakkwatanci)', region: 'North-Western Nigeria', is_standard: 0, notes: 'Classical northwestern variety' },
    { id: 'dia-ha-katsina', language_id: 'lang-hausa', name: 'Katsina (Katsinanci)', region: 'Katsina State', is_standard: 0, notes: 'Historical scholarly variety' },
    // Yoruba
    { id: 'dia-yo-oyo', language_id: 'lang-yoruba', name: 'Oyo / Standard Yoruba', region: 'Oyo State & Western Nigeria', is_standard: 1, notes: 'Basis of standard modern Yoruba writing' },
    { id: 'dia-yo-ijebu', language_id: 'lang-yoruba', name: 'Ijebu', region: 'Ogun / Lagos State', is_standard: 0, notes: 'Distinctive tonal shifts and vocabulary' },
    { id: 'dia-yo-ekiti', language_id: 'lang-yoruba', name: 'Ekiti', region: 'Ekiti State', is_standard: 0, notes: 'Eastern Yoruba regional group' },
    // Igbo
    { id: 'dia-ig-central', language_id: 'lang-igbo', name: 'Central Igbo (Igbo Izugbe)', region: 'South-Eastern Nigeria', is_standard: 1, notes: 'Standard literary and educational Igbo' },
    { id: 'dia-ig-onitsha', language_id: 'lang-igbo', name: 'Onitsha', region: 'Anambra River Valley', is_standard: 0, notes: 'Prominent commercial variety' },
    { id: 'dia-ig-owerri', language_id: 'lang-igbo', name: 'Owerri', region: 'Imo State', is_standard: 0, notes: 'Southern Igbo group' },
    // Wolof
    { id: 'dia-wo-dakar', language_id: 'lang-wolof', name: 'Urban Wolof (Dakar)', region: 'Dakar & Cape Verde Peninsula', is_standard: 1, notes: 'Cosmopolitan vernacular with modern French loan adaptations' },
    { id: 'dia-wo-baol', language_id: 'lang-wolof', name: 'Baol / Traditional Wolof', region: 'Diourbel, Sine-Saloum', is_standard: 0, notes: 'Deep traditional agricultural vocabulary' },
    // Akan / Twi
    { id: 'dia-ak-asante', language_id: 'lang-akan', name: 'Asante Twi', region: 'Ashanti Region, Ghana', is_standard: 1, notes: 'Most widely spoken Twi variety' },
    { id: 'dia-ak-akuapem', language_id: 'lang-akan', name: 'Akuapem Twi', region: 'Eastern Region, Ghana', is_standard: 0, notes: 'First written Akan literary dialect' },
    { id: 'dia-ak-fante', language_id: 'lang-akan', name: 'Fante (Mfantse)', region: 'Central & Western Coastal Ghana', is_standard: 0, notes: 'Coastal dialect with distinct phonology' },
    // Fulfulde
    { id: 'dia-ff-pulaar', language_id: 'lang-fulfulde', name: 'Pulaar (Futa Tooro)', region: 'Senegal River Valley', is_standard: 1, notes: 'Western Fulfulde standard' },
    { id: 'dia-ff-adamawa', language_id: 'lang-fulfulde', name: 'Adamawa Fulfulde', region: 'Northern Nigeria / Cameroon', is_standard: 0, notes: 'Eastern variety widely used in trade' },
    // Bambara
    { id: 'dia-bm-bamako', language_id: 'lang-bambara', name: 'Bamako Vernacular', region: 'Bamako & Central Mali', is_standard: 1, notes: 'National vehicular Bambara' },
    // Ewe
    { id: 'dia-ee-anlo', language_id: 'lang-ewe', name: 'Anlo Ewe', region: 'Volta Region / Coastal Ghana', is_standard: 1, notes: 'Prominent coastal Ewe dialect' }
  ];

  for (const d of dialects) {
    await db.run(
      `INSERT INTO dialects (id, language_id, name, region, is_standard, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [d.id, d.language_id, d.name, d.region, d.is_standard, d.notes]
    );
  }

  // 3. Demo Users & Contributors
  const passwordHash = await bcrypt.hash('WestVoice@2025', 10);
  const users = [
    {
      id: 'usr-admin',
      email: 'admin@westvoice.ai',
      username: 'westvoice_admin',
      password_hash: passwordHash,
      full_name: 'Dr. Chikezie Obi',
      role: 'admin',
      languages: JSON.stringify(['ha', 'yo', 'ig', 'en']),
      dialects: JSON.stringify(['dia-ig-central', 'dia-yo-oyo']),
      bio: 'Principal Computational Linguist & Systems Administrator at WestVoice AI.',
      points: 2450,
      submitted_count: 58,
      approved_count: 54,
      validation_count: 312
    },
    {
      id: 'usr-moderator',
      email: 'moderator@westvoice.ai',
      username: 'kwame_mensah',
      password_hash: passwordHash,
      full_name: 'Kwame Mensah',
      role: 'moderator',
      languages: JSON.stringify(['ak', 'ee', 'en', 'fr']),
      dialects: JSON.stringify(['dia-ak-asante', 'dia-ee-anlo']),
      bio: 'African Languages Research Fellow at University of Ghana. Expert in Akan and Ewe oral traditions.',
      points: 1840,
      submitted_count: 92,
      approved_count: 88,
      validation_count: 420
    },
    {
      id: 'usr-contributor-1',
      email: 'amina@westvoice.ai',
      username: 'amina_diallo',
      password_hash: passwordHash,
      full_name: 'Amina Diallo',
      role: 'contributor',
      languages: JSON.stringify(['ff', 'wo', 'fr']),
      dialects: JSON.stringify(['dia-ff-pulaar', 'dia-wo-dakar']),
      bio: 'Griot descendant and digital archivist from Saint-Louis and Dakar. Preserving Senegambian oral heritage.',
      points: 920,
      submitted_count: 45,
      approved_count: 41,
      validation_count: 110
    },
    {
      id: 'usr-contributor-2',
      email: 'zainab@westvoice.ai',
      username: 'zainab_kano',
      password_hash: passwordHash,
      full_name: 'Zainab Bello',
      role: 'contributor',
      languages: JSON.stringify(['ha', 'en']),
      dialects: JSON.stringify(['dia-ha-kano']),
      bio: 'Educator and voice talent based in Kano. Passionate about northern Nigerian youth literacy.',
      points: 760,
      submitted_count: 34,
      approved_count: 31,
      validation_count: 95
    }
  ];

  for (const u of users) {
    await db.run(
      `INSERT INTO users (id, email, username, password_hash, full_name, role, languages, dialects, bio, points, submitted_count, approved_count, validation_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.email, u.username, u.password_hash, u.full_name, u.role, u.languages, u.dialects, u.bio, u.points, u.submitted_count, u.approved_count, u.validation_count]
    );
  }

  // 4. User Badges
  const badges = [
    { id: 'bdg-1', user_id: 'usr-admin', badge_type: 'founder', title: 'Language Custodian', description: 'Architect of the WestVoice linguistic foundation', icon: 'shield-check' },
    { id: 'bdg-2', user_id: 'usr-moderator', badge_type: 'validator', title: 'Master Reviewer', description: 'Validated over 400 community submissions with 99% accuracy', icon: 'award' },
    { id: 'bdg-3', user_id: 'usr-contributor-1', badge_type: 'pioneer', title: 'Griot of Wolof', description: 'Contributed 40+ authentic Wolof idioms and proverbs', icon: 'feather' },
    { id: 'bdg-4', user_id: 'usr-contributor-2', badge_type: 'voice', title: 'Voice Pioneer', description: 'Recorded over 30 verified dialect pronunciations', icon: 'mic' }
  ];

  for (const b of badges) {
    await db.run(
      `INSERT INTO user_badges (id, user_id, badge_type, title, description, icon)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [b.id, b.user_id, b.badge_type, b.title, b.description, b.icon]
    );
  }

  // 5. Rich Verified Community Vocabulary
  const words = [
    // Hausa
    {
      id: 'w-ha-1',
      word: 'Sannu',
      language_id: 'lang-hausa',
      dialect_id: 'dia-ha-kano',
      category: 'word',
      meaning_en: 'Hello; greetings; welcome; sympathy depending on context (e.g. Sannu da aiki = greetings for your work).',
      meaning_fr: 'Bonjour; salutations; bienvenue; compassion selon le contexte.',
      example_sentence: 'Sannu da zuwa gidanmu, babban bako.',
      example_sentence_translation: 'Welcome to our home, distinguished guest.',
      context_usage: 'Universal respectful greeting used throughout Northern Nigeria and Niger Republic.',
      alternative_spellings: 'Sannu, Sannu da aiki',
      contributor_notes: 'Tone: High-Low. Often combined with specific honorifics.',
      status: 'approved',
      submitted_by: 'usr-contributor-2',
      approved_by: 'usr-admin',
      upvotes: 42,
      downvotes: 0
    },
    {
      id: 'w-ha-2',
      word: 'Gaskiya',
      language_id: 'lang-hausa',
      dialect_id: 'dia-ha-kano',
      category: 'traditional',
      meaning_en: 'Truth, reality, certainty. Often used as an exclamation meaning "Indeed!" or "Truly!".',
      meaning_fr: 'Vérité, réalité, certitude. Utilisé pour exprimer "En effet !" ou "C\'est vrai !".',
      example_sentence: 'Gaskiya ta fi zinare da azurfa daraja.',
      example_sentence_translation: 'Truth is more valuable than gold and silver.',
      context_usage: 'Found in classic literature, religious proverbs, and philosophical discussions.',
      alternative_spellings: 'Gaskiya dokin karfe',
      contributor_notes: 'Central philosophical concept in Hausa culture (Adalci da Gaskiya).',
      status: 'approved',
      submitted_by: 'usr-contributor-2',
      approved_by: 'usr-admin',
      upvotes: 38,
      downvotes: 0
    },
    {
      id: 'w-ha-3',
      word: 'Kare dangi',
      language_id: 'lang-hausa',
      dialect_id: 'dia-ha-kano',
      category: 'idiom',
      meaning_en: 'Literal: Finished relatives. Idiomatic: Complete wipeout; ultimate satisfaction; top-tier excellence.',
      meaning_fr: 'Sens figuré: Excellence suprême, satisfaction totale ou match d\'anthologie.',
      example_sentence: 'Wannan abinci da Zainab ta dafa ya kare dangi!',
      example_sentence_translation: 'This dish that Zainab cooked is unbelievably delicious!',
      context_usage: 'Modern informal praise among northern youths and food lovers.',
      alternative_spellings: 'Kare-dangi',
      contributor_notes: 'Urban slang evolving in Kano and Kaduna.',
      status: 'approved',
      submitted_by: 'usr-contributor-2',
      approved_by: 'usr-admin',
      upvotes: 29,
      downvotes: 1
    },

    // Yoruba
    {
      id: 'w-yo-1',
      word: 'Ẹ kú àárọ̀',
      language_id: 'lang-yoruba',
      dialect_id: 'dia-yo-oyo',
      category: 'word',
      meaning_en: 'Good morning (respectful, plural/honorific form).',
      meaning_fr: 'Bonjour (forme respectueuse / plurielle).',
      example_sentence: 'Ẹ kú àárọ̀ o, Baba mi.',
      example_sentence_translation: 'Good morning, my father.',
      context_usage: 'Morning greeting showing traditional Yoruba reverence to elders.',
      alternative_spellings: 'E ku aaro, Ekaaro',
      contributor_notes: 'Tone diacritics are crucial: ẹ (low dot), kú (high), àárọ̀ (low-high-low).',
      status: 'approved',
      submitted_by: 'usr-admin',
      approved_by: 'usr-moderator',
      upvotes: 56,
      downvotes: 0
    },
    {
      id: 'w-yo-2',
      word: 'Ọmọlúwàbí',
      language_id: 'lang-yoruba',
      dialect_id: 'dia-yo-oyo',
      category: 'traditional',
      meaning_en: 'A person of impeccable character, honor, integrity, humility, and wisdom.',
      meaning_fr: 'Personne de caractère exemplaire, intègre, digne de confiance et empreinte de sagesse.',
      example_sentence: 'Iwa rere ni ipilẹ ọmọlúwàbí gidi.',
      example_sentence_translation: 'Good character is the foundation of a true Omoluwabi.',
      context_usage: 'The highest moral ideal in classical Yoruba philosophy.',
      alternative_spellings: 'Omoluabi, Omoluwabi',
      contributor_notes: 'Compound: Ọmọ + ti + Olú-ìwà + bí (Child that the Lord of Character begot).',
      status: 'approved',
      submitted_by: 'usr-admin',
      approved_by: 'usr-moderator',
      upvotes: 67,
      downvotes: 0
    },
    {
      id: 'w-yo-3',
      word: 'Gbẹ́sẹ̀ sókè',
      language_id: 'lang-yoruba',
      dialect_id: 'dia-yo-oyo',
      category: 'slang',
      meaning_en: 'Literal: Lift your leg up. Slang: Dance, pick up pace, celebrate energetically.',
      meaning_fr: 'Sens figuré: Lève le pied, danse vigoureusement, célèbre.',
      example_sentence: 'Orin tuntun yi dun gan, gbẹ́sẹ̀ sókè!',
      example_sentence_translation: 'This new track is amazing, get on your feet and dance!',
      context_usage: 'Lagos Afrobeats street culture and social celebrations.',
      alternative_spellings: 'Gbese soke, Gbese',
      contributor_notes: 'Popularized globally via contemporary music and street dance.',
      status: 'approved',
      submitted_by: 'usr-admin',
      approved_by: 'usr-moderator',
      upvotes: 45,
      downvotes: 0
    },

    // Igbo
    {
      id: 'w-ig-1',
      word: 'Ndewo',
      language_id: 'lang-igbo',
      dialect_id: 'dia-ig-central',
      category: 'word',
      meaning_en: 'Greetings, hello, thank you for your effort/presence.',
      meaning_fr: 'Salutations, bonjour, merci pour votre effort.',
      example_sentence: 'Ndewo nu, ụmụ nne m na ụmụ nna m.',
      example_sentence_translation: 'Greetings to you all, my brothers and sisters.',
      context_usage: 'Standard pan-Igbo polite greeting for individuals and gatherings.',
      alternative_spellings: 'Nno, Ndewo nu',
      contributor_notes: 'Tone: High-Low-Low. Adaptable to any time of the day.',
      status: 'approved',
      submitted_by: 'usr-admin',
      approved_by: 'usr-moderator',
      upvotes: 51,
      downvotes: 0
    },
    {
      id: 'w-ig-2',
      word: 'Igwebuike',
      language_id: 'lang-igbo',
      dialect_id: 'dia-ig-central',
      category: 'proverb',
      meaning_en: 'There is strength in unity / a multitude brings power and solidarity.',
      meaning_fr: 'L\'union fait la force / la communauté est le socle de la puissance.',
      example_sentence: 'Anyị ga-arụ ụlọ akwụkwọ a n\'ihi na igwebuike.',
      example_sentence_translation: 'We shall build this school together because in numbers lies our strength.',
      context_usage: 'Communal meetings, town hall governance, community building fundraisers.',
      alternative_spellings: 'Igwe bu ike',
      contributor_notes: 'Philosophical pillar of Igbo republican communalism.',
      status: 'approved',
      submitted_by: 'usr-admin',
      approved_by: 'usr-moderator',
      upvotes: 62,
      downvotes: 0
    },
    {
      id: 'w-ig-3',
      word: 'Ụbọchị ọma',
      language_id: 'lang-igbo',
      dialect_id: 'dia-ig-central',
      category: 'word',
      meaning_en: 'Good day / Blessed day.',
      meaning_fr: 'Bonne journée.',
      example_sentence: 'Ka anyị nwee ụbọchị ọma taa.',
      example_sentence_translation: 'May we have a pleasant and prosperous day today.',
      context_usage: 'Polite daytime blessing.',
      alternative_spellings: 'Ubochi oma',
      contributor_notes: 'Often followed by blessings for trade and enterprise.',
      status: 'approved',
      submitted_by: 'usr-admin',
      approved_by: 'usr-moderator',
      upvotes: 33,
      downvotes: 0
    },

    // Wolof
    {
      id: 'w-wo-1',
      word: 'Teranga',
      language_id: 'lang-wolof',
      dialect_id: 'dia-wo-dakar',
      category: 'traditional',
      meaning_en: 'Sacred hospitality, welcoming spirit, generosity towards strangers and guests.',
      meaning_fr: 'Hospitalité sénégalaise légendaire, générosité et bienveillance envers l\'hôte.',
      example_sentence: 'Teranga Senegaal amul feneen ci àdduna bi.',
      example_sentence_translation: 'Senegalese hospitality is found nowhere else in the world.',
      context_usage: 'National cultural identity of Senegal, welcoming any visitor like family.',
      alternative_spellings: 'Téranga, Terànga',
      contributor_notes: 'From Wolof root "ter" meaning to welcome or host warmly.',
      status: 'approved',
      submitted_by: 'usr-contributor-1',
      approved_by: 'usr-moderator',
      upvotes: 74,
      downvotes: 0
    },
    {
      id: 'w-wo-2',
      word: 'Jamm rek',
      language_id: 'lang-wolof',
      dialect_id: 'dia-wo-dakar',
      category: 'word',
      meaning_en: 'Peace only (the canonical Wolof response to any greeting inquiry like "Na nga def?").',
      meaning_fr: 'Que la paix (réponse universelle à la salutation Wolof).',
      example_sentence: 'Na nga def? - Jamm rek, alxamdulilaay!',
      example_sentence_translation: 'How are you doing? - Peace only, praise be to God!',
      context_usage: 'Universal daily greeting exchange in Senegal and The Gambia.',
      alternative_spellings: 'Diam rek, Jàmm rekk',
      contributor_notes: 'Jamm = peace; Rek = only.',
      status: 'approved',
      submitted_by: 'usr-contributor-1',
      approved_by: 'usr-moderator',
      upvotes: 68,
      downvotes: 0
    },
    {
      id: 'w-wo-3',
      word: 'Ndank-ndank',
      language_id: 'lang-wolof',
      dialect_id: 'dia-wo-baol',
      category: 'proverb',
      meaning_en: 'Gently, step by step, with patience. Part of proverb: "Ndank-ndank mooy jàpp golo ci ñaay" (Patience catches the monkey in the forest).',
      meaning_fr: 'Doucement, pas à pas. La patience vient à bout de tous les obstacles.',
      example_sentence: 'Bul gaaw, defal ndank-ndank ba nga egg.',
      example_sentence_translation: 'Do not hurry recklessly; move step by step until you arrive.',
      context_usage: 'Advice given when facing intricate challenges or embarking on journeys.',
      alternative_spellings: 'Ndànk-ndànk',
      contributor_notes: 'Reduplicative adverb conveying methodical steadiness.',
      status: 'approved',
      submitted_by: 'usr-contributor-1',
      approved_by: 'usr-moderator',
      upvotes: 55,
      downvotes: 0
    },

    // Akan / Twi
    {
      id: 'w-ak-1',
      word: 'Akwaaba',
      language_id: 'lang-akan',
      dialect_id: 'dia-ak-asante',
      category: 'word',
      meaning_en: 'Welcome (warm welcoming expression to visitors and returnees).',
      meaning_fr: 'Bienvenue (expression chaleureuse d\'accueil ghanéenne).',
      example_sentence: 'Akwaaba kɔ Ghana, yɛn kurom.',
      example_sentence_translation: 'Welcome to Ghana, our homeland.',
      context_usage: 'Official and familial greeting across all Akan-speaking communities.',
      alternative_spellings: 'Akwaaba',
      contributor_notes: 'Symbolizes the golden hospitality of the Akan people.',
      status: 'approved',
      submitted_by: 'usr-moderator',
      approved_by: 'usr-admin',
      upvotes: 70,
      downvotes: 0
    },
    {
      id: 'w-ak-2',
      word: 'Sankofa',
      language_id: 'lang-akan',
      dialect_id: 'dia-ak-asante',
      category: 'traditional',
      meaning_en: 'Go back and fetch it: it is not wrong to return to the past to reclaim forgotten wisdom.',
      meaning_fr: 'Retourne chercher ce qui a été oublié : puiser dans le passé pour bâtir l\'avenir.',
      example_sentence: 'Yɛde Sankofa bɛsan anya yɛn amammerɛ.',
      example_sentence_translation: 'Through Sankofa we shall retrieve and honor our cultural heritage.',
      context_usage: 'Adinkra philosophy, cultural preservation, and Pan-African renaissance.',
      alternative_spellings: 'San-kofa',
      contributor_notes: 'Represented by a mythical bird with head turned backward carrying an egg.',
      status: 'approved',
      submitted_by: 'usr-moderator',
      approved_by: 'usr-admin',
      upvotes: 82,
      downvotes: 0
    },
    {
      id: 'w-ak-3',
      word: 'Nyame nti',
      language_id: 'lang-akan',
      dialect_id: 'dia-ak-akuapem',
      category: 'idiom',
      meaning_en: 'By God\'s grace / Because of the Almighty.',
      meaning_fr: 'Par la grâce divine / Grâce à Dieu.',
      example_sentence: 'Nyame nti, yɛbɛtumi ayɛ adwuma yi nyinaa.',
      example_sentence_translation: 'By God\'s grace, we shall accomplish all this work successfully.',
      context_usage: 'Commonly painted on tro-tros, public transport, and storefronts in Ghana.',
      alternative_spellings: 'Nyame-nti',
      contributor_notes: 'Reflects Akan theological world view.',
      status: 'approved',
      submitted_by: 'usr-moderator',
      approved_by: 'usr-admin',
      upvotes: 40,
      downvotes: 0
    },

    // Fulfulde
    {
      id: 'w-ff-1',
      word: 'Pulaaku',
      language_id: 'lang-fulfulde',
      dialect_id: 'dia-ff-pulaar',
      category: 'traditional',
      meaning_en: 'The Fulani code of honor, modesty, bravery, patience, moral fortitude, and dignity.',
      meaning_fr: 'Le code moral et éthique des Peuls : retenue, honneur, dignité et patience.',
      example_sentence: 'Pulaaku woni daande e ɓernde leñol Fulɓe.',
      example_sentence_translation: 'Pulaaku is the true voice and heart of the Fulani people.',
      context_usage: 'The central cultural ethic taught from childhood across West and Central Africa.',
      alternative_spellings: 'Pulaaku, Pulaakuuji',
      contributor_notes: 'Includes semteende (shame/modesty), munyal (patience), and ngorgu (courage).',
      status: 'approved',
      submitted_by: 'usr-contributor-1',
      approved_by: 'usr-admin',
      upvotes: 61,
      downvotes: 0
    },
    {
      id: 'w-ff-2',
      word: 'Jam tan',
      language_id: 'lang-fulfulde',
      dialect_id: 'dia-ff-pulaar',
      category: 'word',
      meaning_en: 'Peace only (the standard Fulani greeting response).',
      meaning_fr: 'La paix seulement (réponse canonique aux salutations).',
      example_sentence: 'Kori aɗa selli? - Jam tan, alxamdulillaahi.',
      example_sentence_translation: 'Are you in good health? - Peace only, praise be to God.',
      context_usage: 'Universal greeting phrase in Guinea, Senegal, Mali, Cameroon, and Nigeria.',
      alternative_spellings: 'Jam tun, Jam tan',
      contributor_notes: 'Jam = peace; tan = only.',
      status: 'approved',
      submitted_by: 'usr-contributor-1',
      approved_by: 'usr-admin',
      upvotes: 49,
      downvotes: 0
    },

    // Bambara
    {
      id: 'w-bm-1',
      word: 'I ni ce',
      language_id: 'lang-bambara',
      dialect_id: 'dia-bm-bamako',
      category: 'word',
      meaning_en: 'Hello; thank you; greetings for your work (multi-purpose respectful greeting).',
      meaning_fr: 'Bonjour; merci; salut chaleureux pour le travail accompli.',
      example_sentence: 'I ni ce kosɛbɛ, n kɔrɔcɛ.',
      example_sentence_translation: 'Thank you very much / Greetings, my elder brother.',
      context_usage: 'Used constantly throughout Mali and Burkina Faso in markets and meetings.',
      alternative_spellings: 'Iniche, I ni baara',
      contributor_notes: 'Pronounced "ee-nee-chay". Expresses solidarity in activity.',
      status: 'approved',
      submitted_by: 'usr-contributor-1',
      approved_by: 'usr-moderator',
      upvotes: 44,
      downvotes: 0
    },
    {
      id: 'w-bm-2',
      word: 'Maya',
      language_id: 'lang-bambara',
      dialect_id: 'dia-bm-bamako',
      category: 'traditional',
      meaning_en: 'Humanity, humanist solidarity, respect for every individual, social harmony.',
      meaning_fr: 'Humanité, convivialité, respect de la dignité humaine.',
      example_sentence: 'Maya ye fɛn fɔlɔ ye Manden jamana kɔnɔ.',
      example_sentence_translation: 'Maya (human kindness) is the foremost virtue in the Manden civilization.',
      context_usage: 'Malian philosophical discussions and peaceful dispute resolution.',
      alternative_spellings: 'Maden-maya, Maaya',
      contributor_notes: 'Core foundation of the Kurukan Fuga charter of 1236.',
      status: 'approved',
      submitted_by: 'usr-contributor-1',
      approved_by: 'usr-moderator',
      upvotes: 39,
      downvotes: 0
    },

    // Ewe
    {
      id: 'w-ee-1',
      word: 'Woezɔ',
      language_id: 'lang-ewe',
      dialect_id: 'dia-ee-anlo',
      category: 'word',
      meaning_en: 'Welcome (You have traveled and arrived safely).',
      meaning_fr: 'Bienvenue (Que ton arrivée soit bénie).',
      example_sentence: 'Woezɔ va míaƒe aƒe me.',
      example_sentence_translation: 'Welcome into our household.',
      context_usage: 'Greeting welcoming guests upon arrival in Volta Region and Togo.',
      alternative_spellings: 'Woezo, Miawoezɔ',
      contributor_notes: 'Woe (you) + zɔ (walked/traveled). Response is "Yoo" or "Enyo".',
      status: 'approved',
      submitted_by: 'usr-moderator',
      approved_by: 'usr-admin',
      upvotes: 36,
      downvotes: 0
    }
  ];

  for (const w of words) {
    await db.run(
      `INSERT INTO community_words (id, word, language_id, dialect_id, category, meaning_en, meaning_fr, example_sentence, example_sentence_translation, context_usage, alternative_spellings, contributor_notes, status, submitted_by, approved_by, upvotes, downvotes, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [w.id, w.word, w.language_id, w.dialect_id, w.category, w.meaning_en, w.meaning_fr, w.example_sentence, w.example_sentence_translation, w.context_usage, w.alternative_spellings, w.contributor_notes, w.status, w.submitted_by, w.approved_by, w.upvotes, w.downvotes]
    );

    // Add initial version history for approved words
    await db.run(
      `INSERT INTO entry_version_history (id, entry_id, entry_type, version_number, snapshot_data, changed_by, change_reason)
       VALUES (?, ?, 'word', 1, ?, ?, 'Initial seed entry')`,
      [uuidv4(), w.id, JSON.stringify(w), w.submitted_by]
    );
  }

  // 6. Verified Pronunciation Audio references & guides
  const samplePronunciations = [
    {
      id: 'prn-1',
      word_id: 'w-ha-1',
      audio_url: '/audio/samples/sannu.webm',
      phonetic_guide: '/sænˈnuː/ (High-Low tone)',
      dialect_id: 'dia-ha-kano',
      accent_region: 'Kano City Native Accent',
      speaker_context: 'Recorded by native female voice artist from Dala, Kano.',
      recorded_by: 'usr-contributor-2',
      status: 'approved',
      upvotes: 28
    },
    {
      id: 'prn-2',
      word_id: 'w-yo-1',
      audio_url: '/audio/samples/eku_aaro.webm',
      phonetic_guide: '/ɛ́ kú àː.ɾɔ̀/ (Mid-High-Low tone)',
      dialect_id: 'dia-yo-oyo',
      accent_region: 'Ibadan Urban Voice',
      speaker_context: 'Spoken with traditional honorific bending on the initial syllable.',
      recorded_by: 'usr-admin',
      status: 'approved',
      upvotes: 34
    },
    {
      id: 'prn-3',
      word_id: 'w-wo-1',
      audio_url: '/audio/samples/teranga.webm',
      phonetic_guide: '/teː.raːŋ.ɡa/ (Clear open vowels)',
      dialect_id: 'dia-wo-dakar',
      accent_region: 'Dakar Maritime Accent',
      speaker_context: 'Authentic Dakar pronunciation emphasizing open nasalised ending.',
      recorded_by: 'usr-contributor-1',
      status: 'approved',
      upvotes: 41
    },
    {
      id: 'prn-4',
      word_id: 'w-ak-1',
      audio_url: '/audio/samples/akwaaba.webm',
      phonetic_guide: '/a.kʷaː.ba/ (Mid rising tone)',
      dialect_id: 'dia-ak-asante',
      accent_region: 'Kumasi Central Accent',
      speaker_context: 'Rich Asante resonance recorded by Akan linguist.',
      recorded_by: 'usr-moderator',
      status: 'approved',
      upvotes: 39
    }
  ];

  for (const p of samplePronunciations) {
    await db.run(
      `INSERT INTO pronunciation_recordings (id, word_id, audio_url, phonetic_guide, dialect_id, accent_region, speaker_context, recorded_by, status, upvotes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.word_id, p.audio_url, p.phonetic_guide, p.dialect_id, p.accent_region, p.speaker_context, p.recorded_by, p.status, p.upvotes]
    );
  }

  // 7. Community Phrases
  const phrases = [
    {
      id: 'phr-ha-1',
      phrase: 'Ina kwana? Lafiya lau.',
      language_id: 'lang-hausa',
      dialect_id: 'dia-ha-kano',
      meaning_en: 'How did you spend the night? In complete peace and sound health.',
      meaning_fr: 'Comment s\'est passée ta nuit ? Dans une paix absolue et la santé.',
      context: 'Everyday morning exchange throughout Northern Nigeria.',
      literal_meaning: 'Where is the morning? Health fine.',
      submitted_by: 'usr-contributor-2',
      status: 'approved',
      upvotes: 27
    },
    {
      id: 'phr-yo-1',
      phrase: 'Báwo ni nǹkan? Kò sí wàhálà rárá.',
      language_id: 'lang-yoruba',
      dialect_id: 'dia-yo-oyo',
      meaning_en: 'How are things going? No trouble whatsoever; all is well.',
      meaning_fr: 'Comment vont les choses ? Aucun souci, tout va parfaitement.',
      context: 'Casual greeting among friends and peers.',
      literal_meaning: 'How are things? There is no wahala at all.',
      submitted_by: 'usr-admin',
      status: 'approved',
      upvotes: 35
    },
    {
      id: 'phr-wo-1',
      phrase: 'Lu bees? Dara beesul, jamm rekk.',
      language_id: 'lang-wolof',
      dialect_id: 'dia-wo-dakar',
      meaning_en: 'What is new? Nothing is new, only peace.',
      meaning_fr: 'Qu\'y a-t-il de neuf ? Rien de neuf, que la paix.',
      context: 'Ubiquitous Dakar street greeting.',
      literal_meaning: 'What new? Nothing new, peace only.',
      submitted_by: 'usr-contributor-1',
      status: 'approved',
      upvotes: 32
    },
    {
      id: 'phr-ak-1',
      phrase: 'Wo ho te sɛn? Me ho yɛ, medaase.',
      language_id: 'lang-akan',
      dialect_id: 'dia-ak-asante',
      meaning_en: 'How are you? I am doing well, thank you.',
      meaning_fr: 'Comment vas-tu ? Je vais bien, merci.',
      context: 'Standard polite Akan social interaction.',
      literal_meaning: 'Your body feels how? My body is good, I thank you.',
      submitted_by: 'usr-moderator',
      status: 'approved',
      upvotes: 29
    }
  ];

  for (const ph of phrases) {
    await db.run(
      `INSERT INTO community_phrases (id, phrase, language_id, dialect_id, meaning_en, meaning_fr, context, literal_meaning, submitted_by, status, upvotes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ph.id, ph.phrase, ph.language_id, ph.dialect_id, ph.meaning_en, ph.meaning_fr, ph.context, ph.literal_meaning, ph.submitted_by, ph.status, ph.upvotes]
    );
  }

  // 8. System Settings
  const settings = [
    { key: 'gemini_transcription_model', value: 'gemini-2.5-flash', description: 'Primary model for speech audio recognition and transcription' },
    { key: 'gemini_translation_model', value: 'gemini-2.5-flash', description: 'Model for contextual West African language translation' },
    { key: 'community_context_injection', value: 'true', description: 'Whether verified community vocabulary is dynamically fed to Gemini prompts' },
    { key: 'max_audio_upload_mb', value: '25', description: 'Maximum audio file upload size in Megabytes' },
    { key: 'auto_purge_temp_audio_hours', value: '24', description: 'Automatic cleanup duration for unpreserved audio sessions' },
    { key: 'platform_version', value: '2.0.0', description: 'WestVoice AI Core Engine version' }
  ];

  for (const s of settings) {
    await db.run(
      `INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)`,
      [s.key, s.value, s.description]
    );
  }

  console.log('WestVoice AI database seeded successfully with 10 languages, dialects, verified entries, and users!');
}
