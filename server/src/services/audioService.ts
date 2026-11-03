import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'audio');
const TEMP_DIR = path.resolve(process.cwd(), 'data', 'temp_audio');

// Ensure directories exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Storage for temporary transcription audio (deleted automatically after processing)
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `temp_${uuidv4()}${ext}`);
  }
});

// Storage for permanent community pronunciation recordings
const permanentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `pronounce_${uuidv4()}${ext}`);
  }
});

// File filter for audio validation
const audioFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'audio/webm',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/ogg',
    'audio/x-flac'
  ];

  if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(webm|wav|mp3|m4a|aac|ogg|flac)$/i)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported audio format: ${file.mimetype}. Allowed formats: WAV, MP3, M4A, WebM, OGG.`));
  }
};

export const uploadTempAudio = multer({
  storage: tempStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: audioFileFilter
});

export const uploadPronunciationAudio = multer({
  storage: permanentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max for pronunciations
  fileFilter: audioFileFilter
});

export class AudioService {
  /**
   * Safely delete a temporary file after processing to maintain audio privacy
   */
  public static cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up temporary audio file: ${filePath}`);
      }
    } catch (err: any) {
      console.warn(`Failed to cleanup temp audio file ${filePath}:`, err.message);
    }
  }

  /**
   * Periodic purge of orphan temp files older than 1 hour
   */
  public static purgeOrphanTempFiles(): void {
    try {
      const files = fs.readdirSync(TEMP_DIR);
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      for (const file of files) {
        const fullPath = path.join(TEMP_DIR, file);
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > ONE_HOUR) {
          fs.unlinkSync(fullPath);
          console.log(`Purged expired temp file: ${file}`);
        }
      }
    } catch (err: any) {
      console.error('Error in purgeOrphanTempFiles:', err.message);
    }
  }
}
