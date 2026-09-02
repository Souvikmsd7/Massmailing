import { parseCsvContent, parseManualEmails, detectColumnMapping } from './csvService';

describe('CSV Service', () => {
  describe('parseCsvContent', () => {
    it('parses valid CSV with email mapping', () => {
      const csv = `name,email,company,job_title
Rahul Sharma,rahul@company.com,ABC Technologies,Frontend Developer
Priya Das,priya@xyz.com,XYZ Solutions,React Developer`;

      const result = parseCsvContent(csv, {
        email: 'email',
        name: 'name',
        company: 'company',
        jobTitle: 'job_title',
      });

      expect(result.contacts).toHaveLength(2);
      expect(result.contacts[0].email).toBe('rahul@company.com');
      expect(result.contacts[0].name).toBe('Rahul Sharma');
      expect(result.invalid).toHaveLength(0);
      expect(result.duplicates).toHaveLength(0);
    });

    it('detects invalid email format', () => {
      const csv = `email\nnot-an-email\nvalid@example.com`;
      const result = parseCsvContent(csv, { email: 'email' });

      expect(result.contacts).toHaveLength(1);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].reason).toBe('Invalid email format');
    });

    it('detects duplicate emails (case-insensitive)', () => {
      const csv = `email\nrahul@company.com\nRahul@Company.com\npriya@xyz.com`;
      const result = parseCsvContent(csv, { email: 'email' });

      expect(result.contacts).toHaveLength(2);
      expect(result.duplicates).toHaveLength(1);
    });

    it('handles missing email column gracefully', () => {
      const csv = `name\nRahul`;
      const result = parseCsvContent(csv, { email: 'email' });

      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].reason).toBe('Missing email');
    });
  });

  describe('parseManualEmails', () => {
    it('parses comma-separated emails', () => {
      const result = parseManualEmails('a@x.com, b@x.com, c@x.com');
      expect(result.valid).toHaveLength(3);
      expect(result.invalid).toHaveLength(0);
    });

    it('parses newline-separated emails', () => {
      const result = parseManualEmails('a@x.com\nb@x.com\nc@x.com');
      expect(result.valid).toHaveLength(3);
    });

    it('deduplicates emails', () => {
      const result = parseManualEmails('a@x.com, A@x.com');
      expect(result.valid).toHaveLength(1);
    });

    it('identifies invalid emails', () => {
      const result = parseManualEmails('valid@x.com, notanemail, another@invalid.org');
      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0]).toBe('notanemail');
    });
  });

  describe('detectColumnMapping', () => {
    it('auto-detects common headers', () => {
      const headers = ['Full Name', 'Email Address', 'Company Name', 'Position'];
      const mapping = detectColumnMapping(headers);
      expect(mapping.email).toBeDefined();
      expect(mapping.name).toBeDefined();
    });
  });
});
