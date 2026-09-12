import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_BASE = path.join(process.cwd(), 'uploads', 'resumes');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_BASE)) {
  fs.mkdirSync(UPLOAD_BASE, { recursive: true });
}

/**
 * Store a file buffer under a deterministic UUID-based storage key.
 * The user-provided filename is NEVER used as a filesystem path.
 *
 * @returns storageKey — opaque identifier stored in the database
 */
export function storeFile(buffer: Buffer, extension: string): string {
  const id = randomUUID();
  const safeName = `${id}${extension}`;
  const storageKey = safeName; // relative key, not a full path
  const fullPath = path.join(UPLOAD_BASE, safeName);
  fs.writeFileSync(fullPath, buffer);
  return storageKey;
}

/**
 * Resolve a storageKey to its absolute filesystem path.
 */
export function getFilePath(storageKey: string): string {
  // Prevent path traversal: only allow plain filenames (no slashes, no ..)
  const sanitized = path.basename(storageKey);
  return path.join(UPLOAD_BASE, sanitized);
}

/**
 * Delete a stored file. Silently ignores missing files.
 */
export function deleteStoredFile(storageKey: string): void {
  try {
    const fullPath = getFilePath(storageKey);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch {
    // Non-fatal — log caller should handle
  }
}
