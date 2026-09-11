import { Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { uploadCsv } from '../middleware/upload';
import { z } from 'zod';
import Papa from 'papaparse';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().max(200).optional().default(''),
  email: z.string().email(),
  phone: z.string().max(50).optional().default(''),
  location: z.string().max(200).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
});

// Helper: Get user name
async function getUserName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name || 'User';
}

// GET /api/hr-contacts
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const search = (req.query.search as string) || '';
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { company: { contains: search, mode: 'insensitive' as const } },
          { location: { contains: search, mode: 'insensitive' as const } },
          { createdBy: { contains: search, mode: 'insensitive' as const } },
          { updatedBy: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [contacts, total] = await Promise.all([
      prisma.hRContact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.hRContact.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    res.json({ contacts, pagination: { total, page, limit, totalPages } });
  } catch (err) {
    console.error('[HRContacts] List error:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// POST /api/hr-contacts
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userName = await getUserName(userId);
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    const contact = await prisma.hRContact.create({
      data: {
        userId,
        ...parsed.data,
        createdBy: userName,
        updatedBy: userName,
      },
    });
    res.status(201).json({ contact });
  } catch (err) {
    console.error('[HRContacts] Create error:', err);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PUT /api/hr-contacts/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const userName = await getUserName(userId);
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    const existing = await prisma.hRContact.findFirst({ where: { id, userId } });
    if (!existing) { res.status(404).json({ error: 'Contact not found' }); return; }

    const contact = await prisma.hRContact.update({
      where: { id },
      data: {
        ...parsed.data,
        updatedBy: userName,
      },
    });
    res.json({ contact });
  } catch (err) {
    console.error('[HRContacts] Update error:', err);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/hr-contacts/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const existing = await prisma.hRContact.findFirst({ where: { id, userId } });
    if (!existing) { res.status(404).json({ error: 'Contact not found' }); return; }
    await prisma.hRContact.delete({ where: { id } });
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    console.error('[HRContacts] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// POST /api/hr-contacts/bulk-delete
router.post('/bulk-delete', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required' }); return;
    }
    const { count } = await prisma.hRContact.deleteMany({
      where: { id: { in: ids }, userId },
    });
    res.json({ message: `Deleted ${count} contacts`, deletedCount: count });
  } catch (err) {
    console.error('[HRContacts] Bulk-delete error:', err);
    res.status(500).json({ error: 'Failed to delete contacts' });
  }
});

// POST /api/hr-contacts/import
router.post('/import', uploadCsv, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const userName = await getUserName(userId);

    if (!req.file) {
      res.status(400).json({ error: 'CSV file is required' });
      return;
    }

    const content = fs.readFileSync(req.file.path, 'utf-8');
    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
    });

    const existingContacts = await prisma.hRContact.findMany({
      where: { userId },
      select: { email: true },
    });
    const existingEmails = new Set(existingContacts.map((c) => c.email.toLowerCase()));

    let createdCount = 0;
    let skippedCount = 0;

    for (const row of parsed.data) {
      // Flexible key matching
      const keys = Object.keys(row);
      const getKey = (possibleNames: string[]) => {
        const found = keys.find((k) => possibleNames.includes(k.trim().toLowerCase()));
        return found ? row[found]?.trim() || '' : '';
      };

      const email = getKey(['email', 'email address', 'emailid']);
      const name = getKey(['name', 'full name', 'contact name', 'hr name', 'recruiter name']);
      const company = getKey(['company', 'company name', 'organization']);
      const phone = getKey(['phone', 'phone number', 'mobile', 'contact number']);
      const location = getKey(['location', 'city', 'country', 'address']);
      const notes = getKey(['notes', 'remarks', 'comments', 'description']);

      if (!email || !email.includes('@')) {
        skippedCount++;
        continue;
      }

      if (existingEmails.has(email.toLowerCase())) {
        skippedCount++;
        continue;
      }

      await prisma.hRContact.create({
        data: {
          userId,
          email,
          name: name || email.split('@')[0],
          company: company || '',
          phone: phone || '',
          location: location || '',
          notes: notes || '',
          createdBy: userName,
          updatedBy: userName,
        },
      });

      existingEmails.add(email.toLowerCase());
      createdCount++;
    }

    // Clean up uploaded temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({ createdCount, skippedCount });
  } catch (err) {
    console.error('[HRContacts] Import error:', err);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

// GET /api/hr-contacts/export
router.get('/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const contacts = await prisma.hRContact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const header = 'name,email,company,phone,location,notes,createdBy,updatedBy\n';
    const rows = contacts.map((c) =>
      `"${c.name}","${c.email}","${c.company}","${c.phone}","${c.location}","${c.notes.replace(/"/g, '""')}","${c.createdBy}","${c.updatedBy}"`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="hr-contacts.csv"');
    res.send(header + rows);
  } catch (err) {
    console.error('[HRContacts] Export error:', err);
    res.status(500).json({ error: 'Failed to export contacts' });
  }
});

export default router;
