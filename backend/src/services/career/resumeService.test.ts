/// <reference types="jest" />
import { validateResumeFile } from './resumeService';
import { BadRequestError } from '../../utils/errors';

describe('resumeService — File Validation', () => {
  it('accepts valid PDF file within size limit', () => {
    const validFile = {
      mimetype: 'application/pdf',
      size: 5 * 1024 * 1024, // 5MB
      originalname: 'resume.pdf',
    } as Express.Multer.File;

    expect(() => validateResumeFile(validFile)).not.toThrow();
  });

  it('rejects unsupported file type (e.g. image/png)', () => {
    const invalidType = {
      mimetype: 'image/png',
      size: 1 * 1024 * 1024,
      originalname: 'photo.png',
    } as Express.Multer.File;

    expect(() => validateResumeFile(invalidType)).toThrow(BadRequestError);
  });

  it('rejects unsupported file type (e.g. application/docx)', () => {
    const docxFile = {
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 1 * 1024 * 1024,
      originalname: 'resume.docx',
    } as Express.Multer.File;

    expect(() => validateResumeFile(docxFile)).toThrow(BadRequestError);
  });

  it('rejects oversized file (> 10MB)', () => {
    const oversizedFile = {
      mimetype: 'application/pdf',
      size: 15 * 1024 * 1024, // 15MB
      originalname: 'heavy.pdf',
    } as Express.Multer.File;

    expect(() => validateResumeFile(oversizedFile)).toThrow(BadRequestError);
  });
});
