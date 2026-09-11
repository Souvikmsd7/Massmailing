import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Ensure upload directories exist
const resumeDir = path.join(process.cwd(), 'uploads', 'resumes');
const csvDir = path.join(process.cwd(), 'uploads', 'csv');
[resumeDir, csvDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const MAX_RESUME_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5MB

// Resume storage
const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, resumeDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `resume-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// CSV storage
const csvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, csvDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `csv-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

function resumeFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.txt', '.zip', '.rar'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Supported attachments: PDF, DOC, DOCX, PNG, JPG, TXT, ZIP (max 10MB)'));
  }
}

function csvFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.csv') {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'));
  }
}

export const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: MAX_RESUME_SIZE },
  fileFilter: resumeFileFilter,
}).single('resume');

export const uploadCsv = multer({
  storage: csvStorage,
  limits: { fileSize: MAX_CSV_SIZE },
  fileFilter: csvFileFilter,
}).single('file');
