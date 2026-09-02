import Papa from 'papaparse';
import fs from 'fs';
import { isValidEmail, normalizeEmail } from '../utils/sanitize';

export interface ParsedContact {
  name?: string;
  email: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  linkedin?: string;
  rowIndex: number;
}

export interface CsvParseResult {
  contacts: ParsedContact[];
  invalid: Array<{ rowIndex: number; email: string; reason: string }>;
  duplicates: Array<{ rowIndex: number; email: string }>;
  headers: string[];
  totalRows: number;
}

export interface ColumnMapping {
  name?: string;
  email: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  linkedin?: string;
}

export function parseCsvFile(filePath: string, mapping: ColumnMapping): CsvParseResult {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return parseCsvContent(fileContent, mapping);
}

export function parseCsvContent(content: string, mapping: ColumnMapping): CsvParseResult {
  const detectedHeaders: string[] = [];
  let rows: Record<string, string>[] = [];

  Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
    complete: (results) => {
      rows = results.data;
      if (results.meta.fields) detectedHeaders.push(...results.meta.fields);
    },
  });

  const contacts: ParsedContact[] = [];
  const invalid: CsvParseResult['invalid'] = [];
  const duplicates: CsvParseResult['duplicates'] = [];
  const seenEmails = new Set<string>();

  rows.forEach((row, idx) => {
    const rawEmail = row[mapping.email] || '';
    const email = normalizeEmail(rawEmail);

    if (!email) {
      invalid.push({ rowIndex: idx, email: rawEmail, reason: 'Missing email' });
      return;
    }

    if (!isValidEmail(email)) {
      invalid.push({ rowIndex: idx, email: rawEmail, reason: 'Invalid email format' });
      return;
    }

    if (seenEmails.has(email)) {
      duplicates.push({ rowIndex: idx, email });
      return;
    }

    seenEmails.add(email);

    contacts.push({
      email,
      name: mapping.name ? (row[mapping.name] || '').trim() : undefined,
      company: mapping.company ? (row[mapping.company] || '').trim() : undefined,
      jobTitle: mapping.jobTitle ? (row[mapping.jobTitle] || '').trim() : undefined,
      phone: mapping.phone ? (row[mapping.phone] || '').trim() : undefined,
      linkedin: mapping.linkedin ? (row[mapping.linkedin] || '').trim() : undefined,
      rowIndex: idx,
    });
  });

  return {
    contacts,
    invalid,
    duplicates,
    headers: detectedHeaders,
    totalRows: rows.length,
  };
}

export function parseManualEmails(input: string): {
  valid: string[];
  invalid: string[];
} {
  const raw = input.split(/[\n,;]+/).map((e) => normalizeEmail(e));
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  raw.forEach((email) => {
    if (!email) return;
    if (!isValidEmail(email)) {
      invalid.push(email);
      return;
    }
    if (!seen.has(email)) {
      seen.add(email);
      valid.push(email);
    }
  });

  return { valid, invalid };
}

export function detectColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const lower = headers.map((h) => h.toLowerCase());

  const find = (candidates: string[]): string | undefined => {
    for (const c of candidates) {
      const idx = lower.findIndex((h) => h.includes(c));
      if (idx !== -1) return headers[idx];
    }
    return undefined;
  };

  mapping.email = find(['email', 'e-mail', 'mail']) || headers[0];
  mapping.name = find(['name', 'full name', 'fullname', 'contact']);
  mapping.company = find(['company', 'organization', 'org', 'employer']);
  mapping.jobTitle = find(['job', 'title', 'position', 'role', 'designation']);
  mapping.phone = find(['phone', 'mobile', 'tel', 'contact number']);
  mapping.linkedin = find(['linkedin', 'linked in', 'profile']);

  return mapping;
}
