import { Response, Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { uploadCsv } from '../middleware/upload';
import { parseCsvFile, parseManualEmails, detectColumnMapping } from '../services/csvService';
import { isValidEmail, normalizeEmail } from '../utils/sanitize';
import fs from 'fs';

const router = Router();

// POST /api/contacts/import — upload CSV and parse with column mapping
router.post('/import', uploadCsv, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No CSV file uploaded' });
      return;
    }

    // First pass: get headers
    const content = fs.readFileSync(req.file.path, 'utf-8');
    const Papa = require('papaparse');
    const preview = Papa.parse(content, { header: true, preview: 1 });
    const headers = preview.meta.fields || [];

    const autoMapping = detectColumnMapping(headers);

    // If mapping is provided in body, use it; otherwise return headers for client-side mapping
    if (req.body.mapping) {
      const mapping = JSON.parse(req.body.mapping);
      const result = parseCsvFile(req.file.path, mapping);

      // Clean up CSV file
      fs.unlinkSync(req.file.path);

      res.json({
        contacts: result.contacts,
        invalid: result.invalid,
        duplicates: result.duplicates,
        totalRows: result.totalRows,
        validCount: result.contacts.length,
        invalidCount: result.invalid.length,
        duplicateCount: result.duplicates.length,
      });
    } else {
      // Return headers and auto-detected mapping for client to confirm
      res.json({
        headers,
        autoMapping,
        filePath: req.file.path,
        message: 'Headers detected. Provide mapping to proceed.',
      });
    }
  } catch (err) {
    console.error('[Contacts] Import error:', err);
    res.status(500).json({ error: 'Failed to parse CSV file' });
  }
});

// POST /api/contacts/parse — parse CSV with confirmed mapping
router.post('/parse', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filePath, mapping } = req.body;

    if (!filePath || !mapping) {
      res.status(400).json({ error: 'filePath and mapping are required' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(400).json({ error: 'CSV file not found. Please re-upload.' });
      return;
    }

    const result = parseCsvFile(filePath, mapping);

    // Clean up
    fs.unlinkSync(filePath);

    res.json({
      contacts: result.contacts,
      invalid: result.invalid,
      duplicates: result.duplicates,
      totalRows: result.totalRows,
      validCount: result.contacts.length,
      invalidCount: result.invalid.length,
      duplicateCount: result.duplicates.length,
    });
  } catch (err) {
    console.error('[Contacts] Parse error:', err);
    res.status(500).json({ error: 'Failed to parse CSV' });
  }
});

// POST /api/contacts/validate — validate manual email input
router.post('/validate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { input } = req.body;
    if (!input || typeof input !== 'string') {
      res.status(400).json({ error: 'input is required' });
      return;
    }

    const result = parseManualEmails(input);
    res.json({
      valid: result.valid,
      invalid: result.invalid,
      validCount: result.valid.length,
      invalidCount: result.invalid.length,
    });
  } catch (err) {
    console.error('[Contacts] Validate error:', err);
    res.status(500).json({ error: 'Failed to validate emails' });
  }
});

export default router;
